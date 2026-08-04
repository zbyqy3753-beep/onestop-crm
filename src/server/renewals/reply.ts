import { dayKey, instantFromIsraelDateTime, startOfDay } from "@/lib/tz";

/**
 * פענוח תשובת לקוח בוואטסאפ.
 *
 * ⚠️ **הכלל המנחה: בספק — לא לנחש.** הקלט הוא טקסט חופשי מאדם אמיתי,
 * והמחיר של טעות אינו סימטרי. "לא הבנתי, תעביר לבן אדם" עולה דקה של
 * עובד; "הבנתי לא נכון" מייצר שיחה שנקבעה לשעה שהלקוח לא ביקש, או
 * גרוע מזה — התעלמות מבקשת הסרה. לכן כל מקרה מעורפל חוזר `unclear`
 * ולא ניחוש סביר.
 *
 * הקובץ טהור ובלי `server-only` בכוונה: זו הלוגיקה שתצטרך הכי הרבה
 * כוונון מול הודעות אמיתיות, וכזו חייבת להיות ניתנת להרצה בבדיקה.
 */

export type ReplyIntent =
  | { kind: "optOut" }
  | { kind: "decline" }
  | { kind: "time"; at: number; label: string }
  | { kind: "unclear" };

/**
 * בקשת הסרה.
 *
 * ⚠️ נבדקת **ראשונה ולפני הכול**. "אל תשלחו לי יותר, לא מעוניין" הוא
 * גם סירוב וגם הסרה, וההסרה היא החובה החוקית — לכן היא גוברת. סדר
 * הפוך היה מסווג את ההודעה כסירוב ומשאיר את הלקוח ברשימת הדיוור.
 */
const OPT_OUT = [
  "הסר",
  "הסירו",
  "תסיר",
  "תסירו",
  "להסיר",
  "הורד אותי",
  "תורידו אותי",
  "אל תשלח",
  "אל תשלחו",
  "די לשלוח",
  "תפסיקו",
  "stop",
  "unsubscribe",
];

const DECLINE = [
  "לא מעוניין",
  "לא מעוניינת",
  "לא מענין",
  "לא רוצה",
  "לא צריך",
  "לא צריכה",
  "לא תודה",
  "אין צורך",
  "לא רלוונטי",
];

/** שעות שבהן סביר לקבוע שיחה. מחוצה להן לא מתאמים אוטומטית. */
const EARLIEST_HOUR = 8;
const LATEST_HOUR = 21;

/** מילות חלק-יום → השעה שהן מייצגות. */
const DAY_PARTS: { words: string[]; hour: number }[] = [
  { words: ["בבוקר", "בוקר"], hour: 9 },
  { words: ["בצהריים", "צהריים", "צוהריים"], hour: 13 },
  { words: ["אחר הצהריים", "אחהצ", "אחה״צ", "אחרי הצהריים"], hour: 16 },
  { words: ["בערב", "ערב"], hour: 19 },
];

/**
 * מילים שמסמנות לילה.
 *
 * ⚠️ אין להן שעה — הן פוסלות את ההודעה. "ב-3 בלילה" הוא מחוץ לשעות
 * הפעילות בכל פירוש, אבל בלי החריג הזה כלל המספר הבודד היה מקדם
 * את ה-3 ל-15:00 וקובע שיחה לשלוש אחר הצהריים. זה לא נראה כמו טעות
 * במסך — זו פשוט שעה סבירה שאיש לא ביקש.
 */
const NIGHT_WORDS = ["בלילה", "לילה", "חצות", "לפנות בוקר"];

/** מילות יום → כמה ימים קדימה. */
const DAY_OFFSETS: { words: string[]; days: number }[] = [
  { words: ["היום"], days: 0 },
  { words: ["מחר"], days: 1 },
  { words: ["מחרתיים", "מחרתים"], days: 2 },
];

