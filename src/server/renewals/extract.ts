import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

/**
 * חילוץ טקסט מ-PDF.
 *
 * `unpdf` ולא `pdf-parse`: הראשון בנוי ל-serverless ומביא pdf.js
 * מקומפל בלי תלויות מקומיות, והשני מנסה לקרוא קובץ בדיקה מהדיסק
 * ברגע הייבוא — מה שנשבר בבנייה של Vercel.
 *
 * ⚠️ **הטקסט נשמר גולמי, בלי ניקוי.** שדות ה-PDF יוצאים בסדר שהמסמך
 * הגדיר ולא בסדר הקריאה, ובעברית זה מתבטא במילים שנראות הפוכות או
 * בשורות מפוצלות באמצע. כל "תיקון" כאן היה מוחק מידע לפני שראינו איך
 * חשבונית אמיתית נראית — ואת מה שנמחק אי אפשר לשחזר בלי להעלות מחדש.
 */

/**
 * ⚠️ `Math.sumPrecise` הוא הצעת ES שעדיין לא קיימת ב-Node (נבדק מול
 * 26.4). pdf.js הפנימי של unpdf קורא לו בחישוב מיקום הטקסט, נכשל,
 * ותופס את החריגה — כך שהחילוץ עובד אבל מדפיס `TypeError` לכל גופן
 * בכל מסמך, ומסתמך על נתיב נסיגה בחישוב שמרכיב את סדר התווים.
 *
 * המילוי כאן מוסיף חיבור מדויק (Neumaier) ומייתר את שניהם: אין רעש
 * בלוג, ואין תלות בנתיב הנסיגה כשמסמך מסובך יוצא בסדר שגוי.
 */
function ensureSumPrecise(): void {
  const M = Math as unknown as { sumPrecise?: (v: Iterable<number>) => number };
  if (typeof M.sumPrecise === "function") return;

  M.sumPrecise = (values: Iterable<number>): number => {
    let sum = 0;
    let compensation = 0;
    for (const value of values) {
      const t = sum + value;
      compensation +=
        Math.abs(sum) >= Math.abs(value) ? sum - t + value : value - t + sum;
      sum = t;
    }
    return sum + compensation;
  };
}

export interface ExtractResult {
  text: string;
  pageCount: number;
}

/**
 * כמות התווים שמתחתיה מניחים שאין טקסט אמיתי.
 *
 * חשבונית סרוקה (תמונה בתוך PDF) מחזירה מחרוזת ריקה או כמה תווי
 * מטא בודדים. בלי הסף הזה היא הייתה נשמרת כ"חולץ בהצלחה" עם טקסט
 * ריק, והכישלון היה מתגלה רק בשלב חילוץ השדות.
 */
const MIN_MEANINGFUL_CHARS = 40;

export async function extractPdfText(bytes: Uint8Array): Promise<ExtractResult> {
  ensureSumPrecise();

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // pdf.js מדווח על קובץ מוצפן בשם המחלקה ולא בטקסט קריא
    if (/password/i.test(msg)) {
      throw new Error("הקובץ מוגן בסיסמה");
    }
    throw new Error("הקובץ אינו PDF תקין או שהוא פגום");
  }

  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;

  if (merged.trim().length < MIN_MEANINGFUL_CHARS) {
    throw new Error(
      "לא נמצא טקסט במסמך — כנראה סריקה או צילום. צריך קובץ שהופק דיגיטלית",
    );
  }

  return { text: merged, pageCount: totalPages };
}
