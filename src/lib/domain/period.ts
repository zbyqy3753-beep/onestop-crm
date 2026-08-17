import { TZ } from "@/lib/tz";

/**
 * טווח התאריכים שהמסך מציג.
 *
 * ⚠️⚠️ **הטווח חותך גם את הריבועים וגם את הטבלה, מאותו מסנן.** זו לא
 * בחירת נוחות: `page.tsx` מזהיר שקוביות שמונות דבר אחד בזמן שהטבלה
 * מציגה אחר הן שני מספרים סותרים במסך אחד. לכן הטווח נכנס ל-`LeadFilter`
 * ועובר דרך `buildWhere` — הנקודה היחידה ששתי השאילתות חולקות.
 *
 * ⚠️ המדידה היא לפי `createdAt` — **מתי הליד נכנס**, לא מתי נסגר. ליד
 * שנכנס במרץ ונסגר באפריל נספר במרץ. זו החלטה מפורשת של הבעלים: המדד
 * הוא כמה לידים קיבלנו, לא כמה סגרנו.
 *
 * ⚠️⚠️ **ברירת המחדל היא החודש הנוכחי, וזו סכנה אמיתית שצריך לנטרל.**
 * ב-1 בחודש ליד פתוח מלפני חודשיים נעלם מהתור — לא נסגר, לא טופל, פשוט
 * לא מוצג. לכן `openOutsideRange` נספר בנפרד ומוצג בבורר: מסך שמסתיר
 * עבודה חייב לפחות לומר כמה הוא מסתיר. אל תסיר את הספירה הזו.
 */

export type PeriodKey =
  | "thisMonth"
  | "lastMonth"
  | "last30"
  | "thisYear"
  | "all"
  | "custom";

export interface Period {
  key: PeriodKey;
  /** ISO. `null` = בלי גבול תחתון. */
  from: string | null;
  /** ISO, **בלעדי** — ראה `monthBounds`. `null` = בלי גבול עליון. */
  to: string | null;
}

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  thisMonth: "החודש",
  lastMonth: "החודש שעבר",
  last30: "30 יום אחרונים",
  thisYear: "השנה",
  all: "כל הזמן",
  custom: "טווח מותאם",
};

/** הסדר בבורר. `custom` לא ברשימה — הוא נבחר בבחירת תאריכים. */
export const PERIOD_ORDER: PeriodKey[] = [
  "thisMonth",
  "lastMonth",
  "last30",
  "thisYear",
  "all",
];

export const DEFAULT_PERIOD: PeriodKey = "thisMonth";

/**
 * חלקי התאריך בשעון ישראל.
 *
 * ⚠️ לא `new Date().getMonth()`: השרת רץ ב-UTC, ובכל יום ראשון בחודש
 * בין חצות ל-02:00 שעון ישראל התאריך ב-UTC הוא עדיין החודש הקודם.
 * "החודש" היה מחזיר את החודש הלא נכון בדיוק בשעות שבהן מישהו בודק
 * למה המספרים התאפסו.
 */
function israelParts(at: number): { year: number; month: number; day: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = f.format(new Date(at)).split("-").map(Number);
  return { year, month, day };
}

/**
 * גבולות חודש קלנדרי בישראל, כרגעים מוחלטים.
 *
 * ⚠️ הגבול העליון **בלעדי** (תחילת החודש הבא) ולא "היום האחרון
 * 23:59:59". הגרסה הכוללת מפספסת שנייה — וליד שנקלט ב-23:59:59.4
 * בליל 31 לא נספר בשום חודש.
 */
function monthBounds(year: number, month: number): { from: string; to: string } {
  return {
    from: israelMidnight(year, month, 1),
    to:
      month === 12
        ? israelMidnight(year + 1, 1, 1)
        : israelMidnight(year, month + 1, 1),
  };
}

