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
  return `נסגרה עסקה | לקוח: ${leadName} | טלפון: ${leadPhone} | סגר: ${agentName}`;
}

export function overdueBody(
  leadName: string,
  leadPhone: string,
  assignee: string,
  due: string,
): string {
  return `חזרה שלא בוצעה | לקוח: ${leadName} | טלפון: ${leadPhone} | אחראי: ${assignee} | מועד: ${due}`;
}

/**
 * ⚠️ הגוף בתור הוא snapshot מופרד ב-`|`, והפרמטרים מחולצים ממנו בזמן
 * השליחה. אותו דפוס כמו `followUpReminderParams` — ומאותה סיבה: בזמן
 * השליחה אין בידינו את הליד, רק את מה שנשמר.
 */
function fields(body: string): string[] {
  return body.split("|").map((p) => p.split(":").slice(1).join(":").trim());
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
  const m = /^שלום\s+(.+?),\s*נקבעה חזרה ללקוח\s+(.+?)\s+\((.+?)\)/.exec(body);
  return m ? [m[1]!, m[2]!, m[3]!] : ["מנהל", "לקוח", "—"];
}

/** הגוף שנשמר בתור, ושממנו `unassignedParams` מחלץ בחזרה. */
export function unassignedBody(
  ownerName: string,
  leadName: string,
  leadPhone: string,
): string {
  return `שלום ${ownerName}, נקבעה חזרה ללקוח ${leadName} (${leadPhone}) אך הליד אינו משויך לאף עובד.`;
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
  return `ליד חדש מיאס | לקוח: ${leadName} | טלפון: ${leadPhone} | שויך ל: ${assigneeName}`;
}

/** אותו דפוס חילוץ כמו `dealWonParams` — הגוף הוא ה-snapshot. */
export function yesLeadParams(body: string): string[] {
  const [name, phone, assignee] = fields(body).slice(1);
  return [name || "לקוח", phone || "—", assignee || "—"];
}