/** שמות ימי השבוע → אינדקס (0 = ראשון). */
const WEEKDAYS: Record<string, number> = {
  ראשון: 0,
  שני: 1,
  שלישי: 2,
  רביעי: 3,
  חמישי: 4,
  שישי: 5,
  שבת: 6,
};

function normalize(raw: string): string {
  return raw
    .replace(/[‎‏]/g, "") // סימני כיווניות שוואטסאפ מוסיף
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * היום הקלנדרי בישראל, `n` ימים קדימה.
 *
 * ⚠️ עוגן צהריים ולא `startOfDay + n*86400000`. במעבר שעון קיץ יממה
 * אינה 24 שעות, וחיבור פשוט היה מדלג על יום או חוזר עליו — בדיוק
 * פעמיים בשנה, ובשקט.
 */
function dayKeyPlus(now: number, days: number): string {
  const noonToday = startOfDay(now) + 12 * 3_600_000;
  return dayKey(noonToday + days * 86_400_000);
}

/** כמה ימים קדימה עד יום השבוע הבא שנקרא בשמו. */
function daysUntilWeekday(now: number, target: number): number {
  // `dayKey` → יום בשבוע, דרך אמצע היום כדי לא ליפול על גבול
  const todayIdx = new Date(startOfDay(now) + 12 * 3_600_000).getUTCDay();
  const diff = (target - todayIdx + 7) % 7;
  // "ביום שני" כשהיום שני = שבוע הבא, לא היום
  return diff === 0 ? 7 : diff;
}

interface TimeGuess {
  hour: number;
  minute: number;
}

/**
 * השעה מתוך הטקסט.
 *
 * ⚠️ מספר בודד הוא הדבר הכי מעורפל כאן. "ב-5" בהקשר של שיחת מכירה
 * הוא כמעט תמיד 17:00 ולא 05:00, ולכן 1–7 מתפרשים כאחר הצהריים.
 * 8–12 נשארים כפי שהם — "ב-10" הוא בוקר. כל השאר נדחה.
 */
/**
 * האם שעה נמוכה צריכה להיקרא כאחר הצהריים.
 *
 * ⚠️ 1–7 בהקשר של תיאום שיחת מכירה הם כמעט תמיד אחר הצהריים. אף לקוח
 * לא מתכוון ל-03:00 לפנות בוקר כשהוא כותב "ב-3".
 *
 * מילת בוקר מפורשת גוברת: "3 בבוקר" נשאר 3, וייפסל אחר כך כי הוא
 * מחוץ לשעות הפעילות — וזה הנכון, כי זו באמת בקשה מוזרה.
 */
function toAfternoon(hour: number, morning: boolean): number {
  if (morning) return hour;
  return hour >= 1 && hour <= 7 ? hour + 12 : hour;
}

function extractTime(text: string): TimeGuess | null {
  const part = DAY_PARTS.find((p) => p.words.some((w) => text.includes(w)));
  const morning = part?.hour !== undefined && part.hour < 12;

  // שעה מפורשת: 17:00 / 17.30 / 9:15
  const explicit = /(\d{1,2})[:.](\d{2})/.exec(text);
  if (explicit) {
    const raw = explicit[1];
    const minute = Number(explicit[2]);
    let hour = Number(raw);
    if (hour > 23 || minute > 59) return null;

    /*
     * ⚠️ "3:00" מקבל את אותו טיפול כמו "3" — הוא 15:00.
     *
     * **אלא אם** נכתב עם אפס מוביל: מי שכותב "07:30" חושב בשעון
     * 24 שעות ומתכוון לבוקר, ומי שכותב "7:30" מתכוון לערב. האפס
     * המוביל הוא הסימן היחיד שמבדיל ביניהם.
     */
    const paddedTo24h = raw.length === 2 && raw.startsWith("0");
    if (!paddedTo24h) hour = toAfternoon(hour, morning);

    return { hour, minute };
  }

  /*
   * מספר בודד.
   *
   * ⚠️ lookbehind ולא `(?:^|\s|-)`. הגרסה הקודמת דרשה רווח או מקף
   * לפני הספרה, ולכן **"אפשר ב3" לא נקרא בכלל** — צורת כתיבה נפוצה
   * לגמרי בעברית, שבה האות נדבקת לספרה. עכשיו נדרש רק שהתו הצמוד
   * לא יהיה ספרה או סימן שעה, כדי לא לחטוף חצי מ-"17:00".
   */
  const bare = /(?<![\d:.])(\d{1,2})(?![\d:.])/.exec(text);
  if (bare) {
    const hour = Number(bare[1]);
    if (hour > 23) return null;

    if (part && part.hour >= 12 && hour < 12) {
      // "5 בערב" — חלק היום מכריע
      return { hour: hour + 12, minute: 0 };
    }
    return { hour: toAfternoon(hour, morning), minute: 0 };
  }

  // "בערב" בלי מספר בכלל
  if (part) return { hour: part.hour, minute: 0 };

  return null;
}

/** תווית עברית קריאה למועד שנקבע, לשימוש בהודעת האישור. */
function labelFor(instant: number, now: number): string {
  const hhmm = new Date(instant)
    .toLocaleTimeString("he-IL", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

  const key = dayKey(instant);
  if (key === dayKeyPlus(now, 0)) return `היום בשעה ${hhmm}`;
  if (key === dayKeyPlus(now, 1)) return `מחר בשעה ${hhmm}`;

  // he-IL כבר מחזיר "יום חמישי" — הוספת "ביום" לפניו נתנה "ביום יום חמישי"
  const dayName = new Date(instant).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
  });
  return `ב${dayName} בשעה ${hhmm}`;
}

