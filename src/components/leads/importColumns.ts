import type { ImportRow } from "@/app/(app)/leads/actions";
import { cleanText, matchProvider, parseInterest } from "@/lib/domain/interest";
import { matchImportField, matchLeadCategory, type LeadImportField } from "@/lib/domain/types";
import { normalizeIsraeliPhone } from "@/lib/format";

/**
 * זיהוי העמודות בקובץ ייבוא, ובניית שורה מהן.
 *
 * הופרד מ-`ImportLeadsModal` כי זו הלוגיקה היחידה שם שאפשר לבדוק בלי
 * דפדפן — ובדיוק החלק שנשבר על קבצים אמיתיים. ראה `tools/importColumns.test.mjs`.
 */

export type Mapping = Partial<Record<LeadImportField, number>>;

export interface Detected {
  mapping: Mapping;
  hadHeader: boolean;
  /**
   * עמודת שם משפחה נפרדת. קבצים של שותפים ושל מפעילים מגיעים לרוב
   * עם "שם פרטי" ו"שם משפחה" בשתי עמודות, ושם שמורכב מעמודה אחת
   * בלבד היה מייבא חצי מהלקוח.
   */
  lastNameAt?: number;
}

/**
 * מנסה לקרוא את השורה הראשונה ככותרות. אם אף עמודה לא מזוהה, מזהה
 * את העמודות לפי **התוכן** שלהן.
 *
 * ⚠️ המיפוי לפי מיקום שהיה כאן קודם (שם=0, טלפון=1) נכשל על כל קובץ
 * אמיתי שלא נבנה בשבילנו: קובץ מפעיל טיפוסי הוא שם פרטי, שם משפחה,
 * מגדר, טלפון, ספק — ובו "אהרוני" נקרא כטלפון וכל 1049 השורות נפסלו
 * עם הודעה שאומרת "לא נמצאה אף שורה תקינה". הקובץ היה תקין לגמרי.
 */
export function detectColumns(matrix: string[][]): Detected {
  const mapping: Mapping = {};

  matrix[0].forEach((cell, i) => {
    const field = matchImportField(cell);
    if (field !== undefined && mapping[field] === undefined) mapping[field] = i;
  });

  // כותרות אמיתיות מזהות לפחות שם או טלפון
  if (mapping.name !== undefined || mapping.phone !== undefined) {
    return { mapping, hadHeader: true };
  }

  return { ...detectByContent(matrix), hadHeader: false };
}

/** מדגם קבוע — מספיק כדי לזהות עמודה, וזול גם בקובץ של אלפי שורות. */
const SAMPLE_ROWS = 50;

/**
 * ⚠️ עמודת שם היא כמעט-ייחודית לכל שורה. הסף הזה הוא מה שמפריד בינה
 * לבין עמודות טקסט אחרות שנראות דומה — מגדר, ספק, סניף, סטטוס — שכולן
 * חוזרות על עצמן. בלעדיו "רוני אהרוני male" היה נכנס כשם הלקוח.
 */
const NAME_DISTINCT_RATIO = 0.6;

function detectByContent(matrix: string[][]): Omit<Detected, "hadHeader"> {
  const sample = matrix.slice(0, SAMPLE_ROWS);
  const width = sample.reduce((max, row) => Math.max(max, row.length), 0);

  const columnValues = (i: number) =>
    sample.map((row) => cleanText(row[i] ?? "")).filter(Boolean);

  /** העמודה שבה הכי הרבה ערכים עונים על התנאי, ורוב הערכים עונים עליו. */
  const bestColumn = (
    test: (value: string) => boolean,
    taken: Set<number>,
  ): number | undefined => {
    let best: number | undefined;
    let bestHits = 0;

    for (let i = 0; i < width; i++) {
      if (taken.has(i)) continue;
      const values = columnValues(i);
      if (values.length === 0) continue;

      const hits = values.filter(test).length;
      // רוב מוחלט ולא "לפחות אחד": בעמודת שם יש גם ערך בודד שנראה
      // כמו מספר, וזה לא הופך אותה לעמודת טלפון
      if (hits > bestHits && hits >= values.length * 0.7) {
        best = i;
        bestHits = hits;
      }
    }
    return best;
  };

  const taken = new Set<number>();
  const claim = (field: LeadImportField, index: number | undefined) => {
    if (index === undefined) return;
    mapping[field] = index;
    taken.add(index);
  };

  const mapping: Mapping = {};

  // הטלפון ראשון — הוא העמודה היחידה שאפשר לזהות בוודאות, והוא גם
  // העוגן שקובע איפה נגמרים שדות הזיהוי של הלקוח
  claim("phone", bestColumn((v) => normalizeIsraeliPhone(v) !== null, taken));
  claim("email", bestColumn((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), taken));
  claim("provider", bestColumn((v) => matchProvider(v) !== undefined, taken));

  // עמודות שם: טקסט כמעט-ייחודי, לפני עמודת הטלפון. שתיים לכל היותר
  // (פרטי + משפחה) — שלישית כבר תהיה כתובת או הערה שנדבקת לשם.
  const phoneAt = mapping.phone;
  const nameColumns: number[] = [];

  for (let i = 0; i < width && nameColumns.length < 2; i++) {
    if (taken.has(i)) continue;
    if (phoneAt !== undefined && i > phoneAt) break;

    const values = columnValues(i);
    if (values.length < sample.length * 0.5) continue;
    // ערך שכולו ספרות אינו שם — מזהה, מיקוד או מספר שורה
    if (values.some((v) => /^\d+$/.test(v))) continue;

    const distinct = new Set(values).size;
    if (distinct >= values.length * NAME_DISTINCT_RATIO) nameColumns.push(i);
  }

  if (nameColumns.length > 0) {
    mapping.name = nameColumns[0];
    taken.add(nameColumns[0]);
  }
  if (nameColumns.length > 1) taken.add(nameColumns[1]);

  return { mapping, lastNameAt: nameColumns[1] };
}

