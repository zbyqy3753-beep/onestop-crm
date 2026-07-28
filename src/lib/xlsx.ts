/**
 * קורא XLSX עצמאי, בלי ספרייה.
 *
 * קובץ .xlsx הוא ארכיון ZIP שמכיל XML. במקום להוסיף תלות (SheetJS
 * לא מתוחזק דרך npm, exceljs כבד ומביא ספריות דחיסה/זרימה משלו),
 * המודול הזה קורא ידנית: פורס את ה-ZIP (Central Directory + Local
 * Headers), מפענח deflate עם `DecompressionStream` המובנה בדפדפן,
 * ומפרש את ה-XML עם `DOMParser` המובנה. אפס תלויות ריצה חדשות.
 *
 * מכוון לגיליון הראשון בלבד — זה המקרה הנפוץ בייבוא לידים, ומספיק
 * כדי לא לגרור מנתח sharedStrings/rels מלא לכל הגיליונות.
 *
 * .xls (בינארי, פורמט BIFF ישן) אינו נתמך ולא ניתן לתמיכה סבירה בלי
 * ספרייה ייעודית — זה מטופל בקריאה (ImportLeadsModal), לא כאן.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

interface ZipEntry {
  localHeaderOffset: number;
  compressedSize: number;
  compressionMethod: number;
}

/** מוצא ומפרש את ה-Central Directory של קובץ ה-ZIP. */
function readCentralDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // EOCD יושב בסוף הקובץ, אחרי הערה אופציונלית (עד 64KB) — סורקים
  // אחורה מהסוף במקום להניח שהוא ממש בסוף.
  const maxCommentLength = 65_535;
  const searchStart = Math.max(0, bytes.length - 22 - maxCommentLength);
  let eocdOffset = -1;

  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("קובץ לא תקין — לא זוהה כארכיון ZIP (חסר EOCD)");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  const entries = new Map<string, ZipEntry>();
  let pos = centralDirOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error("קובץ לא תקין — ה-Central Directory פגום");
    }

    const compressionMethod = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const filenameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    const nameBytes = bytes.subarray(pos + 46, pos + 46 + filenameLength);
    const filename = new TextDecoder("utf-8").decode(nameBytes);

    entries.set(filename, { localHeaderOffset, compressedSize, compressionMethod });
    pos += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
}

/** מפענח deflate raw. ZIP method 8 = deflate; method 0 = ללא דחיסה. */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  // Blob מקבל BufferSource, לא Uint8Array<ArrayBufferLike> — עותק מפורש
  // מסיר את אי-הוודאות בין ArrayBuffer ל-SharedArrayBuffer עבור ה-typing
  const copy = data.slice();
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** שולף קובץ בודד מתוך ה-ZIP ומחזיר אותו כטקסט UTF-8. */
async function extractEntry(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
): Promise<string> {
  const entry = entries.get(name);
  if (!entry) throw new Error(`הקובץ ${name} חסר בתוך ה-XLSX`);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { localHeaderOffset, compressedSize, compressionMethod } = entry;

  if (view.getUint32(localHeaderOffset, true) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`כותרת קובץ פגומה עבור ${name}`);
  }

  const filenameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + filenameLength + extraLength;
  const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

  const raw = compressionMethod === 0 ? compressed : await inflate(compressed);
  return new TextDecoder("utf-8").decode(raw);
}

/* ── פענוח ה-XML ──────────────────────────────────────────────────────── */

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

/** מתוך `xl/sharedStrings.xml` — טבלת המחרוזות המשותפות של הגיליון. */
function parseSharedStrings(xml: string): string[] {
  const doc = parseXml(xml);
  return [...doc.getElementsByTagName("si")].map((si) => si.textContent ?? "");
}

/**
 * מזהה את קובץ ה-XML של הגיליון הראשון.
 *
 * לא מניחים ש"sheet1.xml" הוא בהכרח הגיליון הראשון — סדר הכרטיסיות
 * בפועל נקבע ב-workbook.xml, והשם הפיזי נגזר דרך workbook.xml.rels.
 * אם המיפוי הזה נכשל מכל סיבה, נופלים חזרה לניחוש הסביר ביותר.
 */
