import { normalizeEmail } from "@/lib/email";

/**
 * זיהוי העמודות בקובץ הנמענים.
 *
 * מקביל ל-`src/components/leads/importColumns.ts` אבל מכוון למייל:
 * שם המקבל ושדות מיזוג חופשיים, בלי טלפון ובלי מודל הלידים.
 *
 * ⚠️ **הזיהוי הוא הצעה שהמשתמש מאשר או משנה במסך**, ולא החלטה
 * סופית. קובץ עם שתי עמודות מייל אינו תקלה שצריך לפתור כאן.
 */

const EMAIL_HEADERS = [
  "מייל",
  "אימייל",
  "דואר",
  'דוא"ל',
  "email",
  "e-mail",
  "mail",
];
const NAME_HEADERS = ["שם", "שם מלא", "לקוח", "name", "full name", "customer"];

export interface RecipientMapping {
  emailAt: number;
  nameAt: number | null;
}

export interface DetectedRecipients {
  mapping: RecipientMapping | null;
  hadHeader: boolean;
  /** שמות העמודות — מהכותרת, או "עמודה N" כשאין */
  headers: string[];
}

function matches(cell: string, options: string[]): boolean {
  const value = cell.trim().toLowerCase();
  return value.length > 0 && options.some((o) => value.includes(o));
}

/** האם השורה נראית כמו כותרת — כלומר אין בה אף כתובת מייל תקינה. */
function looksLikeHeader(row: string[]): boolean {
  return (
    row.some((c) => c.trim().length > 0) && !row.some((c) => normalizeEmail(c))
  );
}

export function detectRecipientColumns(matrix: string[][]): DetectedRecipients {
  const rows = matrix.filter((r) => r.some((c) => c.trim().length > 0));
  if (rows.length === 0) return { mapping: null, hadHeader: false, headers: [] };

  const hadHeader = looksLikeHeader(rows[0]);
  const width = Math.max(...rows.map((r) => r.length));

  const headers = Array.from({ length: width }, (_, i) =>
    hadHeader ? (rows[0][i] ?? "").trim() || `עמודה ${i + 1}` : `עמודה ${i + 1}`,
  );

  const body = hadHeader ? rows.slice(1) : rows;

  let emailAt = hadHeader
    ? rows[0].findIndex((c) => matches(c, EMAIL_HEADERS))
    : -1;

  // ⚠️ נפילה לזיהוי לפי תוכן: העמודה שהכי הרבה תאים בה הם כתובת.
  // כותרת שכתובה בשפה שלא חשבנו עליה לא אמורה להפיל את הייבוא.
  if (emailAt < 0) {
    let best = -1;
    let bestCount = 0;
    for (let col = 0; col < width; col++) {
      const count = body.filter((r) => normalizeEmail(r[col] ?? "")).length;
      if (count > bestCount) {
        bestCount = count;
        best = col;
      }
    }
    emailAt = bestCount > 0 ? best : -1;
  }

  if (emailAt < 0) return { mapping: null, hadHeader, headers };

  let nameAt = hadHeader
    ? rows[0].findIndex((c, i) => i !== emailAt && matches(c, NAME_HEADERS))
    : -1;

  // בלי כותרת: העמודה הראשונה שאינה המייל ואינה ריקה
  if (nameAt < 0) {
    nameAt = headers.findIndex(
      (_, i) =>
        i !== emailAt && body.some((r) => (r[i] ?? "").trim().length > 0),
    );
  }

  return {
    mapping: { emailAt, nameAt: nameAt >= 0 ? nameAt : null },
    hadHeader,
    headers,
  };
}

export interface ParsedRecipient {
  /** מנורמל, או מחרוזת ריקה אם התא אינו כתובת תקינה */
  email: string;
  name: string;
  fields: Record<string, string>;
}

/**
 * ⚠️ **שורה בלי מייל תקין חוזרת עם `email` ריק ואינה מושמטת.** השמטה
 * שקטה כאן היא בדיוק איך שנמענים "נעלמים" בלי שאיש ידע; מסך האישור
 * סופר אותן ומציג את הרשימה לפני השליחה.
 *
 * שורה ריקה לגמרי כן מושמטת — היא רעש של אקסל, לא נמען.
 */
export function buildRecipients(
  matrix: string[][],
  detected: DetectedRecipients,
): ParsedRecipient[] {
  const { mapping, hadHeader, headers } = detected;
  if (!mapping) return [];

  const rows = matrix.filter((r) => r.some((c) => c.trim().length > 0));
  const body = hadHeader ? rows.slice(1) : rows;

  return body.map((row) => {
    const fields: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (i === mapping.emailAt || i === mapping.nameAt) return;
      const value = (row[i] ?? "").trim();
      if (value) fields[header] = value;
    });

    return {
      email: normalizeEmail(row[mapping.emailAt] ?? "") ?? "",
      name: mapping.nameAt === null ? "" : (row[mapping.nameAt] ?? "").trim(),
      fields,
    };
  });
}