export function parseReply(body: string, now = Date.now()): ReplyIntent {
  const text = normalize(body);
  if (!text) return { kind: "unclear" };

  // ראשון בכוונה — ראה ההערה על OPT_OUT
  if (OPT_OUT.some((w) => text.includes(w))) return { kind: "optOut" };
  if (DECLINE.some((w) => text.includes(w))) return { kind: "decline" };

  // ראה ההערה על NIGHT_WORDS — נבדק לפני חילוץ השעה, לא אחריו
  if (NIGHT_WORDS.some((w) => text.includes(w))) return { kind: "unclear" };

  const time = extractTime(text);
  if (!time) return { kind: "unclear" };

  if (time.hour < EARLIEST_HOUR || time.hour >= LATEST_HOUR) {
    // שעה מחוץ לשעות פעילות — אדם יחליט מה לעשות איתה
    return { kind: "unclear" };
  }

  // איזה יום
  let days: number | null = null;
  const named = DAY_OFFSETS.find((d) => d.words.some((w) => text.includes(w)));
  if (named) {
    days = named.days;
  } else {
    for (const [word, idx] of Object.entries(WEEKDAYS)) {
      if (text.includes(word)) {
        days = daysUntilWeekday(now, idx);
        break;
      }
    }
  }

  /*
   * בלי ציון יום — היום אם השעה עוד לפנינו, אחרת מחר. זו ההנחה
   * הטבעית: מי שכותב "ב-5" ב-14:00 מתכוון להיום, ומי שכותב את זה
   * ב-18:00 מתכוון למחר.
   */
  if (days === null) {
    const todayAt = instantFromIsraelDateTime(
      dayKeyPlus(now, 0),
      time.hour,
      time.minute,
    );
    days = todayAt !== null && todayAt > now + 10 * 60_000 ? 0 : 1;
  }

  const at = instantFromIsraelDateTime(
    dayKeyPlus(now, days),
    time.hour,
    time.minute,
  );
  if (at === null) return { kind: "unclear" };

  // מועד שכבר עבר הוא סימן שהפענוח שגוי, לא בקשה תקינה
  if (at <= now) return { kind: "unclear" };

  return { kind: "time", at, label: labelFor(at, now) };
}