/** "A" לעמודה 0 — אותן אותיות שאקסל מציג, כדי שאפשר יהיה להצליב. */
function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const FIELD_LABEL: Partial<Record<LeadImportField, string>> = {
  name: "שם",
  phone: "טלפון",
  email: "אימייל",
  city: "עיר",
  provider: "ספק",
  packageName: "חבילה",
};

/** "שם = A+B · טלפון = D · ספק = E" — מה שמוצג כשהזיהוי היה לפי תוכן. */
export function describeDetection(mapping: Mapping, lastNameAt?: number): string {
  return (Object.keys(FIELD_LABEL) as LeadImportField[])
    .filter((field) => mapping[field] !== undefined)
    .map((field) => {
      const letters =
        field === "name" && lastNameAt !== undefined
          ? `${columnLetter(mapping.name!)}+${columnLetter(lastNameAt)}`
          : columnLetter(mapping[field]!);
      return `${FIELD_LABEL[field]} = ${letters}`;
    })
    .join(" · ");
}

/**
 * מזהה חיצוני נכנס להערה — אין לו עמודה משלנו, והוא הדרך היחידה
 * להצליב ליד מול המערכת שהוא הגיע ממנה.
 *
 * הסף קיים כי עמודת `#` היא לפעמים מזהה אמיתי ולפעמים סתם מונה שורות.
 * "מזהה חיצוני: 3" הוא רעש; "מזהה חיצוני: 42557025" הוא מידע.
 */
const MIN_EXTERNAL_ID_LENGTH = 4;

export function buildRow(
  cells: string[],
  mapping: Mapping,
  lastNameAt?: number,
): ImportRow {
  const at = (field: LeadImportField): string => {
    const i = mapping[field];
    return i === undefined ? "" : cleanText(cells[i] ?? "");
  };

  const name = [at("name"), lastNameAt === undefined ? "" : cleanText(cells[lastNameAt] ?? "")]
    .filter(Boolean)
    .join(" ");

  // ⚠️ הנרמול כאן ולא בוולידציה: תא טלפון שנשמר באקסל כמספר מגיע בלי
  // האפס המוביל, ובלעדיו כל שורה בקובץ נפסלת. שמירת הערך הגולמי
  // כשהנרמול נכשל היא בכוונה — השורה תיפסל, אבל עם מה שבאמת היה בתא.
  const rawPhone = at("phone");

  // ⚠️ עמודת החבילה של השותף מכילה בפועל **שני** פרטים במחרוזת אחת
  // ("פלאפון – 300GB Perfect"), ולפעמים דווקא קטגוריה ("טריפל").
  // אותו פענוח בדיוק שמשמש את `POST /api/leads` — ראה domain/interest.
  const rawPackage = at("packageName");
  const parsed = parseInterest(rawPackage);

  // עמודת ספק מפורשת גוברת על מה שנחלץ מתוך שם החבילה
  const provider = matchProvider(at("provider")) ?? parsed.provider;
  const category = matchLeadCategory(at("category")) ?? parsed.category;

  // אם הפענוח לא זיהה כלום, שם החבילה נשמר כפי שהוא — עדיף ערך גולמי
  // מאשר לאבד אותו רק כי לא הצלחנו לפרק אותו
  const packageName = parsed.packageName ?? (parsed.category ? "" : rawPackage);

  const externalId = at("externalId");
  const notes = [
    at("note"),
    externalId.length >= MIN_EXTERNAL_ID_LENGTH
      ? `מזהה חיצוני: ${externalId}`
      : "",
  ].filter(Boolean);

  return {
    name,
    phone: normalizeIsraeliPhone(rawPhone) ?? rawPhone,
    email: at("email") || undefined,
    city: at("city") || undefined,
    note: notes.join("\n") || undefined,
    sourceDetail: at("sourceDetail") || undefined,
    packageName: packageName || undefined,
    currentProvider: provider,
    category,
  };
}
