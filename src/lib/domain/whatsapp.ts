import type { Lead } from "./types";
import {
  LEAD_CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  PROVIDER_CONFIG,
  STATUS_CONFIG,
} from "./types";
import { phone as formatPhone } from "@/lib/format";
import { israelHourMinute } from "@/lib/tz";

/**
 * נוסח ההודעות שהבוט שולח.
 *
 * הקובץ הזה הוא מקור האמת לעברית היוצאת מהמערכת, באותו דפוס של
 * `ACTIVITY_CONFIG` ב-types.ts: פונקציה לכל סוג הודעה, בלי HTML ובלי
 * ידע על התשתית ששולחת. הבוט עצמו לא מייבא את הקובץ הזה — הוא מקבל
 * מחרוזת מוכנה מהשרת, כך ששינוי נוסח עולה ב-`git push` ולא בנסיעה
 * למחשב שבמשרד.
 *
 * ⚠️ הנמענים הם **עובדי החברה בלבד**. אין כאן ולא יהיה כאן נוסח
 * שנשלח ללקוח: כל הטיעון שהשימוש הזה לגיטימי ולא חושף את המספר
 * לחסימה נשען על כך שאלה הודעות פנימיות למי שהסכים לקבל אותן.
 */

/**
 * תו RLM לפני שורה שמתחילה בספרה.
 *
 * בוואטסאפ אין `dir="rtl"` — הטקסט מסודר לפי האלגוריתם הדו-כיווני של
 * יוניקוד לבדו, ובפסקה עברית מספר טלפון בתחילת שורה "נדבק" לצד הלא
 * נכון והשורה נראית הפוכה. זו המקבילה הטקסטואלית של `.ltr-num`.
 */
const RLM = "‏";

/** שורה עם תווית ותוכן, מדולגת כשאין תוכן. */
function line(label: string, value: string | undefined): string | null {
  return value ? `${RLM}${label}: ${value}` : null;
}

/**
 * מה הליד רוצה — קטגוריה, ספק וחבילה במחרוזת אחת.
 *
 * אותה לוגיקה כמו בכרטיס הליד: הספק והחבילה מוצגים יחד, כי הם מגיעים
 * מהשותף כמחרוזת אחת ("ULTIMATE – YES") ונשמרים בשתי עמודות.
 */