function resolveFirstSheetPath(
  workbookXml: string | null,
  relsXml: string | null,
  entries: Map<string, ZipEntry>,
): string {
  const fallback = () => {
    const candidates = [...entries.keys()]
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort();
    if (candidates.length === 0) {
      throw new Error("לא נמצא אף גיליון בתוך הקובץ");
    }
    return candidates[0];
  };

  if (!workbookXml || !relsXml) return fallback();

  const workbookDoc = parseXml(workbookXml);
  const firstSheet = workbookDoc.getElementsByTagName("sheet")[0];
  const relId = firstSheet?.getAttribute("r:id");
  if (!relId) return fallback();

  const relsDoc = parseXml(relsXml);
  const rel = [...relsDoc.getElementsByTagName("Relationship")].find(
    (r) => r.getAttribute("Id") === relId,
  );
  const target = rel?.getAttribute("Target");
  if (!target) return fallback();

  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  return entries.has(path) ? path : fallback();
}

/** "AB12" → אינדקס עמודה 0-based (A=0, B=1, ... AA=26, AB=27). */
function columnIndexFromRef(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? "A";
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function cellValue(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute("t");

  if (type === "inlineStr") {
    return cell.getElementsByTagName("t")[0]?.textContent ?? "";
  }

  const raw = cell.getElementsByTagName("v")[0]?.textContent;
  if (raw === undefined || raw === null) return "";

  if (type === "s") {
    const i = Number(raw);
    return Number.isInteger(i) ? (sharedStrings[i] ?? "") : "";
  }

  // מספרים, תאריכים (מיוצגים כמספר סידורי), בוליאנים — כולם נשארים
  // כטקסט גולמי; לא ידוע לנו כאן איזה format code מוצג בתא באקסל,
  // אז המרה "חכמה" הייתה רק מנחשת. הייבוא ממילא מצפה לטקסט.
  return raw;
}

/** גיליון XML בודד → מטריצת תאים דחוסה (בלי שורות/עמודות ריקות בקצוות). */
function parseSheetXml(xml: string, sharedStrings: string[]): string[][] {
  const doc = parseXml(xml);
  const rowElements = [...doc.getElementsByTagName("row")];

  const grid: string[][] = [];

  rowElements.forEach((rowEl, sequentialIndex) => {
    const rAttr = rowEl.getAttribute("r");
    const rowIndex = rAttr ? Number(rAttr) - 1 : sequentialIndex;
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return;

    const row: string[] = grid[rowIndex] ?? [];
    for (const cell of [...rowEl.getElementsByTagName("c")]) {
      const ref = cell.getAttribute("r");
      const colIndex = ref ? columnIndexFromRef(ref) : row.length;
      row[colIndex] = cellValue(cell, sharedStrings);
    }
    grid[rowIndex] = row;
  });

  // תאים שלא נכתבו נשארים `undefined` בתוך מערך דליל — ממירים ל-""
  // ומשמיטים שורות ריקות לגמרי (כולל השורה הריקה שנוצרת מ-sparse array
  // באינדקסים שאין להם רשומת <row> כלל).
  return grid
    .map((row) => (row ? Array.from(row, (c) => c ?? "") : []))
    .filter((row) => row.some((c) => c.trim() !== ""));
}

/* ── נקודת הכניסה ─────────────────────────────────────────────────────── */

export async function readXlsxSheet(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("הקובץ אינו XLSX תקין (לא ארכיון ZIP)");
  }

  const entries = readCentralDirectory(bytes);

  const [workbookXml, relsXml] = await Promise.all([
    entries.has("xl/workbook.xml")
      ? extractEntry(bytes, entries, "xl/workbook.xml")
      : Promise.resolve(null),
    entries.has("xl/_rels/workbook.xml.rels")
      ? extractEntry(bytes, entries, "xl/_rels/workbook.xml.rels")
      : Promise.resolve(null),
  ]);

  const sheetPath = resolveFirstSheetPath(workbookXml, relsXml, entries);

  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(await extractEntry(bytes, entries, "xl/sharedStrings.xml"))
    : [];

  const sheetXml = await extractEntry(bytes, entries, sheetPath);
  return parseSheetXml(sheetXml, sharedStrings);
}
