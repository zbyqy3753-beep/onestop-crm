import type { StatusTone } from "./domain/types";
import { TZ, calendarDaysBetween, israelHourMinute } from "./tz";

/** מיפוי טון סמנטי למחלקות Tailwind. מקור אמת יחיד לצבעי תגיות. */
export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral-soft text-neutral",
  info: "bg-info-soft text-info",
  active: "bg-brand-soft text-brand",
  warn: "bg-warn-soft text-warn",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  signal: "bg-signal-soft text-signal",
  accent: "bg-accent-soft text-accent",
  rose: "bg-rose-soft text-rose",
};

/**
 * רקע רך לפי טון, כמשתנה CSS.
 *
 * ⚠️ קיים לצד `TONE_CLASS` ולא במקומו: `TONE_CLASS` מחזיר רקע **וטקסט**
 * כזוג מחלקות, וזה נכון לתגית. אריח סטטוס צריך את הרקע לבדו, עם צבע
 * טקסט משלו — ופיצול המחרוזת של `TONE_CLASS` היה הופך אותה לפורמט
 * שאסור לגעת בו.
 */
export const TONE_SOFT_VAR: Record<StatusTone, string> = {
  neutral: "var(--c-neutral-soft)",
  info: "var(--c-info-soft)",
  active: "var(--c-brand-soft)",
  warn: "var(--c-warn-soft)",
  good: "var(--c-good-soft)",
  bad: "var(--c-bad-soft)",
  signal: "var(--c-signal-soft)",
  accent: "var(--c-accent-soft)",
  rose: "var(--c-rose-soft)",
};

/** צבע הרצועה הצדדית (`--spine-c`) לפי טון. */
export const TONE_VAR: Record<StatusTone, string> = {
  neutral: "var(--c-neutral)",
  info: "var(--c-info)",
  active: "var(--c-brand)",
  warn: "var(--c-warn)",
  good: "var(--c-good)",
  bad: "var(--c-bad)",
  signal: "var(--c-signal)",
  accent: "var(--c-accent)",
  rose: "var(--c-rose)",
};

const shekel = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

const shekelPrecise = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
});

export function money(n: number, precise = false): string {
  return (precise ? shekelPrecise : shekel).format(n);
}

export function number(n: number): string {
  return new Intl.NumberFormat("he-IL").format(n);
}

