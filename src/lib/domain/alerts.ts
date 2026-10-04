/**
 * ── התראות ניהוליות לבעלים ─────────────────────────────────────────
 *
 * ⚠️ **מודול טהור, בלי שום ייבוא.** הוא יושב בנפרד מ-`whatsapp.ts`
 * דווקא מפני שזה מה שמאפשר לבדוק אותו: `whatsapp.ts` מייבא את מודל
 * הדומיין, ומריץ הבדיקות של Node לא פותר ייבוא חסר-סיומת דרך שרשרת
 * כזו. אותו שיקול כמו ב-`lib/password.ts` וב-`lib/resetCode.ts`.
 *
 * שלוש ההתראות נובעות מאותה תובנה: המערכת ידעה דברים שאיש לא ראה.
 * ליד בלי משויך שוקע בשקט, עסקה נסגרת בלי שההנהלה יודעת, וחזרה שלא
 * בוצעה נראית בדיוק כמו חזרה שבוצעה — שתיהן פשוט שורה בטבלה.
 */

/**
 * ניקוי ערך שנכנס לגוף המופרד ב-`|`.
 *
 * ⚠️⚠️ **שתי סיבות, ושתיהן נבדקו על ההתראות עצמן.**
 *
 * `|` הוא המפריד, ושם שמכיל אותו מזיז כל ערך אחריו. `yesLeadBody`
 * עם השם `"דני | כהן"` הפיק פרמטרים `["דני", "—", "0501234567"]`:
 * הטלפון נעלם, והשדה "שויך ל" הציג את מספר הטלפון. השם מגיע מטופס
 * `/lp` הציבורי שמאמת אורך בלבד, כלומר כל אחד יכול לייצר את זה.
 *
 * ירידת שורה, טאב וארבעה רווחים רצופים **נדחים על ידי מטא** בפרמטר
 * תבנית, וההתראה נכשלת בשקט. בייצור יש שמות עם רווחים כפולים,
 * וייבוא מאקסל מביא ירידות שורה בתוך תא.
 *
 * אותה פונקציה בדיוק כמו `clean` ב-`hotLeadBatch.ts` ו-
 * `normalizeBroadcastText` ב-`broadcast.ts` — שלושת הנתיבים שמזרימים
 * טקסט של משתמש לפרמטר תבנית.
 */
