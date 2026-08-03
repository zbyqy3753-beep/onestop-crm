"use client";

import { useState } from "react";
import type { Lead, LeadStatus } from "@/lib/domain/types";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  whatsappGreeting,
} from "@/lib/domain/types";
import { money, waLink } from "@/lib/format";
import { Badge, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

/**
 * תאים שחוזרים בכל שורה בטבלת הלידים.
 *
 * הופרדו מ-`LeadsTable` כשמספר העמודות גדל — הקובץ ההוא צריך להישאר
 * "כותרת + מיפוי שורות" וכלום מעבר לזה.
 */

/**
 * שינוי סטטוס מתוך השורה, בלי לפתוח את הליד.
 * `<select>` מקורי — נגיש במקלדת ובמובייל בלי קוד נוסף.
 */
export function StatusPicker({
  current,
  onPick,
  busy,
  noAnswerCount,
}: {
  current: LeadStatus;
  onPick: (to: LeadStatus) => void;
  busy?: boolean;
  /** מונה ניסיונות "אין מענה" — מוצג כ"אין מענה 2" מהניסיון השני */
  noAnswerCount?: number;
}) {
  const meta = STATUS_CONFIG[current];
  const label =
    current === "noAnswer" && noAnswerCount && noAnswerCount > 1
      ? `${meta.label} ${noAnswerCount}`
      : meta.label;

  return (
    // אותה בעיה כמו InlinePicker: ה-<select> השקוף יורש את גודל
    // ה-badge הקטן שהוא עוטף — נמדד בפועל 43×20 בטלפון.
    <span className="relative inline-flex min-h-11 min-w-11 items-center lg:min-h-0 lg:min-w-0">
      <Badge tone={meta.tone} className="pe-4">
        {label}
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
        {STATUS_ORDER.map((s) => (
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
 * תאריך חזרה, עם עריכה במקום.
 *
 * `<input type="date">` שקוף מעל התצוגה — אותו היגיון כמו `InlinePicker`,
 * אבל עם בורר תאריכים מקורי במקום רשימה.
 */
export function FollowUpCell({
  value,
  onPick,
  busy,
  children,
}: {
  /** `YYYY-MM-DD` או מחרוזת ריקה */
  value: string;
  onPick: (value: string) => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    // אותה סיבה כמו ב-InlinePicker: נמדד בפועל 61×16 בלי זה — התאריך
    // הריק ("קבע חזרה") הוא הטקסט הכי נמוך בכרטיס, וה-input השקוף
    // ירש את הגובה שלו.
    <span className="relative inline-flex min-h-11 min-w-11 items-center rounded hover:bg-surface-3 lg:min-h-0 lg:min-w-0">
      {children}
      <input
        type="date"
        value={value}
        disabled={busy}
        onChange={(e) => onPick(e.target.value)}
        aria-label="תאריך חזרה"
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      />
    </span>
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
        className={`${inputClass} nums h-8 w-24 py-0 text-xs`}
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
      className={`nums rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-surface-3 ${
        lead.cost === undefined ? "text-ink-4" : "text-ink-1"
      }`}
    >
      {effective === 0 ? "חינם" : money(effective)}
    </button>
  );
}

/** סימון ליד לטיפול. */
export function StarToggle({
  lead,
  onToggle,
  busy,
}: {
  lead: Lead;
  onToggle: (next: boolean) => void;
  busy: boolean;
}) {
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

  return (
    <div className="flex items-center justify-end gap-0.5">
      <a
        href={`tel:${lead.phone}`}
        onClick={stop}
        className={`${actionClass} text-ink-3 hover:bg-brand-soft hover:text-brand`}
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
        className={`${actionClass} text-ink-3 hover:bg-good-soft hover:text-good`}
        aria-label={`וואטסאפ ל${lead.name}`}
        title="וואטסאפ"
      >
        <Icon name="whatsapp" size={16} />
      </a>

      {lead.email && (
        <a
          href={`mailto:${lead.email}`}
          onClick={stop}
          className={`${actionClass} text-ink-3 hover:bg-info-soft hover:text-info`}
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
