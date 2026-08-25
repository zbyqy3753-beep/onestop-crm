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
 * תאריך **ושעת** חזרה, עם עריכה במקום.
 *
 * השעה נדרשת כי התזכורת בוואטסאפ יוצאת בשעה הזו בדיוק; `step` של רבע
 * שעה כי אף אחד לא קובע חזרה ל-14:37.
 *
 * ⚠️ **הבורר נפתח גלוי, ולא כ-input שקוף מעל התצוגה.** הדפוס השקוף
 * עובד ל-`<select>` (`InlinePicker`, `StatusPicker`) כי לחיצה בכל מקום
 * פותחת את הרשימה. ל-`datetime-local` הוא נשבר: הרוחב שלו נגזר מהתא
 * שהוא עוטף — נמדד 89px מול 177px שהבורר באמת צריך — וכל מה שמעבר
 * נחתך. השדות נחתכים מהסוף, כלומר **השעה והדקה הן בדיוק מה שיוצא
 * מהמסגרת**: הנציג הצליח לבחור תאריך מלוח השנה הקופץ, אבל לא הייתה לו
 * שום דרך להגיע לשעה. השקיפות החמירה — אין משוב על איזה שדה במיקוד.
 *
 * לכן: לחיצה על התא פותחת input אמיתי ברוחב מלא, במיקום מוחלט כדי
 * שרוחב העמודה לא יקפוץ. אותו דפוס כמו `CostCell`, כולל השמירה
 * ב-blur/Enter ולא בכל הקשה — עריכת שעה ידנית עוברת דרך ערכים
 * חוקיים-אך-לא-מכוונים (14:00 בדרך ל-14:30), וכל אחד מהם היה נשמר.
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function open() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    // אין שינוי — לא שולחים בקשה סתם
    if (draft !== value) onPick(draft);
  }

  return (
    // אותה סיבה כמו ב-InlinePicker: נמדד בפועל 61×16 בלי זה — התאריך
    // הריק ("קבע חזרה") הוא הטקסט הכי נמוך בכרטיס, והשכבה שמעליו
    // ירשה את הגובה שלו.
    <span className="relative inline-flex min-h-11 min-w-11 items-center rounded hover:bg-surface-3 lg:min-h-0 lg:min-w-0">
      {children}
      {editing ? (
        <input
          type="datetime-local"
          step={900}
          autoFocus
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          // הלחיצה על השורה פותחת את הליד; בלי זה כל נגיעה בבורר
          // הייתה פותחת את המגירה מעליו
          onClick={(e) => e.stopPropagation()}
          aria-label="תאריך ושעת חזרה"
          /*
            ⚠️ רוחב קבוע ומיקום מוחלט, ולא `inputClass` עם `w-full`:
            הבורר רחב מהתא, ובזרימה רגילה הוא היה מרחיב את העמודה בכל
            פתיחה. `z` כדי שלא ייחתך מתחת לתא השכן.
          */
          className="nums absolute top-1/2 end-0 z-20 w-[13rem] -translate-y-1/2 rounded-md border border-line bg-surface px-2 py-1.5 text-base text-ink-1 focus:border-brand focus:outline-none lg:text-sm"
        />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          aria-label="שינוי תאריך ושעת חזרה"
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
        />
      )}
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