// `timeZone` מפורש ולא ברירת המחדל של הסביבה: השרת רץ ב-UTC והדפדפן
// בשעון ישראל, כך שליד שנוצר ב-22:30 UTC הוצג "30.07" מהשרת ו-"31.07"
// אחרי ההרכבה — גם תאריך שגוי וגם אי-התאמת הידרציה.
const dateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const dateTimeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function date(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function dateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/**
 * זמן יחסי בעברית.
 *
 * ⚠️ תלוי ב"עכשיו" ולכן לא יסכים בין שרת ללקוח. חובה לקרוא לו רק
 * אחרי ההרכבה, עם `now` שנקבע ב-useEffect — ראה useNow().
 */
export function relative(iso: string, now: number): string {
  const diff = now - Date.parse(iso);
  const min = Math.round(diff / 60_000);

  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק׳`;

  const hours = Math.round(min / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;

  const days = Math.round(hours / 24);
  if (days === 1) return "אתמול";
  if (days < 30) return `לפני ${days} ימים`;

  const months = Math.round(days / 30);
  if (months < 12) return `לפני ${months} חוד׳`;

  return date(iso);
}

/**
 * כמה זמן נותר עד תאריך עתידי, בימי לוח.
 *
 * ⚠️ ימי לוח ולא הפרש שעות. הגרסה הקודמת חישבה
 * `Math.ceil(diff / 86_400_000)`, ולכן תזכורת שנקבעה ל**היום** ב-09:00
 * הוצגה "מחר" כל עוד השעה הייתה לפני 09:00 — בזמן שהמסנן "לחזור היום"
 * כן כלל אותה. אותו ליד, שתי אמירות סותרות באותו מסך.
 *
 * היום ומחר נושאים גם שעה: מרגע שהיא ניתנת לבחירה היא הנתון המבצעי —
 * "היום" לבדו לא אומר אם להרים טלפון עכשיו. מעבר ליומיים היא רעש.
 */
export function until(iso: string, now: number): string {
  const instant = Date.parse(iso);
  const days = calendarDaysBetween(now, instant);

  if (days < 0) return `באיחור ${Math.abs(days)} ימים`;
  if (days === 0) return `היום ${israelHourMinute(instant)}`;
  if (days === 1) return `מחר ${israelHourMinute(instant)}`;
  return `בעוד ${days} ימים`;
}

/** 0501234567 → 050-123-4567 */
export function phone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return raw;
}

/**
 * מספר שהגיע מקובץ → מספר ישראלי תקין, או null אם אי אפשר.
 *
 * ⚠️ קיים בגלל אקסל, לא בגלל המשתמש. תא עם 0501234567 שנשמר כמספר
 * מאבד את האפס המוביל ומגיע כ-501234567 — כל הקובץ נראה פסול בזמן
 * שכל מספר בו תקין. מה שמוחזר כאן הוא הצורה שהמערכת מכירה, וממנה
 * ואילך אין הבדל בין קובץ שנשמר כטקסט לקובץ שנשמר כמספר.
 *
 * הקידומות אינן ניחוש: 5 ו-7 הן הסלולר והוירטואלי, 2/3/4/8/9 הן
 * הקווים הנייחים לפי אזור, ו-77 הוא VoIP. מספר שלא נופל על אחת מהן
 * מוחזר כ-null במקום להשלים לו אפס ולהמציא מספר שלא קיים.
 */
export function normalizeIsraeliPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // +972 / 00972 — הצורה שמגיעה מיצוא של אנשי קשר או מוואטסאפ
  const local = /^(?:00)?972/.test(digits)
    ? `0${digits.replace(/^(?:00)?972/, "")}`
    : digits;

  if (/^0\d{8,9}$/.test(local)) return local;

  // בלי האפס המוביל: סלולרי/וירטואלי (9 ספרות) או נייח (8 ספרות)
  if (/^[57]\d{8}$/.test(local) || /^[23489]\d{7}$/.test(local)) {
    return `0${local}`;
  }

  return null;
}

/** טלפון ישראלי תקין — אותה בדיקה שהייבוא משתמש בה. */
export function isIsraeliPhone(raw: string): boolean {
  return /^0\d{8,9}$/.test(raw.replace(/\D/g, ""));
}

/**
 * מספר ישראלי → E.164 בלי הפלוס: 0501234567 → 972501234567.
 *
 * מחולץ מ-`waLink` כי הבוט צריך את המספר עצמו ולא קישור — וואטסאפ
 * מזהה נמען לפי המספר הזה בדיוק.
 */
export function toE164(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("0") ? `972${d.slice(1)}` : d;
}

/**
 * קישור וואטסאפ. wa.me דורש E.164 בלי הפלוס.
 *
 * ההודעה עצמה מגיעה מבחוץ (`whatsappGreeting` ב-domain/types) — כאן
 * לא יושבת עברית.
 */
export function waLink(raw: string, message?: string): string {
  const base = `https://wa.me/${toE164(raw)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * רשימת טלפונים שהוקלדה בשדה אחד → מספרים מנורמלים.
 *
 * מקבלת פסיק, נקודה-פסיק, שורה חדשה או רווח כמפריד: השדה הזה ממולא
 * בהדבקה מאנשי קשר או מוואטסאפ, ואף אחד לא יזכור באיזה תו להפריד.
 *
 * ⚠️ מחזירה גם את מה שנפסל ולא רק את התקין. הודעה "מספר לא תקין"
 * שאינה אומרת **איזה** מספר, בשדה שמכיל שלושה, היא חידה.
 *
 * ⚠️ כפילויות מוסרות: אותו מספר פעמיים היה גורר שתי הודעות זהות על
 * כל התראה.
 */
export function parsePhoneList(raw: string): {
  phones: string[];
  invalid: string[];
} {
  const phones: string[] = [];
  const invalid: string[] = [];

  for (const part of raw.split(/[,;\n\r\t ]+/)) {
    const token = part.trim();
    if (!token) continue;

    const normalized = normalizeIsraeliPhone(token);
    if (!normalized) invalid.push(token);
    else if (!phones.includes(normalized)) phones.push(normalized);
  }

  return { phones, invalid };
}