function cleanParam(value: string): string {
  return value.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

export const DEAL_WON_TEMPLATE = {
  name: "deal_won_he",
  language: "he",
  category: "UTILITY",
} as const;

export const FOLLOWUP_OVERDUE_TEMPLATE = {
  name: "followup_overdue_he",
  language: "he",
  category: "UTILITY",
} as const;

/** מפתח לפי אירוע הסטטוס — כל סגירה מתריעה פעם אחת לכל בעלים. */
export function dealWonDedupeKey(eventId: string, userId: string): string {
  return `dealwon:${eventId}:${userId}`;
}

/**
 * ⚠️ המפתח כולל את מועד החזרה, לא את זמן ההתראה: חזרה שנדחתה לשעה
 * אחרת היא חובה חדשה, ואילו אותה חזרה שנשארה פתוחה לא תתריע שוב.
 */
export function overdueDedupeKey(
  leadId: string,
  userId: string,
  followUpAt: Date,
): string {
  return `overdue:${leadId}:${userId}:${followUpAt.toISOString()}`;
}

export function dealWonBody(
  leadName: string,
  leadPhone: string,
  agentName: string,
): string {
  return `נסגרה עסקה | לקוח: ${cleanParam(leadName)} | טלפון: ${cleanParam(leadPhone)} | סגר: ${cleanParam(agentName)}`;
}

export function overdueBody(
  leadName: string,
  leadPhone: string,
  assignee: string,
  due: string,
): string {
  return `חזרה שלא בוצעה | לקוח: ${cleanParam(leadName)} | טלפון: ${cleanParam(leadPhone)} | אחראי: ${cleanParam(assignee)} | מועד: ${cleanParam(due)}`;
}

/**
 * ⚠️ הגוף בתור הוא snapshot מופרד ב-`|`, והפרמטרים מחולצים ממנו בזמן
 * השליחה. אותו דפוס כמו `followUpReminderParams` — ומאותה סיבה: בזמן
 * השליחה אין בידינו את הליד, רק את מה שנשמר.
 */
function fields(body: string): string[] {
  return body
    .split("|")
    .map((p) => cleanParam(p.split(":").slice(1).join(":")));
}

export function dealWonParams(body: string): string[] {
  const [name, phone, agent] = fields(body).slice(1);
  return [name || "לקוח", phone || "—", agent || "—"];
}

export function overdueParams(body: string): string[] {
  const [name, phone, assignee, due] = fields(body).slice(1);
  return [name || "לקוח", phone || "—", assignee || "—", due || "—"];
}

/**
 * ליד שנקבעה לו חזרה ואין לו משויך.
 *
 * ⚠️ **זה החור שהתבנית הזו סוגרת.** `enqueueDueFollowUps` מדלג על ליד
 * בלי משויך — בצדק, כי אין למי לשלוח וחלוקת לידים היא החלטה ניהולית.
 * אבל התוצאה הייתה שקטה: נקבעה חזרה, לא יצאה תזכורת, ואיש לא חזר
 * ללקוח. איש גם לא ידע שזה קרה.
 *
 * ⚠️ נשלחת לבעלים בלבד, וזו לא בחירה שרירותית: הם היחידים שרשאים
 * לשייך לידים, ולכן הם היחידים שההודעה הזו מבקשת מהם משהו שהם יכולים
 * לעשות.
 */
export const LEAD_UNASSIGNED_TEMPLATE = {
  name: "lead_unassigned_he",
  language: "he",
  category: "UTILITY",
} as const;

/**
 * ⚠️ המפתח כולל את מזהה הנמען **ואת מועד החזרה**: כל בעלים מקבל
 * הודעה משלו, ותזמון מחדש של אותה חזרה הוא התראה חדשה. בלי מועד
 * החזרה, ליד שנדחה מיום ליום היה מתריע פעם אחת ואז שותק.
 */
export function unassignedDedupeKey(
  leadId: string,
  userId: string,
  followUpAt: Date,
): string {
  return `unassigned:${leadId}:${userId}:${followUpAt.toISOString()}`;
}

/** הפרמטרים של התבנית — שם הבעלים, שם הלקוח, הטלפון שלו. */
export function unassignedParams(body: string): string[] {
  const m = /^שלום\s+(.+?),\s*נקבעה חזרה ללקוח\s+(.+?)\s+\((.+?)\)/.exec(
    cleanParam(body),
  );
  return m
    ? [cleanParam(m[1]!) || "מנהל", cleanParam(m[2]!) || "לקוח", cleanParam(m[3]!) || "—"]
    : ["מנהל", "לקוח", "—"];
}

/**
 * הגוף שנשמר בתור, ושממנו `unassignedParams` מחלץ בחזרה.
 *
 * ⚠️ הסוגריים כאן הם המפריד, ולכן השם מנוקה מהם: שם כמו
 * `"דני (הבית)"` הפיק פרמטרים `["אלירן", "דני", "הבית"]` — המנהל קיבל
 * "הבית" במקום הטלפון. ירידת שורה בשם הייתה גרועה יותר: הביטוי הרגולרי
 * כלל לא התאים, וההתראה יצאה כ-`["מנהל", "לקוח", "—"]`, בלי שום מידע.
 */
export function unassignedBody(
  ownerName: string,
  leadName: string,
  leadPhone: string,
): string {
  const owner = cleanParam(ownerName).replace(/[()]/g, "");
  const name = cleanParam(leadName).replace(/[()]/g, "");
  const phone = cleanParam(leadPhone).replace(/[()]/g, "");
  return `שלום ${owner}, נקבעה חזרה ללקוח ${name} (${phone}) אך הליד אינו משויך לאף עובד.`;
}

/* ── ליד חדש של יאס ───────────────────────────────────────────────────── */

/**
 * ליד של יאס נכנס והוא כבר שויך אוטומטית.
 *
 * ⚠️ **ההתראה הזו אינה מבקשת פעולה — היא מדווחת שהיא כבר נעשתה.** זה
 * ההבדל מ-`LEAD_UNASSIGNED_TEMPLATE`, ולכן זו תבנית נפרדת ולא מיחזור
 * של הקיימת: הודעה שכתוב בה "הליד אינו משויך" על ליד ששויך היא שקר
 * שגורם למנהל לפתוח את המערכת בשביל כלום.
 */
export const LEAD_YES_TEMPLATE = {
  name: "lead_yes_he",
  language: "he",
  category: "UTILITY",
} as const;

/**
 * ⚠️ המפתח הוא ליד + נמען, בלי חותמת זמן. ליד נוצר פעם אחת, ולכן
 * ההתראה יוצאת פעם אחת לכל בעלים — גם אם השורה תיכנס שוב אחרי
 * כישלון שליחה.
 */
export function yesLeadDedupeKey(leadId: string, userId: string): string {
  return `yeslead:${leadId}:${userId}`;
}

export function yesLeadBody(
  leadName: string,
  leadPhone: string,
  assigneeName: string,
): string {
  return `ליד חדש מיאס | לקוח: ${cleanParam(leadName)} | טלפון: ${cleanParam(leadPhone)} | שויך ל: ${cleanParam(assigneeName)}`;
}

/** אותו דפוס חילוץ כמו `dealWonParams` — הגוף הוא ה-snapshot. */
export function yesLeadParams(body: string): string[] {
  const [name, phone, assignee] = fields(body).slice(1);
  return [name || "לקוח", phone || "—", assignee || "—"];
}

/* ── ליד חם שהגיע לעובד ───────────────────────────────────────────────── */

/**
 * ליד חם ששויך לעובד.
 *
 * ⚠️ **חם בלבד, ובכוונה.** ליד חם הוא אדם שממש עכשיו מילא טופס או
 * דיבר עם מישהו, ושווה החזרה מיידית; רשומת דאטה קרה אינה. התראה על
 * כל שיוך הייתה הופכת תוך יומיים לרעש שמתעלמים ממנו — וזה בדיוק מה
 * שמחסל גם את ההתראות שכן חשובות.
 */
export const LEAD_HOT_TEMPLATE = {
  name: "lead_hot_he",
  language: "he",
  category: "UTILITY",
} as const;

/**
 * ⚠️ ליד + עובד, בלי חותמת זמן: מי שקיבל ליד, החזיר אותו וקיבל שוב
 * לא צריך התראה שנייה על אותו לקוח.
 *
 * ⚠️⚠️ **מאז האיחוד השורה הזו אינה נשלחת — היא סמן בלבד.** היא נוצרת
 * במצב `cancelled`, והתראה עצמה יוצאת במקבץ (`hotbatch:`). הסמן קיים
 * כדי שאילוץ הייחודיות ימשיך לאכוף את ההבטחה שלמעלה: בלעדיו איחוד
 * לחלונות היה מוריד אותה מ"פעם אחת לתמיד" ל"פעם אחת לכל חלון".
 * ראה `notifyHotLeadAssigned`.
 */
export function hotLeadDedupeKey(leadId: string, userId: string): string {
  return `hotlead:${leadId}:${userId}`;
}

/**
 * מקבץ הלידים החמים שיוצא לעובד.
 *
 * ⚠️ תבנית נפרדת ולא מיחזור של `LEAD_HOT_TEMPLATE`: מספר הפרמטרים
 * שונה (מונה ורשימה במקום שם וטלפון), ותבנית במטא היא מבנה קבוע.
 */
export const LEAD_HOT_BATCH_TEMPLATE = {
  name: "lead_hot_batch_he",
  language: "he",
  category: "UTILITY",
} as const;

export function hotLeadBody(leadName: string, leadPhone: string): string {
  return `ליד חם חדש אצלך | לקוח: ${cleanParam(leadName)} | טלפון: ${cleanParam(leadPhone)}`;
}

export function hotLeadParams(body: string): string[] {
  const [name, phone] = fields(body).slice(1);
  return [name || "לקוח", phone || "—"];
}