function interestOf(lead: Lead): string | undefined {
  const parts = [
    lead.category ? LEAD_CATEGORY_CONFIG[lead.category].label : "",
    [
      lead.currentProvider ? PROVIDER_CONFIG[lead.currentProvider].label : "",
      lead.packageName?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : undefined;
}

/** קיצור טקסט חופשי כדי שהודעה לא תתפח בגלל הערה ארוכה. */
function clamp(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * תזכורת חזרה לעובד המשויך.
 *
 * מה שנכנס פנימה הוא מה שנדרש כדי להרים טלפון בלי לפתוח את המערכת:
 * שם, מספר, מה הוא רצה, ומה נאמר בשיחה הקודמת. `late` מסמן תזכורת
 * שיצאה באיחור (המחשב במשרד היה כבוי) — בלי זה העובד מקבל "עכשיו"
 * על משהו שהיה אמור לצאת לפני שעתיים.
 */
export function followUpReminder(
  lead: Lead,
  opts: { appUrl: string; late?: boolean; leadMinutes?: number },
): string {
  const scheduled = lead.followUpAt ? Date.parse(lead.followUpAt) : null;
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;
  const status = STATUS_CONFIG[lead.status];
  const priority = PRIORITY_CONFIG[lead.priority];

  /*
   * ⚠️ הכותרת **חייבת** לומר את השעה כשההודעה מוקדמת.
   *
   * "תזכורת חזרה" סתם, שמגיעה עשר דקות לפני, קוראת כמו "תחזור עכשיו"
   * — והעובד או מחייג מוקדם מדי או מניח שיש לו זמן ומאחר. השעה
   * בכותרת היא ההבדל בין הקדמה מועילה להודעה מבלבלת.
   */
  const at = scheduled !== null ? israelHourMinute(scheduled) : null;
  const ahead = opts.leadMinutes ?? 0;

  const header =
    opts.late && at
      ? `⏰ תזכורת באיחור — החזרה הייתה ב-${at}`
      : ahead > 0 && at
        ? `⏰ חזרה בעוד ${ahead} דק׳ — ${at}`
        : at
          ? `⏰ תזכורת חזרה — ${at}`
          : "⏰ תזכורת חזרה";

  const body = [
    header,
    "",
    `${RLM}${lead.name}`,
    `${RLM}${formatPhone(lead.phone)}`,
    line("מתעניין ב", interestOf(lead)),
    line("סטטוס", status.label),
    lead.priority === "normal" ? null : line("עדיפות", priority.label),
    lastDetail ? line("לאחרונה", clamp(lastDetail)) : null,
    "",
    opts.appUrl,
  ].filter((l): l is string => l !== null);

  return body.join("\n");
}

/**
 * התבנית המאושרת שדרכה התזכורת יוצאת ב-Cloud API.
 *
 * ⚠️⚠️ **גם הודעה פנימית לעובד היא הודעה שאנחנו יוזמים.** מטא לא
 * מבחינים בין עובד ללקוח — טקסט חופשי מותר רק בתוך 24 שעות מרגע
 * שהנמען כתב לנו, והעובד לא כותב לבוט. בלי התבנית התזכורות פשוט
 * נדחות בשגיאה 131047, וזה נראה בדיוק כמו "לא היו תזכורות".
 *
 * UTILITY ולא MARKETING: זו הודעה תפעולית על משימה שכבר נקבעה
 * במערכת, לא פנייה שיווקית. הקטגוריה היא גם מה שקובע את המחיר.
 */
export const FOLLOWUP_REMINDER_TEMPLATE = {
  name: "followup_reminder_he",
  language: "he",
  category: "UTILITY",
} as const;

/**
 * קוד שחזור סיסמה.
 *
 * ⚠️ **AUTHENTICATION ולא UTILITY, ולא מרצון.** מטא מסווגת כל הודעת
 * איפוס סיסמה לקטגוריה הזו, ותבנית שהוגשה כ-UTILITY נדחית ב-
 * `INCORRECT_CATEGORY`. וקטגוריית האימות **אינה מרשה כפתור URL** —
 * רק העתקת קוד. זו הסיבה שהזרימה מעבירה קוד בן 6 ספרות ולא קישור:
 * אילוץ פלטפורמה, לא העדפה.
 *
 * ⚠️ הגוף והפוטר נכתבים על ידי מטא ולא על ידינו — בקטגוריה הזו אין
 * טקסט חופשי. אין מה לערוך כאן בלי ליצור תבנית חדשה.
 */
export const PASSWORD_RESET_CODE_TEMPLATE = {
  name: "password_reset_code_he",
  language: "he",
  category: "AUTHENTICATION",
} as const;

/** מפתח הדדופ של הודעת קוד. מזהה השורה מבטיח ייחודיות לכל הנפקה. */
export function resetCodeDedupeKey(resetId: string): string {
  return `pwcode:${resetId}`;
}

/**
 * ההתראה שקודמת לקוד.
 *
 * ⚠️ **בלעדיה העובד פשוט מוצא את עצמו מנותק בלי הסבר**, ומניח שהמערכת
 * נשברה. ההתראה היא מה שהופך "אני לא מצליח להיכנס" ל"אני יודע מה
 * לעשות", והיא גם מה שמונע גל שיחות למנהל.
 *
 * ⚠️ **אין בה קוד ואין בה קישור אישי** — רק הסבר וכפתור למסך הכניסה.
 * זה מה שמאפשר לה להיות UTILITY: ברגע שיש בה סוד כלשהו מטא מסווגת
 * אותה כ-Authentication, ואז כפתור URL אסור בה (זו בדיוק הדחייה
 * שקיבלנו על `password_reset_he`).
 */
export const PASSWORD_RESET_NOTICE_TEMPLATE = {
  name: "password_reset_notice_he",
  language: "he",
  category: "UTILITY",
} as const;

/** מפתח הדדופ של ההתראה. חותמת הזמן מבדילה בין מבצעי איפוס. */
export function resetNoticeDedupeKey(userId: string, at: Date): string {
  return `pwnotice:${userId}:${at.toISOString()}`;
}

/**
 * הפרמטרים של התבנית, מחולצים מהגוף שכבר רונדר.
 *
 * ⚠️⚠️ **חייב להישאר צמוד ל-`followUpReminder` שמעליו.** הגוף נשמר
 * ב-DB כ-snapshot (ראה schema.prisma › WhatsAppMessage), ולכן בזמן
 * השליחה אין לנו את הליד — רק את הטקסט. שינוי במבנה שם ישבור את
 * החילוץ כאן בשקט, ולכן שתי הפונקציות חיות זו לצד זו.
 *
 * ⚠️ מטא דוחים פרמטר ריק ופרמטר שמכיל שורה חדשה. לכן כל ערך נופל
 * למחרוזת ניטרלית, ושורות הפירוט מתאחדות לשורה אחת עם " · ".
 *
 * ⚠️ שורת הקישור שבסוף הגוף **לא** נכנסת לפרמטרים: בתבנית יש כפתור
 * URL קבוע במקומה.
 */
export function followUpReminderParams(
  body: string,
): [string, string, string, string] {
  const lines = body.split("\n").map((l) => l.replace(/‏/g, "").trim());

  // הכותרת נושאת את כל ה"מתי" — "תזכורת חזרה — 16:30", "תזכורת באיחור
  // — החזרה הייתה ב-16:30", "חזרה בעוד 10 דק׳ — 16:30". התבנית מקבלת
  // אותה כפרמטר שלם ולא רק את השעה, אחרת ההבחנה ביניהן נעלמת.
  const header = (lines[0] ?? "").replace(/^⏰\s*/, "").trim();

  // הגוף מתחיל אחרי השורה הריקה שמפרידה מהכותרת: שם, טלפון, ואז
  // שורות הפירוט — עד השורה הריקה הבאה, שאחריה יושב רק הקישור.
  const blank = lines.indexOf("", 1);
  const rest = lines.slice(blank === -1 ? 2 : blank + 1);
  const stop = rest.indexOf("");
  const [name, phone, ...details] = stop === -1 ? rest : rest.slice(0, stop);

  return [
    header || "תזכורת חזרה",
    name || "ליד ללא שם",
    phone || "—",
    details.filter(Boolean).join(" · ") || "—",
  ];
}

/**
 * הודעה לבעלים כשהבוט חוזר לפעולה אחרי נפילה.
 *
 * זו ההתראה היחידה שהבעלים באמת יראה — הוא לא יפתח את מסך הניהול
 * כדי לבדוק אם מחשב במשרד עדיין דלוק.
 */
export function botRecovered(queued: number, downMinutes: number): string {
  const down =
    downMinutes >= 60
      ? `${Math.round(downMinutes / 60)} שעות`
      : `${downMinutes} דקות`;

  return queued > 0
    ? `הבוט חזר לפעולה אחרי ${down}. ${queued} תזכורות ממתינות ויוצאות עכשיו.`
    : `הבוט חזר לפעולה אחרי ${down}. אין תזכורות ממתינות.`;
}
