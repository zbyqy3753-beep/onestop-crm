import assert from "node:assert/strict";
import { test } from "node:test";

// הרצה: npm test
// (המריץ הוא tsx ולא node --test: המודולים מייבאים דרך "@/...",
// ופתרון הכינוי מגיע מ-tsconfig.)
import {
  buildRow,
  describeDetection,
  detectColumns,
} from "../src/components/leads/importColumns.ts";
import { isIsraeliPhone, normalizeIsraeliPhone } from "../src/lib/format.ts";

/** מריץ את המסלול המלא של המודל: זיהוי → בנייה → ולידציה. */
function importAll(matrix) {
  const { mapping, hadHeader, lastNameAt } = detectColumns(matrix);
  const body = hadHeader ? matrix.slice(1) : matrix;
  const rows = body.map((cells) => buildRow(cells, mapping, lastNameAt));
  return {
    mapping,
    hadHeader,
    lastNameAt,
    detection: describeDetection(mapping, lastNameAt),
    valid: rows.filter((r) => r.name.trim().length >= 2 && isIsraeliPhone(r.phone)),
    rows,
  };
}

/* ── נרמול טלפון ──────────────────────────────────────────────────────── */

test("טלפון: אקסל אכל את האפס המוביל — מחזירים אותו", () => {
  assert.equal(normalizeIsraeliPhone("537255148"), "0537255148");
  assert.equal(normalizeIsraeliPhone("542482426"), "0542482426");
});

test("טלפון: קווי בן 8 ספרות מקבל אפס", () => {
  assert.equal(normalizeIsraeliPhone("36251234"), "036251234");
});

test("טלפון: צורות בינלאומיות חוזרות לצורה המקומית", () => {
  assert.equal(normalizeIsraeliPhone("972537255148"), "0537255148");
  assert.equal(normalizeIsraeliPhone("+972-53-725-5148"), "0537255148");
  assert.equal(normalizeIsraeliPhone("00972537255148"), "0537255148");
});

test("טלפון: מספר תקין נשאר כמו שהוא", () => {
  assert.equal(normalizeIsraeliPhone("053-725-5148"), "0537255148");
  assert.equal(normalizeIsraeliPhone("0537255148"), "0537255148");
});

test("טלפון: מה שאינו מספר ישראלי לא מקבל אפס מומצא", () => {
  // ⚠️ הסכנה האמיתית בנרמול: להשלים אפס לכל דבר ולייבא מספרים
  // שאינם קיימים. מזהה פנימי, מיקוד ותא ריק נדחים.
  assert.equal(normalizeIsraeliPhone("12345"), null);
  assert.equal(normalizeIsraeliPhone("664412345"), null);
  assert.equal(normalizeIsraeliPhone("male"), null);
  assert.equal(normalizeIsraeliPhone(""), null);
});

/* ── זיהוי לפי תוכן ───────────────────────────────────────────────────── */

/** קובץ מפעיל אמיתי: פרטי, משפחה, מגדר, טלפון בלי אפס, ספק. בלי כותרות. */
const OPERATOR_FILE = [
  ["רוני", "אהרוני", "male", "537255148", "Cellcom"],
  ["Mari-anna", "Shapiro", "female", "538238488", "Cellcom"],
  ["Shaul", "Pacha", "male", "542255423", "Cellcom"],
  ["אבי", "פינקו", "male", "542482426", "Cellcom"],
  ["Ekaterina", "Gasperovich", "female", "542489796", "Cellcom"],
  ["Jimi", "Nissan", "male", "542616649", "Cellcom"],
];

test("תוכן: קובץ מפעיל בלי כותרות נקרא במלואו", () => {
  const res = importAll(OPERATOR_FILE);
  assert.equal(res.hadHeader, false);
  assert.equal(res.valid.length, OPERATOR_FILE.length);
  assert.equal(res.rows[0].name, "רוני אהרוני");
  assert.equal(res.rows[0].phone, "0537255148");
  assert.equal(res.rows[0].currentProvider, "cellcom");
});

test("תוכן: עמודת מגדר לא נדבקת לשם", () => {
  // זו העמודה שהורסת כל ניחוש לפי מיקום: היא טקסט, היא יושבת בין
  // השם לטלפון, והיא חוזרת על עצמה — ולכן נופלת על סף הייחודיות.
  const res = importAll(OPERATOR_FILE);
  assert.equal(res.lastNameAt, 1);
  for (const row of res.rows) {
    assert.doesNotMatch(row.name, /male|female/);
  }
});

test("תוכן: התיאור אומר לאיזו עמודה כל שדה מופה", () => {
  const res = importAll(OPERATOR_FILE);
  assert.equal(res.detection, "שם = A+B · טלפון = D · ספק = E");
});

test("תוכן: שם בעמודה אחת, טלפון תקין — הצורה הפשוטה", () => {
  const res = importAll([
    ["ישראל ישראלי", "0501234567"],
    ["משה כהן", "0521234567"],
    ["דנה לוי", "0541234567"],
  ]);
  assert.equal(res.valid.length, 3);
  assert.equal(res.rows[0].name, "ישראל ישראלי");
});

test("תוכן: עמודת מזהה מספרית אינה שם ואינה טלפון", () => {
  const res = importAll([
    ["1001", "ישראל ישראלי", "501234567"],
    ["1002", "משה כהן", "521234567"],
    ["1003", "דנה לוי", "541234567"],
  ]);
  assert.equal(res.mapping.name, 1);
  assert.equal(res.mapping.phone, 2);
  assert.equal(res.valid.length, 3);
});

test("תוכן: אימייל מזוהה בכל מקום בשורה", () => {
  const res = importAll([
    ["ישראל ישראלי", "dani@example.com", "0501234567"],
    ["משה כהן", "moshe@example.co.il", "0521234567"],
    ["דנה לוי", "dana@example.com", "0541234567"],
  ]);
  assert.equal(res.rows[0].email, "dani@example.com");
  assert.equal(res.valid.length, 3);
});

/* ── מסלול הכותרות ────────────────────────────────────────────────────── */

test("כותרות: קובץ עם כותרות בעברית ממשיך לעבוד כמו קודם", () => {
  const res = importAll([
    ["שם", "טלפון", "אימייל", "עיר"],
    ["ישראל ישראלי", "050-123-4567", "israel@example.com", "חיפה"],
    ["משה כהן", "0521234567", "", "אשדוד"],
  ]);
  assert.equal(res.hadHeader, true);
  assert.equal(res.valid.length, 2);
  assert.equal(res.rows[0].city, "חיפה");
  assert.equal(res.rows[0].phone, "0501234567");
});

test("כותרות: גם קובץ עם כותרות נהנה מהחזרת האפס המוביל", () => {
  // אותה תקלת אקסל בדיוק, רק שהפעם יש כותרות — ולכן היא הייתה נראית
  // כמו "כל השורות נפסלו" בקובץ שנראה מושלם
  const res = importAll([
    ["שם מלא", "מספר טלפון"],
    ["ישראל ישראלי", "501234567"],
  ]);
  assert.equal(res.hadHeader, true);
  assert.equal(res.rows[0].phone, "0501234567");
  assert.equal(res.valid.length, 1);
});
