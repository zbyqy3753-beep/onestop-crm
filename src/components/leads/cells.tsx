"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Lead, LeadStatus } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  STATUS_CONFIG,
  whatsappGreeting,
  PICKABLE_STATUSES,
  RETIRED_STATUSES,
} from "@/lib/domain/types";
import { date, money, waLink } from "@/lib/format";
import { TZ, calendarDaysBetween, dateTimeInputValue, dayKey } from "@/lib/tz";
import { useBodyScrollLock } from "@/lib/overlay";
import { Badge, Button, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

/**
 * תאים ותגיות שחוזרים בכל ליד — בשורת הטבלה, בכרטיס, ובמסך "פוספסו".
 *
 * הופרדו מ-`LeadsTable` כשמספר העמודות גדל — הקובץ ההוא צריך להישאר
 * "כותרת + מיפוי שורות" וכלום מעבר לזה. מאוקטובר 2026 גם העזרים של
 * הכרטיס (גיל, "נגרר מ…", ניסיונות חיוג) חיים כאן, כדי שכרטיס, שורה
 * ומסך "פוספסו" יגידו את אותו דבר באותן מילים.
 */

/* ── עזרי זמן ונגזרות ─────────────────────────────────────────────────── */

/**
 * חותמת זמן מ-ISO, או `null` לתאריך חסר או פגום.
 *
 * ⚠️ כל פורמט תאריך (`date`, `dateTime`, `relative`, `until`,
 * `dateTimeInputValue`) זורק `RangeError` על `NaN` — `Intl.DateTimeFormat`
 * לא מחזיר "Invalid Date" אלא מפיל את הרינדור. ליד אחד עם `followUpAt`
 * פגום הפיל כך את כל מסך הלידים. כל פורמט תאריך בכרטיס ובשורה עובר דרך
 * הבדיקה הזו קודם.
 */
export function safeTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** "יום אחד" / "יומיים" / "5 ימים" — ספירת ימים בעברית תקינה. */
export function dayCount(n: number): string {
  if (n === 1) return "יום אחד";
  if (n === 2) return "יומיים";
  return `${n} ימים`;
}

/**
 * כמה זמן הליד במערכת, בימי לוח בשעון ישראל: "היום", "אתמול", "לפני
 * יומיים", "לפני 5 ימים". `null` כשתאריך הכניסה פגום.
 */
export function leadAge(createdAt: string, now: number): string | null {
  const created = safeTime(createdAt);
  if (created === null) return null;
  const days = Math.max(0, calendarDaysBetween(created, now));
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${dayCount(days)}`;
}

/** שלושת שלבי "אין מענה" — כל מעבר אליהם הוא ניסיון חיוג שלא נענה. */
const NO_ANSWER_STEPS: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  "noAnswer",
  "noAnswer1",
  "noAnswer2",
]);

/**
 * כמה פעמים חייגו ולא ענו — מעברים בהיסטוריה לאחד משלבי "אין מענה".
 *
 * נגזר מההיסטוריה ולא מהסטטוס הנוכחי: ליד שעבר "אין מענה" → "אין מענה 1"
 * → "בטיפול" ניסו לתפוס אותו פעמיים, גם אם עכשיו הוא כבר בטיפול.
 */
export function dialAttempts(lead: Lead): number {
  return (lead.history ?? []).filter((h) => NO_ANSWER_STEPS.has(h.to)).length;
}

const monthFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, month: "long" });

/**
 * "נגרר מ…" — ליד פתוח שנכנס בחודש קלנדרי קודם (שעון ישראל).
 *
 * מחזיר את שם החודש (עם שנה, כשהיא אחרת מהשנה הנוכחית), או `null` כשהליד
 * סגור, נכנס החודש, או שתאריך הכניסה שלו פגום.
 */
export function carriedFrom(lead: Lead, now: number): string | null {
  if (STATUS_CONFIG[lead.status].terminal) return null;
  const created = safeTime(lead.createdAt);
  if (created === null) return null;

  // `YYYY-MM` בשעון ישראל — השוואת מחרוזות נכונה כאן, כי הפורמט קבוע
  const from = dayKey(created).slice(0, 7);
  const current = dayKey(now).slice(0, 7);
  if (from >= current) return null;

  const month = monthFmt.format(created);
  return from.slice(0, 4) === current.slice(0, 4)
    ? month
    : `${month} ${from.slice(0, 4)}`;
}

/** ראשי תיבות לעיגול המטפל: שם פרטי + משפחה, או שתי האותיות הראשונות. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("");
  return `${[...words[0]][0]}${[...words[words.length - 1]][0]}`;
}

/* ── תגיות ────────────────────────────────────────────────────────────── */

/**
 * גיל הליד — טקסט קטן ואפור ליד השם ("היום", "לפני 3 ימים").
 *
 * ⚠️ ריק עד ההרכבה (`now === null`): הגיל נגזר מ"עכשיו", והשרת לא יכול
 * לחשב אותו בלי ליצור אי-התאמת הידרציה.
 */
export function AgeBadge({
  createdAt,
  now,
  className = "",
}: {
  createdAt: string;
  now: number | null;
  className?: string;
}) {
  if (now === null) return null;
  const label = leadAge(createdAt, now);
  if (label === null) return null;

  return (
    <span
      // `leadAge` כבר וידא שהתאריך תקין, ולכן `date()` כאן בטוח
      title={`נכנס ב-${date(createdAt)}`}
      className={`nums shrink-0 whitespace-nowrap text-xs text-ink-3 ${className}`}
    >
      <span className="sr-only">נכנס </span>
      {label}
    </span>
  );
}

/** "חם" — הטון והתווית מ-`KIND_CONFIG`, מקור האמת לסוגי ליד. */
export function HotBadge() {
  const hot = KIND_CONFIG.hot;
  return (
    <Badge tone={hot.tone}>
      <Icon name="flame" size={12} />
      {hot.short}
    </Badge>
  );
}

/** "נגרר מספטמבר" — ענבר, רק לליד פתוח מחודש קודם. ראה `carriedFrom`. */
export function CarriedBadge({ lead, now }: { lead: Lead; now: number | null }) {
  if (now === null) return null;
  const from = carriedFrom(lead, now);
  if (!from) return null;
  return <Badge tone="warn">נגרר מ{from}</Badge>;
}

/**
 * עיגול ראשי התיבות של המטפל (24px).
 *
 * ⚠️ עיגול ולא עוד טקסט אפור: שם העובד שנכתב באותו גודל וצבע של "לפני
 * 3 שע׳" נקרא כחותמת זמן. בלי שם — עיגול ענבר עם "?": ליד שאיש לא
 * מטפל בו הוא לא "מידע חסר" אלא מצב שמנהל צריך לראות.
 */
export function AssigneeAvatar({ name }: { name?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
        name ? "bg-surface-3 text-ink-2" : "bg-warn-soft text-warn"
      }`}
    >
      {name ? initials(name) : "?"}
    </span>
  );
}

