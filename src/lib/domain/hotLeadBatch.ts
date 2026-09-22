/**
 * ── מקבץ לידים חמים ───────────────────────────────────────────────────
 *
 * ⚠️ **מודול טהור, בלי שום ייבוא** — אותו שיקול כמו ב-`alerts.ts`:
 * רק מודול שעומד בפני עצמו נפתר על ידי מריץ הבדיקות של Node.
 *
 * ⚠️⚠️ **למה בכלל לאחד.** התבנית `lead_hot_he` רשומה במטא כ-MARKETING,
 * ולכן היא כפופה למגבלת ההודעות השיווקיות **לנמען**. עובד שמקבל הרבה
 * לידים ביום חוצה את המכסה האישית שלו, ומטא מפילה את השאר בשקט
 * ב-"This message was not delivered to maintain healthy ecosystem
 * engagement". המכסה גם נשחקת ככל שנשלח יותר ובפרט כשהנמען לא עונה —
 * וההתראות האלה חד-כיווניות מעצם טבען.
 *
 * הסיווג עצמו אינו ניתן לתיקון מהקוד: מטא מסרבת לשנות קטגוריה של
 * תבנית מאושרת, ושלוש תבניות חדשות בניסוחים שונים סווגו מחדש
 * ל-MARKETING אוטומטית. מה שכן בשליטתנו הוא **מספר ההודעות**.
 *
 * על 30 יום של נתוני ייצור: חלון של חמש דקות מכווץ 153 הודעות ל-77,
 * והמקסימום שנצפה בחלון אחד הוא שישה לידים.
 */

/**
 * כמה זמן מקבץ נשאר פתוח.
 *
 * ⚠️ חמש דקות, וזו פשרה מכוונת בין שני כשלים: חלון קצר מדי כמעט לא
 * מאחד, וחלון ארוך פוגע בדיוק בערך של ליד חם — אדם שממש עכשיו מילא
 * טופס ועדיין ליד המכשיר. עשר דקות היו מאחדות יותר ומחזירות את
 * העובד לשיחה שכבר התקררה.
 */
export const HOT_BATCH_WINDOW_MS = 5 * 60_000;

/** כמה לידים נכנסים לרשימה עצמה לפני "ועוד N". */
export const HOT_BATCH_LIST_MAX = 10;

/**
 * ⚠️ הכותרת היא גם הסימן שהגוף הוא מקבץ. חילוץ שלא מזהה אותה מחזיר
 * פרמטרים בטוחים במקום לזרוק על שורה שכבר נשמרה.
 */
const HEAD = "לידים חמים חדשים";
const SEP = " | ";

/**
 * ניקוי ערך שנכנס לגוף המצטבר.
 *
 * ⚠️⚠️ **שתי סיבות, ושתיהן אמיתיות.**
 *
 * `|` הוא המפריד, ושם שמכיל אותו היה מזיז כל ערך אחריו. זה בדיוק
 * הבאג שקיים ב-`fields()` של `alerts.ts` — שם הוא פוגע בהודעה אחת,
 * וכאן היה הורס מקבץ שלם.
 *
 * ירידת שורה, טאב וארבעה רווחים רצופים **נדחים על ידי מטא** בפרמטר
 * תבנית. בייצור יש שמות עם רווחים כפולים, וייבוא מאקסל מביא גם
 * ירידות שורה בתוך תא. `normalizeBroadcastText` עושה בדיוק את זה
 * בנתיב הדיוור — כאן זה חסר.
 */
function clean(value: string): string {
  return value.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

/** רשומה אחת בגוף: שם ואחריו טלפון. */
function entry(leadName: string, leadPhone: string): string {
  const name = clean(leadName) || "לקוח";
  const phone = clean(leadPhone) || "—";
  return `${name} ${phone}`;
}

/** הגוף ההתחלתי, כשנפתח מקבץ חדש. */
export function hotBatchBody(leadName: string, leadPhone: string): string {
  return `${HEAD}${SEP}${entry(leadName, leadPhone)}`;
}

/**
 * מוסיפה ליד לגוף קיים.
 *
 * ⚠️ מחזירה גוף חדש ואינה משנה את הקיים — הכתיבה למסד היא של הקורא,
 * והיא זו שמותנית על `status = 'queued'`.
 */
export function hotBatchAppend(
  body: string,
  leadName: string,
  leadPhone: string,
): string {
  return `${body}${SEP}${entry(leadName, leadPhone)}`;
}

/** הרשומות שבגוף, או רשימה ריקה אם הוא אינו מקבץ. */
function entries(body: string): string[] {
  const parts = body.split("|").map((p) => p.trim());
  if (parts.length < 2 || parts[0] !== HEAD) return [];
  return parts.slice(1).filter(Boolean);
}

/** כמה לידים יש במקבץ. */
export function hotBatchCount(body: string): number {
  return entries(body).length;
}

/**
 * הפרמטרים של התבנית — מספר הלידים, והרשימה.
 *
 * ⚠️ הרשימה היא **שורה אחת מופרדת בפסיקים**, ולא שורות נפרדות: פרמטר
 * תבנית לא יכול להכיל ירידת שורה.
 *
 * ⚠️ הספירה היא של הכול, גם של מה שנחתך מהרשימה. עובד שרואה "סה״כ 12"
 * ורשימה של עשרה מבין שיש עוד; רשימה חתוכה בלי המספר היא שקר שקט.
 */
export function hotBatchParams(body: string): string[] {
  const all = entries(body);
  if (all.length === 0) return ["0", "—"];

  const shown = all.slice(0, HOT_BATCH_LIST_MAX);
  const extra = all.length - shown.length;
  const list = extra > 0
    ? `${shown.join(", ")}, ועוד ${extra}`
    : shown.join(", ");

  return [String(all.length), list];
}

/**
 * מפתח המקבץ. הזמן בתוכו הוא **מועד פתיחת המקבץ**, לא מועד השליחה.
 *
 * ⚠️ המפתח מזהה מקבץ אחד ויחיד, ולכן הוא כולל חותמת זמן: שני מקבצים
 * של אותו עובד באותו יום הם שתי הודעות נפרדות. החיפוש אחר מקבץ פתוח
 * נעשה לפי **התחילית** (`hotBatchKeyPrefix`) ולא לפי המפתח המלא.
 */
export function hotBatchDedupeKey(userId: string, openedAt: number): string {
  return `hotbatch:${userId}:${openedAt}`;
}

/** התחילית שלפיה מחפשים מקבץ פתוח של אותו עובד. */
export function hotBatchKeyPrefix(userId: string): string {
  return `hotbatch:${userId}:`;
}
