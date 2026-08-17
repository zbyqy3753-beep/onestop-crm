/**
 * כמה עולה הודעת וואטסאפ, ומה זה אומר על מה שאנחנו עומדים לשלוח.
 *
 * ⚠️⚠️ **מטא מחייבים לפי קטגוריה ולא לפי אורך או תוכן.** אותה הודעה
 * בדיוק עולה פי 6.7 אם היא מסווגת שיווק במקום תועלת. לכן הקובץ הזה
 * לא "עוד עזר עיצובי" — הוא מה שהופך את ההבדל הזה לגלוי לפני שליחה,
 * במקום להתגלות בחשבונית בסוף החודש.
 *
 * ⚠️ הודעות שיצאו דרך **הבוט במשרד** לא עולות כלום: הוא וואטסאפ רגיל
 * ולא Cloud API. ההבחנה בין השניים היא `providerMessageId` — ראה
 * `spendSince` ב-`server/whatsapp/overview.ts`, שסופר רק שורות שיש
 * להן מזהה כזה. חישוב שמתעלם מכך היה מנפח את ההוצאה פי כמה.
 */

/**
 * מחירון ישראל בדולר, למסירה אחת. נכון ל-1 ביולי 2026.
 *
 * ⚠️ המקור הוא מחשבון המחירים הרשמי של מטא:
 * https://whatsappbusiness.com/products/platform-pricing/#rates
 * (בוחרים Market = Israel, Currency = USD). מטא מעדכנים את המחירון
 * מדי כמה חודשים — כשזה קורה, מעדכנים כאן ותו לא.
 *
 * ⚠️ מדרגות הכמות של מטא מתחילות ב-300,000 הודעות בחודש ונוגעות רק
 * לתועלת ואימות. אנחנו רחוקים מזה בסדרי גודל, ולכן אין כאן מדרגות —
 * הוספה שלהן הייתה סיבוך שלא משנה אף מספר על המסך.
 */
export const WA_RATE_USD = {
  /** פנייה יזומה ללקוח. היקרה ביותר, ולעולם לא מוזלת. */
  marketing: 0.0353,
  /** הודעה תפעולית — תזכורות, עדכוני סטטוס. */
  utility: 0.0053,
  /** קוד חד-פעמי. לא בשימוש אצלנו כרגע. */
  authentication: 0.0053,
  /** תשובה בתוך חלון 24 השעות. תמיד חינם. */
  service: 0,
} as const;

export type WaCostCategory = keyof typeof WA_RATE_USD;

/** התאריך שממנו המחירון בתוקף — מוצג ליד המספרים כדי שיהיה ברור מה מקורם. */
export const WA_RATE_EFFECTIVE = "1.7.2026";

/**
 * שער המרה לתצוגה בלבד.
 *
 * ⚠️⚠️ **מטא מחייבים בדולר.** השקלים כאן הם קירוב שנועד להפוך את
 * המספר לקריא למי שחושב בשקלים, ולעולם לא הסכום שירד בפועל. לכן כל
 * תצוגה שקלית במערכת מסומנת ב-`≈`, ולכן השער הזה קבוע ולא נמשך
 * משירות חיצוני: תלות ברשת כדי לצייר תווית עלות היא מחיר גבוה מדי
 * עבור דיוק שאף אחד לא מקבל עליו החלטה.
 */
const USD_TO_ILS = 3.6;

/**
 * לאיזו קטגוריה שייכת ההודעה, לפי מפתח הדדופ.
 *
 * ⚠️ אותה הבחנה בדיוק כמו `templateFor` ב-`server/whatsapp/drain.ts`,
 * ומאותה סיבה: מפתח הדדופ הוא כבר מקור האמת לסוג ההודעה. אם נוסף שם
 * סוג חדש שדורש תבנית — הוא צריך להיכנס גם לכאן, אחרת הוא יחויב
 * בשקט ויוצג כחינם.
 */
export function costCategoryOf(dedupeKey: string): WaCostCategory {
  if (dedupeKey.startsWith("renewal:opener:")) return "marketing";
  if (dedupeKey.startsWith("followup:")) return "utility";
  // כל השאר הן תשובות בתוך חלון 24 השעות
  return "service";
}

/** עלות הודעה בודדת בדולר. */
export function costUsd(dedupeKey: string): number {
  return WA_RATE_USD[costCategoryOf(dedupeKey)];
}

/** עלות של `count` הודעות מקטגוריה אחת, בדולר. */
export function bulkCostUsd(category: WaCostCategory, count: number): number {
  return WA_RATE_USD[category] * count;
}

/**
 * סכום בדולר כמחרוזת.
 *
 * ⚠️ ארבע ספרות מתחת לסנט אחד ושתיים מעליו: תזכורת בודדת עולה
 * $0.0053, ועיגול לשתי ספרות היה מציג אותה כ-$0.01 — כמעט כפול.
 * מעל סנט הדיוק הזה כבר רק מרעיש.
 */
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

/** אותו סכום בשקלים, תמיד עם `≈` — ראה `USD_TO_ILS`. */
export function formatIls(usd: number): string {
  if (usd === 0) return "0 ₪";
  const ils = usd * USD_TO_ILS;
  return ils < 1 ? `≈${ils.toFixed(2)} ₪` : `≈${ils.toFixed(1)} ₪`;
}

/** "‎$0.42 ≈1.5 ₪" — שתי היחידות יחד, לתוויות שיש בהן מקום. */
export function formatCost(usd: number): string {
  if (usd === 0) return "חינם";
  return `${formatUsd(usd)} · ${formatIls(usd)}`;
}
