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
  opts: { appUrl: string; late?: boolean },
): string {
  const scheduled = lead.followUpAt ? Date.parse(lead.followUpAt) : null;
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;
  const status = STATUS_CONFIG[lead.status];
  const priority = PRIORITY_CONFIG[lead.priority];

  const header =
    opts.late && scheduled !== null
      ? `⏰ תזכורת באיחור — הייתה אמורה לצאת ב-${israelHourMinute(scheduled)}`
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
