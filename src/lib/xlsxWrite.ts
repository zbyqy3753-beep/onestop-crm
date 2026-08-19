/**
 * כותב XLSX עצמאי, בלי ספרייה — התאום של `xlsx.ts` (שקורא).
 *
 * למה בכלל, כשיש כבר ייצוא CSV: CSV הוא טקסט שטוח. אין בו רוחב עמודה,
 * אין שורת כותרת קפואה, אין פילטרים, ואין טיפוס לתא — ולכן אקסל מנחש:
 * "0501234567" הופך למספר ומאבד את האפס המוביל, "03/04" הופך לתאריך,
 * וסכום בשקלים נשאר טקסט שאי אפשר לסכם. הקובץ הזה כותב את הטיפוס
 * במפורש, ולכן הגיליון נפתח כבר מסודר.
 *
 * הפורמט: ZIP של קבצי XML. הרכיבים נכתבים ללא דחיסה (method 0) — קובץ
 * ייצוא של כמה אלפי שורות נשאר קטן, וזה חוסך תלות ואת ה-async של
 * `CompressionStream`.
 *
 * מכוון לגיליון אחד. זה מה שהייצוא צריך, וזה מה שנשמר פשוט.
 */

import { dateTimeInputValue } from "./tz";

/* ── מודל הנתונים ──────────────────────────────────────────────────────── */

/**
 * תא בגיליון. ה-`kind` הוא כל ההבדל מול CSV: הוא קובע גם את הפורמט
 * שהמשתמש רואה וגם איך אקסל מתייחס לערך בנוסחאות ובמיון.
 *
 * `text` נכתב עם פורמט "טקסט" מפורש — זה מה ששומר אפס מוביל בטלפון.
 */
export type SheetCell =
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "money"; value: number }
  /** ISO — נכתב כתאריך אמיתי לפי שעון ישראל */
  | { kind: "date"; value: string }
  /** ISO — תאריך ושעה */
  | { kind: "dateTime"; value: string }
  | { kind: "blank" };

export interface SheetColumn {
  header: string;
  /** רוחב בתווים, כמו בתיבת "רוחב עמודה" של אקסל */
  width: number;
}

export interface SheetSpec {
  /** שם הכרטיסייה בתחתית הגיליון */
  name: string;
  columns: SheetColumn[];
  rows: SheetCell[][];
}

/* ── סגנונות ───────────────────────────────────────────────────────────── */

/** אינדקסים לתוך `cellXfs` שב-`STYLES_XML`. חייב להישאר מסונכרן איתו. */
const STYLE = {
  default: 0,
  header: 1,
  text: 2,
  date: 3,
  dateTime: 4,
  money: 5,
  number: 6,
} as const;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/><numFmt numFmtId="166" formatCode="&quot;₪&quot;#,##0"/></numFmts>
<fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* ── בניית ה-XML ───────────────────────────────────────────────────────── */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // תווי בקרה אינם חוקיים ב-XML 1.0 ומפילים את הפתיחה באקסל
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** 0 → "A", 25 → "Z", 26 → "AA" */
function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * ISO → המספר הסידורי של אקסל (ימים מאז 30/12/1899), **בשעון ישראל**.
 *
 * נגזר מהתצוגה המקומית ולא מ-UTC: ליד שנוצר ב-23:30 בישראל הוא עדיין
 * אותו יום, ותאריך שנכתב מ-UTC היה מוצג יום אחורה חצי מהזמן.
 */
function excelSerial(iso: string, withTime: boolean): number | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;

  const [datePart, timePart] = dateTimeInputValue(ms).split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const days = Date.UTC(y, m - 1, d) / 86_400_000 + 25_569;
  if (!withTime) return days;

  const [hh, mm] = timePart.split(":").map(Number);
  return days + (hh * 60 + mm) / 1440;
}

