import { dayKey, instantFromIsraelDateTime, startOfDay } from "@/lib/tz";
import { SLOTS_BUTTON } from "@/lib/domain/renewalMessages";
import { slotFromRowId } from "./slots";

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
  /** ביקש לראות שעות — נשלחת אליו הרשימה */
  | { kind: "slots" }
  | { kind: "time"; at: number; label: string }
  | { kind: "unclear" };

/**
 * בקשת הסרה.
 *
 * ⚠️ נבדקת **ראשונה ולפני הכול**. "אל תשלחו לי יותר, לא מעוניין" הוא
 * גם סירוב וגם הסרה, וההסרה היא החובה החוקית — לכן היא גוברת. סדר
 * הפוך היה מסווג את ההודעה כסירוב ומשאיר את הלקוח ברשימת הדיוור.
 */
/*
 * ⚠️⚠️ **מילים שלמות ולא הכלה.** הגרסה הקודמת בדקה `includes` על כל
 * הרשימה, וזה נצפה בייצור: מספר נרשם כמוסר בגלל ההודעה "הגעתם
 * לonestop ייעוץ בתחום התקשורת" — כי `"onestop".includes("stop")`.
 * שם המותג שלנו הסיר לקוח מהדיוור. אותו דבר ל"הסר" בתוך "הסרטון".
 *
 * ⚠️ "הסרה" חייבת להופיע כאן במפורש. בהכלה היא נתפסה דרך "הסר";
 * בהתאמת מילים שלמות היא מילה אחרת לגמרי — ובלעדיה **כפתור ההסרה
 * בתבנית מפסיק לעבוד**, כי כותרתו היא "הסרה מהדיוור".
 */
const OPT_OUT_WORDS = [
  "הסר",
  "הסרה",
  "הסירו",
  "תסיר",
  "תסירו",
  "להסיר",
  "תפסיק",
  "תפסיקו",
];

/**
 * ביטויים רב-מיליים.
 *
 * ⚠️ כאן הכלה **בטוחה**: צירוף של שתי מילים לא נבלע בטעות בתוך מילה
 * אחרת, וזו הדרך היחידה לתפוס אותם גם כשיש ביניהם ניסוח שונה.
 */
const OPT_OUT_PHRASES = [
  "הורד אותי",
  "תורידו אותי",
  "אל תשלח",
  "אל תשלחו",
  "די לשלוח",
];

/**
 * מילים לועזיות, עם גבולות מילה.
 *
 * ⚠️ `\b` עובד עליהן ועל עברית לא — אותיות עבריות אינן `\w`, ולכן
 * הגבול נמצא בין כל שתי אותיות. לכן העברית מטופלת בטוקנים למעלה
 * ורק הלועזית כאן.
 */
const OPT_OUT_LATIN = /\b(stop|unsubscribe)\b/;

/** המילים בטקסט, בלי סימני פיסוק. */
function wordsOf(text: string): Set<string> {
  return new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function isOptOut(text: string): boolean {
  const words = wordsOf(text);
  return (
    OPT_OUT_WORDS.some((w) => words.has(w)) ||
    OPT_OUT_PHRASES.some((p) => text.includes(p)) ||
    OPT_OUT_LATIN.test(text)
  );
}

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

/**
 * אורך החלון שמובטח ללקוח.
 *
 * ⚠️ זו **הבטחה, לא סלוט ביומן.** אין במערכת שום מושג של "שעה תפוסה",
 * ולא אמור להיות: שני לקוחות יכולים לבחור באותה שעה בלי שום חיכוך.
 * מה שהקבוע הזה משנה הוא רק מה אנחנו מתחייבים עליו בכתב — "בין 8 ל-9"
 * במקום "ב-8". הבטחה לנקודה מדויקת נשברת בכל שיחה שנמשכת דקה יותר
 * מהצפוי, והלקוח הבא הוא זה שמרגיש את זה.
 */
const WINDOW_MINUTES = 60;

function hhmm(instant: number): string {
  return new Date(instant).toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** תווית עברית קריאה לחלון שנקבע, לשימוש בהודעת האישור. */
function labelFor(instant: number, now: number): string {
  // `LATEST_HOUR` הוא 21, ולכן החלון האחרון האפשרי נגמר ב-21:00 —
  // הוא לעולם לא חוצה חצות, ו"היום"/"מחר" נשארים נכונים לשני קצותיו
  const range = `בין ${hhmm(instant)} ל-${hhmm(instant + WINDOW_MINUTES * 60_000)}`;

  const key = dayKey(instant);
  if (key === dayKeyPlus(now, 0)) return `היום ${range}`;
  if (key === dayKeyPlus(now, 1)) return `מחר ${range}`;

  // he-IL כבר מחזיר "יום חמישי" — הוספת "ביום" לפניו נתנה "ביום יום חמישי"
  const dayName = new Date(instant).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
  });
  return `ב${dayName} ${range}`;
}

/**
 * @param payloadId מזהה השורה/הלחצן שוואטסאפ החזירו, כשהתשובה הגיעה
 *   מלחיצה ולא מהקלדה.
 */
export function parseReply(
  body: string,
  now = Date.now(),
  payloadId?: string,
): ReplyIntent {
  const text = normalize(body);

  /*
   * ⚠️ המזהה גובר על הטקסט, אבל **לא על בקשת הסרה**.
   *
   * שורה ברשימה מחזירה כותרת "16:00" בלבד — שאינה אומרת אם מדובר
   * בהיום או במחר, ואם היא תיפול לפענוח הטקסטואלי היא תוכרע לפי
   * השעה הנוכחית. המזהה נושא את הזמן המדויק שהוצע, ולכן אין כאן
   * שום ניחוש: לא חלק-יום, לא "1–7 זה אחר הצהריים", ולא גבולות
   * שעות פעילות — הרשימה מלכתחילה הציעה רק מה שתקין.
   *
   * ⚠️ עדיין נבדק שהמועד לא עבר. הודעה יכולה להמתין בתור הנכנס, או
   * להישלח שוב על ידי מטא שעות אחרי שנשלחה.
   */
  const chosen = slotFromRowId(payloadId);
  if (chosen !== null && !isOptOut(text)) {
    if (chosen <= now) return { kind: "unclear" };
    return { kind: "time", at: chosen, label: labelFor(chosen, now) };
  }

  if (!text) return { kind: "unclear" };

  // ראשון בכוונה — ראה ההערה על OPT_OUT
  if (isOptOut(text)) return { kind: "optOut" };

  /*
   * ⚠️ אחרי ההסרה ולפני הסירוב.
   *
   * הכותרת מגיעה מהתבנית המאושרת ולא מהקלדה חופשית, ולכן ההשוואה
   * בטוחה. היא נבדקת לפני `DECLINE` כי לקוח שמקליד "לתאם שעה לא
   * עכשיו" עדיין ביקש שעות — והבדיקה למטה הייתה תופסת את "לא".
   */
  if (text.includes(normalize(SLOTS_BUTTON))) return { kind: "slots" };
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