/**
 * חצות בישראל לתאריך נתון, כ-ISO ב-UTC.
 *
 * הזזה דו-שלבית: מפרשים את התאריך כאילו הוא UTC, מודדים כמה ישראל
 * סוטה באותו רגע, ומחסירים. עובד גם בשעון קיץ (UTC+3) וגם בחורף
 * (UTC+2) בלי טבלת מעברים.
 */
function israelMidnight(year: number, month: number, day: number): string {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offset = israelOffsetMs(naive);
  return new Date(naive - offset).toISOString();
}

function israelOffsetMs(at: number): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    f.formatToParts(new Date(at)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) === 24 ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - at;
}

/** תרגום מפתח לטווח רגעים. `custom` מטופל ב-`periodFromParams`. */
export function resolvePeriod(key: PeriodKey, now = Date.now()): Period {
  const { year, month } = israelParts(now);

  switch (key) {
    case "thisMonth":
      return { key, ...monthBounds(year, month) };
    case "lastMonth":
      return {
        key,
        ...(month === 1 ? monthBounds(year - 1, 12) : monthBounds(year, month - 1)),
      };
    case "last30":
      return {
        key,
        from: new Date(now - 30 * 86_400_000).toISOString(),
        to: null,
      };
    case "thisYear":
      return { key, from: israelMidnight(year, 1, 1), to: null };
    default:
      return { key: "all", from: null, to: null };
  }
}

/** `YYYY-MM-DD` מקלט `<input type="date">` → חצות בישראל. */
function fromDateInput(v: string | undefined, endExclusive = false): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  // ⚠️ הגבול העליון מוזז ליום הבא: המשתמש שבוחר "עד 31.8" מתכוון
  // לכלול את 31.8 כולו, ולא לעצור בחצות שלו
  return israelMidnight(y, m, endExclusive ? d + 1 : d);
}

/** ISO → `YYYY-MM-DD` בשעון ישראל, למילוי `<input type="date">`. */
export function toDateInput(iso: string | null, endExclusive = false): string {
  if (!iso) return "";
  const at = Date.parse(iso) - (endExclusive ? 1 : 0);
  const { year, month, day } = israelParts(at);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const PERIOD_PARAM = "period";
export const FROM_PARAM = "from";
export const TO_PARAM = "to";

/**
 * קריאת הטווח מפרמטרי הכתובת.
 *
 * ⚠️ הכתובת ולא state בלקוח: הטווח משנה **מה נשלף בשרת**, וכל שליפה
 * חוזרת חייבת לזכור אותו. זה גם מה שהופך חתך לניתן לשיתוף בקישור.
 *
 * ⚠️ ערך לא מוכר נופל לברירת המחדל ולא לשגיאה. פרמטר בכתובת הוא קלט
 * של המשתמש; `?period=lol` צריך להראות את החודש, לא מסך שבור.
 */
export function periodFromParams(
  params: Record<string, string | string[] | undefined>,
  now = Date.now(),
): Period {
  const raw = params[PERIOD_PARAM];
  const key = (Array.isArray(raw) ? raw[0] : raw) as PeriodKey | undefined;

  if (key === "custom") {
    const one = (v: string | string[] | undefined) =>
      Array.isArray(v) ? v[0] : v;
    const from = fromDateInput(one(params[FROM_PARAM]));
    const to = fromDateInput(one(params[TO_PARAM]), true);
    // טווח מותאם בלי אף גבול הוא "כל הזמן" שמתחזה לחתך — עדיף לומר זאת
    if (!from && !to) return resolvePeriod("all", now);
    return { key: "custom", from, to };
  }

  if (key && PERIOD_ORDER.includes(key)) return resolvePeriod(key, now);
  return resolvePeriod(DEFAULT_PERIOD, now);
}

/** תיאור קריא לטווח, לכותרות ולייצוא. */
export function periodLabel(p: Period): string {
  if (p.key !== "custom") return PERIOD_LABEL[p.key];
  const from = toDateInput(p.from);
  const to = toDateInput(p.to, true);
  if (from && to) return `${from} — ${to}`;
  return from ? `מ-${from}` : `עד ${to}`;
}