function cellXml(cell: SheetCell, ref: string): string {
  switch (cell.kind) {
    case "blank":
      return "";

    case "number":
      return `<c r="${ref}" s="${STYLE.number}"><v>${cell.value}</v></c>`;

    case "money":
      return `<c r="${ref}" s="${STYLE.money}"><v>${cell.value}</v></c>`;

    case "date":
    case "dateTime": {
      const serial = excelSerial(cell.value, cell.kind === "dateTime");
      // תאריך שלא נפרס נשאר כטקסט — עדיף תא מכוער מקובץ פגום
      if (serial === null) {
        return `<c r="${ref}" s="${STYLE.text}" t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
      }
      const style = cell.kind === "date" ? STYLE.date : STYLE.dateTime;
      return `<c r="${ref}" s="${style}"><v>${serial}</v></c>`;
    }

    case "text": {
      if (cell.value === "") return "";
      // inlineStr ולא sharedStrings: חוסך מעבר שני על כל הנתונים ואת
      // טבלת המחרוזות, במחיר קובץ מעט גדול יותר שאיש לא ירגיש בו.
      return `<c r="${ref}" s="${STYLE.text}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
    }
  }
}

function sheetXml(sheet: SheetSpec): string {
  const lastCol = columnLetter(Math.max(sheet.columns.length - 1, 0));
  const lastRow = sheet.rows.length + 1;

  const cols = sheet.columns
    .map(
      (c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`,
    )
    .join("");

  const headerCells = sheet.columns
    .map(
      (c, i) =>
        `<c r="${columnLetter(i)}1" s="${STYLE.header}" t="inlineStr"><is><t>${escapeXml(c.header)}</t></is></c>`,
    )
    .join("");

  const bodyRows = sheet.rows
    .map((row, r) => {
      const rowNumber = r + 2;
      const cells = row
        .map((cell, c) => cellXml(cell, `${columnLetter(c)}${rowNumber}`))
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  // rightToLeft="1" — הגיליון נפתח מימין לשמאל, כמו כל שאר המערכת.
  // ה-pane הקפוא ו-autoFilter הם מה שהופך את הקובץ למשהו שאפשר לעבוד
  // איתו: הכותרת נשארת על המסך והסינון כבר מותקן.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView rightToLeft="1" tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16.5"/>
<cols>${cols}</cols>
<sheetData><row r="1" ht="24" customHeight="1">${headerCells}</row>${bodyRows}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
}

function workbookXml(sheetName: string): string {
  // שם כרטיסייה: אקסל אוסר : \\ / ? * [ ] ומגביל ל-31 תווים
  const safe = escapeXml(sheetName.replace(/[:\\/?*[\]]/g, " ").slice(0, 31));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${safe}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/* ── אריזת ה-ZIP ───────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

/** ארכיון ZIP מינימלי, ללא דחיסה (method 0). */
function buildZip(files: ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true); // גרסה נדרשת
    localView.setUint16(6, 0x0800, true); // דגל UTF-8 לשמות
    localView.setUint16(8, 0, true); // ללא דחיסה
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    chunks.push(local, file.bytes);

    const entry = new Uint8Array(46 + nameBytes.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint16(8, 0x0800, true);
    entryView.setUint16(10, 0, true);
    entryView.setUint32(16, crc, true);
    entryView.setUint32(20, size, true);
    entryView.setUint32(24, size, true);
    entryView.setUint16(28, nameBytes.length, true);
    entryView.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    central.push(entry);

    offset += local.length + size;
  }

  const centralSize = central.reduce((sum, e) => sum + e.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);

  const all = [...chunks, ...central, eocd];
  const total = all.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of all) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/* ── נקודת הכניסה ─────────────────────────────────────────────────────── */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** גיליון → קובץ .xlsx כ-Blob. */
export function buildXlsx(sheet: SheetSpec): Blob {
  const encoder = new TextEncoder();
  const text = (name: string, xml: string): ZipFile => ({
    name,
    bytes: encoder.encode(xml),
  });

  const zip = buildZip([
    text("[Content_Types].xml", CONTENT_TYPES_XML),
    text("_rels/.rels", ROOT_RELS_XML),
    text("xl/workbook.xml", workbookXml(sheet.name)),
    text("xl/_rels/workbook.xml.rels", WORKBOOK_RELS_XML),
    text("xl/styles.xml", STYLES_XML),
    text("xl/worksheets/sheet1.xml", sheetXml(sheet)),
  ]);

  // עותק ל-ArrayBuffer רגיל — Blob לא מקבל Uint8Array<ArrayBufferLike>
  return new Blob([zip.slice().buffer as ArrayBuffer], { type: XLSX_MIME });
}

/** מוריד את הגיליון בדפדפן. */
export function downloadXlsx(filename: string, sheet: SheetSpec): void {
  const url = URL.createObjectURL(buildXlsx(sheet));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
