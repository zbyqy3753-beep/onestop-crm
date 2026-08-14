"use client";

import { useEffect, useRef } from "react";
import type { StatusTone } from "@/lib/domain/types";
import { TONE_CLASS } from "@/lib/format";
import { useBodyScrollLock, useDetailsAutoClose } from "@/lib/overlay";
import { Icon, type IconKey } from "./Icon";

/* ── תגית ─────────────────────────────────────────────────────────────── */

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ── כפתור ────────────────────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * ⚠️ לכל וריאנט יש `active:` ולא רק `hover:`.
 *
 * Tailwind v4 מקמפל כל `hover:` לתוך `@media (hover: hover)`, כלומר
 * **בטלפון כללי ה-hover פשוט לא קיימים**. בלי `active:` ללחיצה על
 * כפתור אין שום תגובה חזותית, והמסך מרגיש מת — בדיוק מה שכתוב
 * ב-`leads/cells.tsx` על `active:scale-95`, רק שזה מעולם לא הוכלל
 * לשכבת הפרימיטיבים שמאחורי כל כפתור באפליקציה.
 */
const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover",
  secondary:
    "border border-line-strong bg-surface text-ink-1 hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink-1 active:bg-surface-3 active:text-ink-1",
  danger: "bg-bad text-white hover:opacity-90 active:opacity-80",
};

