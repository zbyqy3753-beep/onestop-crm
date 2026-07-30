/**
 * מודול CSV משותף — ייצוא וייבוא.
 *
 * נכתב ידנית ובלי תלויות, בקו של הפרויקט (אין ספריות ריצה מעבר
 * ל-next/react/prisma). שני הדברים שנראים כאן מיותרים — זיהוי המפריד
 * וזיהוי הקידוד — הם בדיוק מה שגורם לייבוא לעבוד מול קבצים אמיתיים
 * שיצאו מאקסל בעברית על Windows. אל תסיר אותם.
 */

/* ── ייצוא ────────────────────────────────────────────────────────────── */

/**
 * עוטף תא במרכאות רק כשצריך, ומכפיל מרכאות פנימיות.
 *
 * תא שמתחיל ב-`=`, `+`, `-` או `@` מקבל גרש מוביל: אקסל מפרש תא כזה
 * כנוסחה ומריץ אותה בפתיחת הקובץ. שם ליד כמו `=HYPERLINK("...")`,
 * שהגיע מטופס חיצוני, היה מורץ אצל מי שפותח את הייצוא. הגרש הוא
 * המוסכמה שאקסל עצמו משתמש בה כדי לסמן "זה טקסט".
 */
export function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** מטריצת תאים → גוף CSV. תמיד כותבים מופרד בפסיקים. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/**
 * מוריד את הקובץ בדפדפן.
 *
 * ה-BOM (U+FEFF) בתחילת הגוף הוא מה שגורם לאקסל לזהות UTF-8 ולא לשבור
 * עברית. הוא נראה כמו תו בלתי נראה מיותר — הוא לא.
 */
export function downloadCsv(filename: string, body: string): void {
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── ייבוא ────────────────────────────────────────────────────────────── */

/**
 * מפענח קובץ טקסט שהגיע מגיליון אלקטרוני.
 *
 * "CSV (מופרד בפסיקים)" של אקסל על Windows בעברית נשמר ב-windows-1255,
 * לא ב-UTF-8 — `file.text()` לבדו היה מחזיר ג'יבריש. לכן מנסים UTF-8
 * במצב fatal, ורק אם הוא נכשל נופלים ל-windows-1255.
 */
export function decodeSpreadsheetText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1255").decode(buffer);
  }
}

const DELIMITERS = [",", ";", "\t"] as const;
type Delimiter = (typeof DELIMITERS)[number];

/**
 * מזהה את המפריד לפי השורה הראשונה, תוך התעלמות מתוכן מצוטט.
 *
 * אקסל בעברית על Windows כותב `;` ולא `,` (כי הפסיק הוא מפריד העשרוני
 * בלוקאל). בלי הזיהוי הזה כל ייבוא אמיתי היה נותן עמודה אחת ענקית.
 */
function detectDelimiter(text: string): Delimiter {
  const counts = new Map<Delimiter, number>();
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // מרכאות כפולות בתוך שדה מצוטט הן escape, לא סגירה
      if (quoted && text[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (quoted) continue;
    if (ch === "\n" || ch === "\r") break; // סוף השורה הראשונה
    if ((DELIMITERS as readonly string[]).includes(ch)) {
      const d = ch as Delimiter;
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }

  let best: Delimiter = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const c = counts.get(d) ?? 0;
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

/**
 * פרסר CSV/TSV מלא: שדות מצוטטים, מרכאות מוכפלות, שורות חדשות בתוך תא,
 * ו-CRLF / LF / CR. מחזיר מטריצת תאים גולמיים בלי לפרש כותרות.
 *
 * שורות ריקות לגמרי מושמטות — בעיקר בגלל השורה החדשה בסוף הקובץ.
 */
export function parseDelimited(raw: string): string[][] {
  const text = raw.replace(/^﻿/, "");
  if (!text.trim()) return [];

  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") continue; // CRLF — ה-\n יסגור את השורה
      endRow();
    } else if (ch === "\n") {
      endRow();
    } else {
      cell += ch;
    }
  }

  // השורה האחרונה, כשהקובץ לא נגמר בשורה חדשה
  if (cell !== "" || row.length > 0) endRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
