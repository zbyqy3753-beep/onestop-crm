import { dayKey, instantFromIsraelDateTime, startOfDay } from "@/lib/tz";

/**
 * רשת השעות שמוצעת ללקוח כרשימה בוואטסאפ.
 *
 * ⚠️ הקובץ טהור ובלי `server-only` בכוונה, כמו `reply.ts`: זו לוגיקה
 * שתלויה בשעה הנוכחית, וכזו חייבת להיות ניתנת להרצה בבדיקה עם `now`
 * מוזרק. בדיקה שמסתמכת על השעון האמיתי עוברת בבוקר ונופלת בערב.
 *
 * ⚠️⚠️ **הרשימה נבנית ברגע השליחה ולא ברגע ההכנסה לתור.** ההודעה
 * ממתינה בתור עד שנפתח חלון השליחה ועד שהתקרה היומית מתפנה, ולכן
 * "היום 09:00" שנבנה בבוקר היה יוצא בערב כשעה שכבר עברה — כלומר
 * הודעה שמציעה ללקוח לבחור מועד בעבר. `drain.ts` קורא לכאן ברגע
 * שהוא באמת שולח.
 */

/**
 * השעות המוצעות.
 *
 * ⚠️ לא כל שעה עגולה. רשימה של ארבע-עשרה שורות היא מסך גלילה שהלקוח
 * נוטש, וההבדל בין 09:00 ל-10:00 לא מעניין אף אחד בשלב הזה — מה
 * שנקבע כאן הוא חלון של שעה ממילא (`WINDOW_MINUTES` ב-`reply.ts`).
 *
 * ⚠️ כולן בתוך 08–21, טווח השעות ש-`reply.ts` מוכן לקבוע בו שיחה.
 * שעה שתיפול מחוץ לו הייתה מוצעת ללקוח ואז נדחית כשיבחר בה.
 */
export const SLOT_HOURS = [9, 11, 13, 16, 18, 20];

/**
 * כמה זמן קדימה שעה עדיין נחשבת זמינה.
 *
 * ⚠️ לא "מעכשיו". לקוח שמקבל הודעה ב-15:52 ורואה 16:00 ברשימה יבחר
 * בה, והנציג יקבל תזכורת לשיחה שמתחילה בעוד שמונה דקות — כשהליד
 * עוד לא שויך לאיש. שעה שלמה היא המרווח המינימלי שמאפשר לשיבוץ
 * ולתזכורת לקרות לפני השיחה.
 */
const MIN_LEAD_MS = 60 * 60_000;

/** תקרת מטא לשורות ברשימה אינטראקטיבית אחת. */
const MAX_ROWS = 10;

export interface Slot {
  /** תחילת החלון, במילישניות */
  at: number;
  /** "16:00" — הכותרת שהלקוח רואה */
  label: string;
  day: "today" | "tomorrow";
}

/**
 * היום הקלנדרי בישראל, `n` ימים קדימה.
 *
 * ⚠️ עוגן צהריים ולא חיבור של 86,400,000. במעבר שעון קיץ יממה אינה
 * 24 שעות, וחיבור פשוט מדלג על יום או חוזר עליו — פעמיים בשנה,
 * ובשקט. זהה במכוון להיגיון ב-`reply.ts`.
 */
function dayKeyPlus(now: number, days: number): string {
  const noonToday = startOfDay(now) + 12 * 3_600_000;
  return dayKey(noonToday + days * 86_400_000);
}

function slotsForDay(
  now: number,
  days: number,
  day: Slot["day"],
): Slot[] {
  const key = dayKeyPlus(now, days);
  const out: Slot[] = [];

  for (const hour of SLOT_HOURS) {
    const at = instantFromIsraelDateTime(key, hour, 0);
    // ⚠️ `null` הוא שעה שלא קיימת ביום הזה (מעבר שעון) — מדלגים
    if (at === null) continue;
    if (at < now + MIN_LEAD_MS) continue;
    out.push({ at, label: `${String(hour).padStart(2, "0")}:00`, day });
  }

  return out;
}

/**
 * השעות שמוצעות ללקוח כרגע — היום ומחר.
 *
 * ⚠️ "היום" נחתך ולא "מחר". בשעות הערב נשארת מהיום שעה אחת לכל
 * היותר, ואם נחתוך את המחר הלקוח יקבל רשימה כמעט ריקה. הסדר הוא
 * מה שחשוב: מי שפנוי היום רואה את זה ראשון.
 *
 * ⚠️ מוחזר תמיד לפחות שורה אחת — שעות המחר לעולם לא עברו.
 */
export function buildSlots(now = Date.now()): Slot[] {
  const today = slotsForDay(now, 0, "today");
  const tomorrow = slotsForDay(now, 1, "tomorrow");

  const room = Math.max(0, MAX_ROWS - tomorrow.length);
  return [...today.slice(0, room), ...tomorrow];
}

/** מזהה השורה שחוזר אלינו כשהלקוח בוחר. */
export const slotRowId = (at: number) => `slot:${at}`;

/**
 * הזמן מתוך מזהה שורה, או `null` אם אינו כזה.
 *
 * ⚠️ בדיקת שפיות ולא רק פענוח: המזהה מגיע מוואטסאפ ולא מאיתנו, וערך
 * פגום שיהפוך ל-`NaN` היה נקבע כ-`followUpAt` על ליד אמיתי.
 */
export function slotFromRowId(rowId: string | undefined): number | null {
  if (!rowId?.startsWith("slot:")) return null;
  const at = Number(rowId.slice("slot:".length));
  return Number.isFinite(at) && at > 0 ? at : null;
}