export function Button({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...rest
}: {
  variant?: Variant;
  icon?: IconKey;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      /*
       * `min-h-11 lg:min-h-0` — רצפה של 44px למגע, שנעלמת בשולחן.
       * הקוראים שמעבירים `h-9` הופכים ל-44px בטלפון ונשארים 36px בשולחן,
       * בלי לגעת באף אחד מהם בנפרד.
       *
       * ⚠️ `min-w-11` הוא בן הזוג החסר. `min-h-11` לבדו טיפל בגובה בלבד,
       * ולכן כפתור עם אייקון ובלי טקסט — `<Button icon="x" />` — יצא
       * 44px גובה על 40px רוחב (`px-3` + אייקון 16px). מטרת מגע נמדדת
       * בשני הצירים, ובלי זה כל כפתור אייקון באפליקציה נפל מתחת לסף.
       *
       * `touch-manipulation` מבטל את השהיית ה-300ms של זיהוי לחיצה כפולה,
       * ו-`select-none` מונע את סימון הטקסט שקורה בלחיצה ארוכה בטעות.
       */
      className={`inline-flex min-h-11 min-w-11 touch-manipulation select-none items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 lg:min-h-0 lg:min-w-0 lg:active:scale-100 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/* ── שדה קלט ──────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-4">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * ⚠️ `text-base lg:text-sm` ולא `text-sm` — הגודל במובייל הוא תיקון, לא עיצוב.
 *
 * ספארי באייפון מזיים אוטומטית את כל העמוד כשמתמקדים בשדה שהגופן שלו
 * קטן מ-16px, **ולא חוזר** אחרי שיוצאים ממנו. `text-sm` הוא 14px, ולכן
 * כל חיפוש, כל טופס וכל בורר במערכת השאירו את המשתמש בתצוגה מזויימת.
 *
 * מ-1024px ומעלה חוזרים ל-14px, כך שבשולחן שום דבר לא משתנה.
 *
 * ⚠️ `min-h-11 lg:min-h-0` מאותה משפחה. `py-1.5` עם גופן 16px נותן שדה
 * של 38px — נמדד — כלומר כל שדה קלט במערכת היה מתחת ל-44px שמטרת מגע
 * דורשת. שדה החיפוש של הלידים הוא הפקד הנפוץ ביותר באפליקציה, והוא
 * היה בין הקטנים. גם כאן: בשולחן חוזרים לצפוף.
 *
 * ⚠️ רצפת ה-16px עצמה מגובה גם בכלל בסיס ב-`globals.css`, כי `text-xs`
 * שנוסף **אחרי** המחרוזת הזו באותו `className` היה גובר עליה. שם היא
 * לא ניתנת לדריסה, כאן היא רק ברירת המחדל.
 */
export const inputClass =
  "w-full min-h-11 lg:min-h-0 rounded-md border border-line bg-surface px-2.5 py-1.5 text-base lg:text-sm text-ink-1 placeholder:text-ink-4 focus:border-brand focus:outline-none focus-visible:outline-none";

/* ── מצב ריק ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon = "leads",
  title,
  body,
  action,
}: {
  icon?: IconKey;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-surface-3 text-ink-3">
        <Icon name={icon} size={20} />
      </span>
      <p className="font-semibold text-ink-1">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── חלונית ───────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useBodyScrollLock(open);

  if (!open) return null;

  return (
    // `overscroll-contain` בנוסף לנעילת הגלילה: הוא מה שמונע מהחלקה
    // שהגיעה לסוף המודאל להמשיך ולהזיז את מה שמאחוריו
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8">
      <button
        className="fixed inset-0 bg-ink-1/45"
        onClick={onClose}
        aria-label="סגירה"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-rise relative w-full rounded-card border border-line bg-surface shadow-pop ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-base font-bold">{title}</h2>
          {/* `after:-inset-2.5` מרחיב את אזור הלחיצה מ-30px ל-44px בלי
              לשנות את הפריסה — פסאודו-אלמנט לא תופס מקום */}
          <button
            onClick={onClose}
            className="relative rounded-md p-1.5 text-ink-3 after:absolute after:-inset-2.5 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95"
            aria-label="סגירה"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ── הודעות ───────────────────────────────────────────────────────────── */

export interface Toast {
  id: number;
  message: string;
  tone: StatusTone;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    // ⚠️ `z-70` ו-`bottom` שמכבד את ה-inset: הטוסטים נחתו קודם ב-z-50
    // מעל סרגל הפעולות הקבוצתיות (z-40) והסתירו את כפתור המחיקה, ועל
    // מכשירי מחוות הם ישבו בתוך רצועת המחווה. סדר השכבות מוגדר
    // ב-globals.css.
    // ⚠️ עיגון בצד ההתחלה (`start`) ולא ב-`left`: הדף RTL, כך שכפתור
    // ההוספה הצף (`end-4` ב-LeadsClient) יושב בשמאל הפיזי — טוסט מעוגן
    // ל-left נחת בדיוק עליו. `start` ב-RTL = ימין פיזי, הפינה הנגדית.
    // ה-inset הוא safe-area-inset-right כי האפליקציה תמיד RTL (dir="rtl"
    // קבוע), ולכן start הוא תמיד הצד הימני הפיזי.
    // ⚠️ ה-bottom במובייל מפנה מקום ל-BottomNav (min-h-14 = 3.5rem +
    // safe-area, מוסתר ב-lg ומעלה) — בדסקטופ נשאר ההיסט המקורי.
    // ⚠️ `--action-bar-h` מפנה מקום גם לסרגל הפעולות הקבוצתיות של
    // תצוגת הכרטיסים. ה-z-index לבדו לא הספיק: הטוסט אמנם *מעל* הסרגל,
    // אבל שניהם עוגנים לאותה פינה, ולכן כל הודעת "N לידים עודכנו" נחתה
    // בדיוק על מונה הנבחרים ועל בורר השיוך — ל-3.2 שניות, בדיוק בזמן
    // שהמשתמש מנסה לבחור את הפעולה הבאה. הסרגל מודד את עצמו ומפרסם את
    // גובהו; כשאין סרגל המשתנה אינו מוגדר וה-fallback הוא 0.
    <div className="pointer-events-none fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+var(--action-bar-h,0px)+0.5rem)] start-[max(1rem,env(safe-area-inset-right))] z-[70] flex flex-col gap-2 lg:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className="animate-rise pointer-events-auto flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-pop"
    >
      <span className={`size-1.5 rounded-full ${TONE_CLASS[toast.tone]}`} />
      {toast.message}
    </div>
  );
}

/* ── בורר מרובה־ערכים ─────────────────────────────────────────────────── */

/**
 * `<details>` נותן פתיחה/סגירה בלי לנהל מצב. משותף בין מסך הלידים
 * ומסך העסקאות.
 *
 * ⚠️ כאן היה כתוב ש-`<details>` נסגר גם ב-Esc. **הוא לא** — לא בשום
 * דפדפן — וגם לא בלחיצה בחוץ. האמונה השגויה הזו היא הסיבה שמעולם לא
 * נוסף מטפל, והפאנל הצף היה נשאר פתוח מעל התוכן עד לחיצה חוזרת על
 * הכותרת. `useDetailsAutoClose` מוסיף את שניהם.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDetailsAutoClose(ref);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <details ref={ref} className="relative">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors active:bg-surface-2 lg:min-h-0 ${
          selected.length
            ? "border-brand/40 bg-brand-soft font-medium text-brand"
            : "border-line text-ink-2 hover:bg-surface-2"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="nums rounded-full bg-brand px-1.5 text-[10px] text-on-brand">
            {selected.length}
          </span>
        )}
        <Icon name="chevronDown" size={14} />
      </summary>

      {/* `max-w-[calc(100vw-2rem)]` — פאנל של 208px ממוקם מוחלט חורג
          מהמסך ב-360px כשהבורר יושב בקצה השורה */}
      <div className="scroll-thin absolute z-30 mt-1 max-h-72 w-52 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-card border border-line bg-surface p-1 shadow-pop">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="accent-[var(--c-brand)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export { useNow } from "@/lib/clock";
