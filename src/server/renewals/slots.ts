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
 * טווח השעות המוצע, בחצאי שעות.
 *
 * ⚠️ 19:00 ולא 21:00 — זו שעת ההתחלה האחרונה, והחלון שמובטח נגמר
 * ב-20:00. `LATEST_HOUR` ב-`reply.ts` הוא 21 ומתיר יותר, אבל הבטחה
 * לשיחה שמתחילה ב-21:00 היא הבטחה שאיש לא יעמוד בה.
 *
 * ⚠️ חצאי שעות ולא שעות עגולות. הרשימה האינטראקטיבית לא יכלה להכיל
 * 21 שורות (תקרת מטא היא 10), ולכן הגרסה הראשונה הציעה שש שעות
 * בלבד — "אין כמעט שעות" בלשון הבעלים. ה-Flow הוא רשימה נגללת בלי
 * תקרה כזו, וזו בדיוק הסיבה שעברנו אליו.
 */
export const SLOT_START_HOUR = 9;
export const SLOT_END_HOUR = 19;
const SLOT_STEP_MINUTES = 30;

/**
 * כמה זמן קדימה שעה עדיין נחשבת זמינה.
 *
 * ⚠️ לא "מעכשיו". לקוח שמקבל הודעה ב-15:52 ורואה 16:00 ברשימה יבחר
 * בה, והנציג יקבל תזכורת לשיחה שמתחילה בעוד שמונה דקות — כשהליד
 * עוד לא שויך לאיש. שעה שלמה היא המרווח המינימלי שמאפשר לשיבוץ
 * ולתזכורת לקרות לפני השיחה.
 */
const MIN_LEAD_MS = 60 * 60_000;

/**
 * תקרת שורות.
 *
 * ⚠️ הערך הזה שייך ל**רשימה** האינטראקטיבית (`sendList`), שמטא
 * מגבילים ל-10 שורות. ה-Flow אינו כפוף לה, ולכן `buildSlots` מקבל
 * את התקרה כפרמטר במקום להניח אותה.
 */
export const LIST_MAX_ROWS = 10;

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

  for (
    let minutes = SLOT_START_HOUR * 60;
    minutes <= SLOT_END_HOUR * 60;
    minutes += SLOT_STEP_MINUTES
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const at = instantFromIsraelDateTime(key, hour, minute);
    // ⚠️ `null` הוא שעה שלא קיימת ביום הזה (מעבר שעון) — מדלגים
    if (at === null) continue;
    if (at < now + MIN_LEAD_MS) continue;
    out.push({
      at,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      day,
    });
  }

  return out;
}

/**
 * השעות שמוצעות ללקוח כרגע — היום ומחר.
 *
 * ⚠️ `max` אינו ברירת מחדל שרירותית: ה-Flow מציג את כל הרשימה בלי
 * תקרה, והרשימה האינטראקטיבית חייבת להיחתך ל-10. מי שקורא מחליט,
 * כי רק הוא יודע לאן זה נשלח.
 *
 * ⚠️ **החיתוך אוכל את "היום" ולא את "מחר".** נראה הפוך מהאינטואיציה
 * — אבל 21 חצאי שעות ליום, ותקרה של 10, היו מוחקים את המחר לגמרי
 * ומשאירים לקוח שפנוי רק מחר בלי שום אפשרות. עדיף לתת לו את מחר
 * המלא ולתת להיום את מה שנשאר.
 *
 * ⚠️ מוחזר תמיד לפחות שורה אחת — שעות המחר לעולם לא עברו.
 */
export function buildSlots(now = Date.now(), max = Infinity): Slot[] {
  const today = slotsForDay(now, 0, "today");
  const tomorrow = slotsForDay(now, 1, "tomorrow");

  if (!Number.isFinite(max)) return [...today, ...tomorrow];

  const keptTomorrow = tomorrow.slice(0, max);
  const room = Math.max(0, max - keptTomorrow.length);
  return [...today.slice(0, room), ...keptTomorrow];
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
