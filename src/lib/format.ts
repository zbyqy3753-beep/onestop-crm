import type { StatusTone } from "./domain/types";

/** מיפוי טון סמנטי למחלקות Tailwind. מקור אמת יחיד לצבעי תגיות. */
export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-neutral-soft text-neutral",
  info: "bg-info-soft text-info",
  active: "bg-brand-soft text-brand",
  warn: "bg-warn-soft text-warn",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
};

/** צבע הרצועה הצדדית (`--spine-c`) לפי טון. */
export const TONE_VAR: Record<StatusTone, string> = {
  neutral: "var(--c-neutral)",
  info: "var(--c-info)",
  active: "var(--c-brand)",
  warn: "var(--c-warn)",
  good: "var(--c-good)",
  bad: "var(--c-bad)",
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

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const dateTimeFmt = new Intl.DateTimeFormat("he-IL", {
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

/** כמה זמן נותר עד תאריך עתידי. */
export function until(iso: string, now: number): string {
  const diff = Date.parse(iso) - now;
  const days = Math.ceil(diff / 86_400_000);

  if (days < 0) return `באיחור ${Math.abs(days)} ימים`;
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  return `בעוד ${days} ימים`;
}

/** 0501234567 → 050-123-4567 */
export function phone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return raw;
}

/** טלפון ישראלי תקין — אותה בדיקה שהייבוא משתמש בה. */
export function isIsraeliPhone(raw: string): boolean {
  return /^0\d{8,9}$/.test(raw.replace(/\D/g, ""));
}

/**
 * קישור וואטסאפ. wa.me דורש E.164 בלי הפלוס, ולכן האפס המוביל של
 * מספר ישראלי מוחלף בקידומת 972: 0501234567 → 972501234567.
 *
 * ההודעה עצמה מגיעה מבחוץ (`whatsappGreeting` ב-domain/types) — כאן
 * לא יושבת עברית.
 */
export function waLink(raw: string, message?: string): string {
  const d = raw.replace(/\D/g, "");
  const e164 = d.startsWith("0") ? `972${d.slice(1)}` : d;
  const base = `https://wa.me/${e164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