/* ── פקדי עריכה במקום ─────────────────────────────────────────────────── */

/**
 * שינוי סטטוס מתוך השורה, בלי לפתוח את הליד.
 * `<select>` מקורי — נגיש במקלדת ובמובייל בלי קוד נוסף.
 */
export function StatusPicker({
  current,
  onPick,
  busy,
}: {
  current: LeadStatus;
  onPick: (to: LeadStatus) => void;
  busy?: boolean;
}) {
  const meta = STATUS_CONFIG[current];

  return (
    // אותה בעיה כמו InlinePicker: ה-<select> השקוף יורש את גודל
    // ה-badge הקטן שהוא עוטף — נמדד בפועל 43×20 בטלפון.
    <span className="relative inline-flex min-h-11 min-w-11 items-center lg:min-h-0 lg:min-w-0">
      <Badge tone={meta.tone} className="pe-4">
        {meta.label}
      </Badge>
      <Icon
        name="chevronDown"
        size={11}
        className="pointer-events-none absolute inset-y-0 end-1 my-auto opacity-50"
      />
      <select
        value={current}
        // כמו ב-InlinePicker: נעילה בזמן שמירה — לחיצה כפולה שלחה
        // את הבקשה פעמיים ופתחה מחדש את דיאלוג הסטטוס
        disabled={busy}
        onChange={(e) => onPick(e.target.value as LeadStatus)}
        aria-label="שינוי סטטוס"
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      >
        {/* בלי הסטטוסים שבוטלו (`PICKABLE_STATUSES`). ליד שעדיין יושב באחד
            מהם מקבל אותו בראש הרשימה, אחרת ה-`<select>` היה מציג ערך שאינו
            ברשימה. */}
        {(RETIRED_STATUSES.has(current)
          ? [current, ...PICKABLE_STATUSES]
          : PICKABLE_STATUSES
        ).map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * בורר כללי לעריכה מתוך השורה.
 *
 * אותו דפוס כמו `StatusPicker`: `<select>` מקורי בשקיפות 0 מעל התצוגה
 * הרגילה. זה נראה כמו טריק, וזה בכוונה — הוא נותן ניווט במקלדת, בורר
 * מקורי במובייל ותמיכה בקורא מסך בלי שורת קוד אחת של ניהול פוקוס.
 *
 * `children` הוא מה שנראה כשלא נוגעים; ה-`<select>` הוא מה שקורה
 * כשלוחצים. הערך הריק (`""`) מייצג "ללא" ומתורגם ל-`null` בשמירה.
 */
export function InlinePicker({
  value,
  options,
  onPick,
  label,
  busy,
  children,
}: {
  value: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  label: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    // ⚠️ min-h/min-w מתחת ל-lg נמדדו בפועל בכרטיס: בלי זה תא "רגיל"
    // (badge קטן, מקף) נותן ל-<select> השקוף מאחוריו איזור לחיצה של
    // 43×20 — פחות מחצי מ-44px הנדרש. lg:min-h-0 מחזיר את השולחן
    // לצפיפות המקורית, שם התא כבר בגובה שורה שלם ואין מה להרחיב.
    <span className="relative inline-flex min-h-11 min-w-11 items-center rounded pe-3.5 hover:bg-surface-3 lg:min-h-0 lg:min-w-0">
      {children}
      {/*
        ⚠️ גלוי בטלפון, מוסתר-עד-hover בשולחן.

        קודם הוא היה `opacity-0 group-hover:opacity-50` בלבד, כלומר
        **בלתי נראה לנצח במגע** — ובכרטיס הליד זה אומר שהעדיפות ותאריך
        החזרה נראים כמו טקסט סטטי. קביעת מועד חזרה היא חצי מהעבודה של
        העובד, והפקד שלה לא נראה כפקד.

        ⚠️ `max-lg:` ולא מחלקת בסיס + `lg:` שדורסת אותה. נמדד: הצמד
        `opacity-50 lg:opacity-0` **לא** עבד — שתי המחלקות נכתבות לאותה
        תכונה בלי הפרש specificity, ומדיה-קוורי לא מוסיפה כזה, כך
        שסדר הפלט הכריע. שני טווחים בלעדיים זה לזה לא יכולים להתנגש.
      */}
      <Icon
        name="chevronDown"
        size={11}
        className="pointer-events-none absolute inset-y-0 end-0.5 my-auto transition-opacity max-lg:opacity-50 lg:opacity-0 lg:group-hover:opacity-50"
      />
      <select
        value={value}
        disabled={busy}
        onChange={(e) => onPick(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * תאריך **ושעת** חזרה — לחיצה על התגית פותחת חלון מסך-מלא.
 *
 * השעה נדרשת כי התזכורת בוואטסאפ יוצאת בשעה הזו בדיוק; `step` של רבע
 * שעה כי אף אחד לא קובע חזרה ל-14:37.
 *
 * ⚠️ **חלון מסך-מלא ולא עורך צף ליד התגית** (אוקטובר 2026, בקשת בעל
 * המערכת: "שזה יהיה לכל המסך כשמשנים את השעה"). העורך הצף היה
 * `datetime-local` של 13rem שנפתח מעל הכרטיס: בטלפון השעה נחתכה בקצה
 * המסך, השדות היו קטנים מדי לאגודל, וכל נגיעה לידו סגרה אותו ושמרה
 * ערך באמצע הקלדה. בחלון יש שדה תאריך ושדה שעה גדולים, קיצורים לזמנים
 * הנפוצים, ושמירה רק בלחיצה על "שמירה" — אין שמירה בטעות.
 *
 * אותו `onPick(value)` כמו קודם (`YYYY-MM-DDTHH:mm` בשעון ישראל, או `""`
 * לניקוי), כך שהכרטיס, השורה בטבלה והמגירה לא השתנו.
 */
export function FollowUpCell({
  value,
  onPick,
  busy,
  children,
}: {
  /** `YYYY-MM-DDTHH:mm` או מחרוזת ריקה */
  value: string;
  onPick: (value: string) => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    // אותה סיבה כמו ב-InlinePicker: נמדד בפועל 61×16 בלי זה — התאריך
    // הריק ("קבע חזרה") הוא הטקסט הכי נמוך בכרטיס, והשכבה שמעליו
    // ירשה את הגובה שלו.
    <span className="relative inline-flex min-h-11 min-w-11 items-center rounded hover:bg-surface-3 lg:min-h-0 lg:min-w-0">
      {children}
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          // הלחיצה על השורה פותחת את הליד; בלי זה היא הייתה פותחת גם
          // את המגירה מאחורי החלון
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="שינוי תאריך ושעת חזרה"
        aria-haspopup="dialog"
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      />
      {open && (
        <FollowUpSheet
          value={value}
          busy={busy}
          onClose={() => setOpen(false)}
          onSave={(next) => {
            setOpen(false);
            // אין שינוי — לא שולחים בקשה סתם
            if (next !== value) onPick(next);
          }}
        />
      )}
    </span>
  );
}

/** קיצורים לזמני החזרה הנפוצים אחרי שיחה, בשעון ישראל. */
function followUpPresets(now: number): { label: string; value: string }[] {
  // מעגלים כלפי מעלה לרבע שעה — אותו `step` כמו בשדה השעה
  const round = (t: number) => Math.ceil(t / 900_000) * 900_000;
  const day = (offset: number) => dayKey(now + offset * 86_400_000);
  return [
    { label: "בעוד שעה", value: dateTimeInputValue(round(now + 3_600_000)) },
    { label: "בעוד 3 שעות", value: dateTimeInputValue(round(now + 3 * 3_600_000)) },
    { label: "מחר ב-10:00", value: `${day(1)}T10:00` },
    { label: "מחר ב-16:00", value: `${day(1)}T16:00` },
    { label: "בעוד יומיים", value: `${day(2)}T10:00` },
    { label: "בעוד שבוע", value: `${day(7)}T10:00` },
  ];
}

/**
 * החלון עצמו: מסך מלא בטלפון, חלון ממורכז במחשב.
 *
 * ⚠️ ב-portal ל-`body` ולא במקום: התגית יושבת בתוך כרטיס עם `.spine`
 * ו-`@container`, ובתוך שורת טבלה עם `overflow-x-auto`. `fixed` בתוך
 * הקשרים כאלה עלול להיחתך או להתמקם יחסית לכרטיס. `stopPropagation`
 * על השורש — אירועי React עוברים דרך portal להורים ב-React, ובלעדיו
 * לחיצה בחלון הייתה מגיעה לשורת הטבלה ופותחת את הליד.
 */
function FollowUpSheet({
  value,
  busy,
  onClose,
  onSave,
}: {
  value: string;
  busy?: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [date, setDate] = useState(value.slice(0, 10));
  const [time, setTime] = useState(value.slice(11, 16) || "10:00");
  // הרגע שבו החלון נפתח — עוגן לקיצורים. נקבע פעם אחת, לא בכל רינדור.
  const [openedAt] = useState(() => Date.now());

  useBodyScrollLock(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const draft = date ? `${date}T${time || "10:00"}` : "";
  const presets = followUpPresets(openedAt);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 bg-ink-1/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="מועד חזרה ללקוח"
        className="relative flex h-dvh w-full flex-col bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:h-auto sm:max-w-md sm:rounded-card sm:border sm:border-line sm:shadow-pop"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-bold text-ink-1">מתי לחזור ללקוח?</h2>
          {/* `after:-inset-2` — 28px + 8 מכל צד = 44 למגע */}
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="relative rounded-md p-1 text-ink-3 after:absolute after:-inset-2 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const on = draft === p.value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setDate(p.value.slice(0, 10));
                    setTime(p.value.slice(11, 16));
                  }}
                  aria-pressed={on}
                  className={`min-h-12 rounded-card border px-3 text-sm font-medium transition-colors active:scale-[0.98] ${
                    on
                      ? "border-brand bg-brand text-on-brand"
                      : "border-line bg-surface text-ink-1 hover:border-line-strong hover:bg-surface-2"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* שדות גדולים: `text-lg` הוא גם מעל רצפת ה-16px של iOS — בלי זום */}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">תאריך</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} nums h-14 text-lg`}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">שעה</span>
            <input
              type="time"
              step={900}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={`${inputClass} nums h-14 text-lg`}
            />
          </label>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line p-4">
          <Button
            variant="primary"
            disabled={busy || !date}
            onClick={() => onSave(draft)}
            className="h-12 flex-1"
          >
            שמירה
          </Button>
          {value && (
            <Button variant="secondary" disabled={busy} onClick={() => onSave("")} className="h-12">
              ניקוי המועד
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="h-12">
            ביטול
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/**
 * עלות הליד, עם עריכה במקום.
 *
 * מציג `חינם` כשהעלות האפקטיבית 0 — זה מה שהופך "לא שילמנו על הליד"
 * למובחן מ"לא הזנו עלות". כשאין ערך פרטני מוצגת עלות הקטגוריה, בגוון
 * חלש יותר, כדי שיהיה ברור שזו ברירת מחדל ולא החלטה.
 */
export function CostCell({
  lead,
  effective,
  onSave,
  busy,
}: {
  lead: Lead;
  effective: number;
  onSave: (cost: number | null) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function open() {
    setDraft(lead.cost === undefined ? "" : String(lead.cost));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);

    if (next !== null && (!Number.isFinite(next) || next < 0)) return;
    // אין שינוי — לא שולחים בקשה סתם
    if (next === (lead.cost ?? null)) return;

    onSave(next);
  }

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        step="0.5"
        autoFocus
        value={draft}
        placeholder="ברירת מחדל"
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`עלות של ${lead.name}`}
        /*
          ⚠️ הגדלים מותנים ב-breakpoint ואין כאן `text-xs` ללא תנאי.
          קודם היה `h-8 … text-xs` תמיד: 12px גרם ל-iOS לזנק זום ולהזיז
          את הפריסה לצמיתות, ו-32px הוא חצי ממטרת המגע המינימלית.
          בשולחן, שם התא צר וסמן העכבר מדויק, הערכים הקטנים נשארים.
        */
        className={`${inputClass} nums h-11 w-28 py-0 lg:h-8 lg:w-24 lg:text-xs`}
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
      title="לחץ לעריכת עלות"
      aria-label={`עריכת עלות של ${lead.name}`}
      className={`nums min-h-11 min-w-11 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-surface-3 active:bg-surface-3 lg:min-h-0 lg:min-w-0 lg:text-xs ${
        lead.cost === undefined ? "text-ink-4" : "text-ink-1"
      }`}
    >
      {effective === 0 ? "חינם" : money(effective)}
    </button>
  );
}

/**
 * סימון ליד לטיפול.
 *
 * `variant="inline"` (ברירת המחדל) — כוכב קטן לפני השם בשורת הטבלה.
 * `variant="button"` — ריבוע של כפתור אייקון (36/32px) לאשכול הפעולות
 * של הכרטיס, גלוי תמיד.
 */
export function StarToggle({
  lead,
  onToggle,
  busy,
  variant = "inline",
}: {
  lead: Lead;
  onToggle: (next: boolean) => void;
  busy: boolean;
  variant?: "inline" | "button";
}) {
  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!lead.isStarred);
        }}
        disabled={busy}
        aria-pressed={lead.isStarred}
        aria-label={lead.isStarred ? `הסרת הסימון מ${lead.name}` : `סימון ${lead.name}`}
        title={lead.isStarred ? "הסרת סימון" : "סימון ליד"}
        /*
         * ⚠️ 36px בטלפון ו-`after:-inset-1` מוסיף 4px לכל צד (44px) בלי
         * לשנות את הפריסה; בשולחן 32px בדיוק. בכרטיס הכוכב **תמיד**
         * גלוי — שם הוא חלק מאשכול הפעולות ולא קישוט שמופיע בריחוף.
         */
        className={`relative grid size-9 shrink-0 touch-manipulation place-items-center rounded-lg transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-surface-3 active:scale-95 active:bg-surface-3 disabled:cursor-wait lg:size-8 lg:after:inset-0 ${
          lead.isStarred ? "text-warn" : "text-ink-4 hover:text-ink-2"
        }`}
      >
        <Icon name="star" size={18} fill={lead.isStarred ? "currentColor" : "none"} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!lead.isStarred);
      }}
      disabled={busy}
      aria-pressed={lead.isStarred}
      aria-label={lead.isStarred ? `הסרת הסימון מ${lead.name}` : `סימון ${lead.name}`}
      title={lead.isStarred ? "הסרת סימון" : "סימון ליד"}
      /*
       * ⚠️ נמדד בפועל בכרטיס: 18×18 ו-`opacity: 0` — כפתור בלתי נראה
       * לגמרי במגע, כי "hover" לא קיים באצבע. `opacity-100 lg:opacity-0
       * lg:group-hover:opacity-100` הופך אותו לגלוי מתחת ל-lg ומשאיר
       * את השולחן בדיוק כמו שהיה.
       *
       * `after:-inset-3` מרחיב את איזור הלחיצה ל-~40px בלי לשנות את
       * הגודל החזותי של הכוכב עצמו — פסאודו-אלמנט לא תופס מקום
       * בפריסה, ולכן אין השפעה על שאר האלמנטים בשורה.
       */
      className={`relative shrink-0 rounded p-0.5 transition-colors after:absolute after:-inset-3.5 after:content-[''] active:scale-90 ${
        lead.isStarred
          ? "text-warn"
          : "text-ink-4 opacity-100 hover:text-ink-2 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      }`}
    >
      <Icon
        name="star"
        size={14}
        fill={lead.isStarred ? "currentColor" : "none"}
      />
    </button>
  );
}

/**
 * דרכי יצירת הקשר עם הליד, ישירות מהשורה.
 *
 * וואטסאפ נפתח בלשונית חדשה עם הודעת פתיחה מוכנה; המייל מופיע רק
 * כשיש כתובת — כפתור מושבת לצמיתות היה רק רעש.
 */
export function RowActions({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  /*
   * ⚠️ נמדד בפועל בכרטיס: 32×32 — קרוב אבל מתחת ל-44px. `after:-inset-1.5`
   * מוסיף 6px לכל צד בלי לשנות את הגודל החזותי (פסאודו-אלמנט, לא
   * תופס מקום). `active:scale-95` הוא משוב הלחיצה היחיד באתר — בלעדיו
   * מגע על המסך "מרגיש מת", כי כל הפידבק הקיים הוא hover בלבד.
   */
  const actionClass =
    "relative rounded-lg p-2 transition-colors after:absolute after:-inset-1.5 after:content-[''] active:scale-95";

  /*
   * ⚠️ הצבע במנוחה ולא רק ב-hover.
   *
   * שלוש הפעולות היו `text-ink-3` אפור וקיבלו צבע רק בריחוף — כלומר
   * **בטלפון הן היו אפורות לצמיתות**, כי אין שם hover בכלל. זה גם
   * הפך את החיוג והוואטסאפ (שתי הפעולות הכי נפוצות במסך) לשני
   * אייקונים זהים שצריך לקרוא כדי להבדיל ביניהם.
   */

  return (
    <div className="flex items-center justify-end gap-0.5">
      <a
        href={`tel:${lead.phone}`}
        onClick={stop}
        className={`${actionClass} text-brand hover:bg-brand-soft`}
        aria-label={`חיוג ל${lead.name}`}
        title="חיוג"
      >
        <Icon name="phone" size={16} />
      </a>

      <a
        href={waLink(lead.phone, whatsappGreeting(lead.name))}
        onClick={stop}
        target="_blank"
        rel="noopener noreferrer"
        className={`${actionClass} text-good hover:bg-good-soft`}
        aria-label={`וואטסאפ ל${lead.name}`}
        title="וואטסאפ"
      >
        <Icon name="whatsapp" size={16} />
      </a>

      {lead.email && (
        <a
          href={`mailto:${lead.email}`}
          onClick={stop}
          className={`${actionClass} text-info hover:bg-info-soft`}
          aria-label={`מייל ל${lead.name}`}
          title="מייל"
        >
          <Icon name="mail" size={16} />
        </a>
      )}

      <button
        onClick={onOpen}
        className={`${actionClass} text-ink-4 hover:bg-surface-3 hover:text-ink-1`}
        aria-label={`פתיחת ${lead.name}`}
        title="פתיחת הליד"
      >
        <Icon name="chevronLeft" size={16} />
      </button>
    </div>
  );
}
