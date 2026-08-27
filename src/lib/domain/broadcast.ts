import { normalizeIsraeliPhone, toE164 } from "@/lib/format";

/**
 * דיוור המוני בוואטסאפ — הנוסח, המגבלות, ופענוח רשימת המספרים.
 *
 * ⚠️⚠️ **ההודעה יוצאת כפרמטר בתבנית מאושרת, לא כטקסט חופשי.** מטא
 * מתירים טקסט חופשי רק בתוך 24 שעות מרגע שהלקוח כתב לנו; הודעה
 * שאנחנו יוזמים חייבת תבנית שאושרה מראש (`cloudApi.ts` מסביר).
 * לכן כל מה שהמשתמש כותב נכנס ל-`{{1}}` של תבנית אחת, והתבנית
 * מוסיפה סביבו פתיח קבוע וסיומת הסרה.
 *
 * ⚠️⚠️ **ומכאן המגבלה שנראית שרירותית: אין ירידות שורה בהודעה.**
 * פרמטר בתבנית אינו יכול להכיל תו שורה חדשה, טאב, או יותר מארבעה
 * רווחים רצופים — מטא דוחים את השליחה. הנרמול קורה כאן, לפני
 * ההכנסה לתור, כדי שמה שהמשתמש רואה בתצוגה המקדימה הוא בדיוק מה
 * שיוצא. שקט על זה היה מייצר "שלחתי ונדחה" בלי הסבר.
 */

export const BROADCAST_TEMPLATE = {
  name: "broadcast_he",
  language: "he",
  /*
   * ⚠️ MARKETING ולא UTILITY. הודעה שאינה נובעת מפעולה של הלקוח היא
   * שיווקית בעיני מטא, ותבנית שהוגשה בקטגוריה נוחה יותר נדחית
   * ב-`INCORRECT_CATEGORY` — או גרוע מזה, מסווגת מחדש אחרי אישור.
   */
  category: "MARKETING",
} as const;

/**
 * גוף התבנית כפי שהוגש למטא. **חייב להישאר זהה לתבנית שאושרה.**
 *
 * ⚠️ הפתיח והסיומת קבועים ולא במקרה: מטא דוחים גוף שהוא משתנה בלבד,
 * וגם דורשים דרך הסרה בהודעה שיווקית. `{{1}}` באמצע הוא כל מה
 * שהמשתמש כותב.
 */
export const BROADCAST_TEMPLATE_BODY = `שלום, כאן ONE STOP.

{{1}}

לפרטים אפשר להשיב להודעה זו. להסרה מרשימת התפוצה השיבו "הסר".`;

/**
 * אורך מרבי להודעה.
 *
 * גוף תבנית מוגבל ל-1024 תווים **אחרי** המילוי, והפתיח והסיומת
 * אוכלים כ-120. 850 משאיר מרווח ולא מתקרב לקצה.
 */
export const BROADCAST_MAX_CHARS = 850;

/**
 * הטקסט כפי שייכנס לפרמטר התבנית.
 *
 * ⚠️ מאחד כל רצף רווחים — כולל ירידות שורה — לרווח בודד. זו לא
 * העדפת עיצוב אלא הדרישה של מטא (ראה הערת הפתיחה).
 */
export function normalizeBroadcastText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** ההודעה המלאה כפי שהלקוח יראה אותה, לתצוגה מקדימה בלבד. */
export function renderBroadcastPreview(raw: string): string {
  return BROADCAST_TEMPLATE_BODY.replace(
    "{{1}}",
    normalizeBroadcastText(raw) || "…",
  );
}

/**
 * מפתח הדדופ. הקמפיין והמספר יחד — אותה רשימה שנשלחת פעמיים
 * בטעות אינה מייצרת הודעה שנייה, ומספר שמופיע פעמיים ברשימה
 * נכנס פעם אחת.
 *
 * ⚠️ **התחילית `broadcast:` היא מה שקובע שההודעה תצא כתבנית**
 * (`templateFor` ב-drain.ts). שינוי שלה כאן שובר את השליחה בשקט.
 */
export function broadcastDedupeKey(campaignId: string, phone: string): string {
  return `broadcast:${campaignId}:${phone}`;
}

export interface ParsedPhones {
  /** E.164 בלי הפלוס, ייחודי, לפי סדר ההופעה */
  valid: string[];
  /** מה שלא הצלחנו לפענח — מוצג למשתמש כדי שיתקן ולא ינחש */
  invalid: string[];
  /** כמה מספרים חזרו על עצמם ואוחדו */
  duplicates: number;
}

/**
 * רשימת מספרים מהדבקה חופשית.
 *
 * ⚠️⚠️ **הפיצול דו-שלבי, ולא ביטוי אחד שמפריד על כל תו שאינו ספרה.**
 * ניסיון כזה היה הראשון, והוא שבר בדיוק את הצורה הנפוצה ביותר:
 * `050-714-1099` התפרק לשלושה "מספרים" פסולים. אבל גם ההפך לא עובד —
 * הדבקה מאקסל מפרידה ברווח בלבד, ורווח כמפריד היה שובר את
 * `054 999 8877`.
 *
 * לכן: קודם מפרידים על מה שהוא **תמיד** מפריד (שורה, פסיק, נקודה
 * ופסיק, טאב), ורק אם החלק כולו אינו מספר תקין מנסים לפצל אותו
 * ברווחים. מה שנשאר פסול מוחזר למשתמש כדי שיתקן — ולא מנוחש.
 */
export function parsePhoneList(raw: string): ParsedPhones {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  const take = (token: string): boolean => {
    const local = normalizeIsraeliPhone(token);
    if (!local) return false;

    const e164 = toE164(local);
    if (seen.has(e164)) duplicates++;
    else {
      seen.add(e164);
      valid.push(e164);
    }
    return true;
  };

  for (const part of raw.split(/[\n\r,;|\t]+/)) {
    const chunk = part.trim();
    if (!chunk || !/\d/.test(chunk)) continue;

    if (take(chunk)) continue;

    for (const token of chunk.split(/\s+/)) {
      if (!/\d/.test(token)) continue;
      if (!take(token)) invalid.push(token);
    }
  }

  return { valid, invalid, duplicates };
}
