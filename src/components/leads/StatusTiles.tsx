"use client";

import type { LeadStatus } from "@/lib/domain/types";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
import { TONE_SOFT_VAR, TONE_VAR } from "@/lib/format";
import { number } from "@/lib/format";

/**
 * קוביית סטטוס לכל שלב בתור, עם מספר הלידים שבו.
 *
 * החליפה את סרגל המסננים (סוג/עדיפות/קטגוריה/עובד). הסרגל ההוא דרש
 * לפתוח תפריט כדי לגלות שיש בו משהו; כאן כל המצב של התור נקרא במבט
 * אחד, והסינון הוא לחיצה על מה שרואים.
 *
 * ⚠️ **המספר על הקוביה הוא כמה שורות יתקבלו בלחיצה עליה** — לא כמה יש
 * בסטטוס הזה בכלל. הוא נגזר בלקוח (`tileCounts` ב-`LeadsClient`) מעל
 * הלידים שעברו את כל שאר המסננים, ולכן הוא לא יכול לסתור את הטבלה.
 *
 * הסטטוס עצמו מוחרג מהגזירה, ולכן לחיצה על קוביה לא מזיזה אף מספר —
 * קוביה שמראה "12" ואז "0" ברגע שלוחצים עליה היא חסרת שימוש. שאר
 * הממדים כן כלולים, וזה מה שמתקן את הפער: קודם הספירה הגיעה מהשרת,
 * לא ידעה על שום מסנן, ולא ידעה שדאטה קרה מוסתרת — אז הקוביה הבטיחה
 * 412 והטבלה הראתה 38.
 *
 * **כל הסטטוסים מוצגים תמיד**, גם הריקים. הרשת נשברת לשורות ולא
 * נגללת לצדדים: סטטוס שדורש גלילה כדי לגלות אותו הוא סטטוס שלא ידעו
 * שהוא קיים. הריקים מעומעמים כדי שהעין תיפול על מה שיש בו עבודה,
 * אבל הם נשארים לחיצים — לסנן ל"אין מענה" ולראות שהוא ריק זו תשובה.
 */
export function StatusTiles({
  counts,
  active,
  onToggle,
  onClear,
  /**
   * בטלפון מוצגים רק הסטטוסים שיש בהם עבודה, ועוד כפתור שפותח את כל
   * ה-15. חמש-עשרה קוביות ברוחב 358px נשברות לחמש שורות ואוכלות 260px
   * מתוך מסך של 844 — לפני שרואים ליד אחד.
   *
   * הכלל שמנחה את הרכיב ("סטטוס שצריך לגלול כדי לגלות אותו הוא סטטוס
   * שלא ידעו שהוא קיים") נשמר: הוא רק מקבל רמת עקיפה אחת במקום אפס.
   */
  compact = false,
  onExpand,
}: {
  counts: Record<LeadStatus, number>;
  active: LeadStatus[];
  onToggle: (status: LeadStatus) => void;
  onClear: () => void;
  compact?: boolean;
  onExpand?: () => void;
}) {
  const shown = compact
    ? STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0 || active.includes(s))
    : STATUS_ORDER;

  return (
    <div className="mb-3">
      <div
        /*
          ⚠️ `scroll-x-cue` במצב compact — הרכיב הזה מנסח בעצמו את הכלל
          ש"סטטוס שדורש גלילה הוא סטטוס שלא ידעו שהוא קיים", ומצב compact
          הפר אותו: שישה אריחים ומעלה הם >600px בתוך ~336px, בלי פס גלילה
          נראה במסך מגע. הרמז מחזיר את הידיעה שיש עוד.
        */
        className={
          compact
            ? "scroll-thin scroll-x-cue -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            : "flex flex-wrap gap-1.5"
        }
        role="group"
        aria-label="סינון לפי סטטוס"
      >
        {shown.map((status) => {
          const meta = STATUS_CONFIG[status];
          const count = counts[status] ?? 0;
          const on = active.includes(status);
          const empty = count === 0;

          return (
            <button
              key={status}
              onClick={() => onToggle(status)}
              aria-pressed={on}
              title={`${meta.label} — ${count}`}
              /*
               * ⚠️ הרקע והמספר נצבעים בטון הסטטוס, ולא רק פס 3px.
               *
               * הגרסה הקודמת נתנה 19 אריחים לבנים זהים שנבדלו ברצועה
               * דקה בצד — ומכיוון שהפלטה החזיקה אז שישה טונים (ושניים
               * מהם באותו hex), חצי מהמסך היה פשוט לבן. זה היה הדבר
               * ה"יבש" הגדול ביותר במסך.
               */
              style={
                {
                  "--spine-c": TONE_VAR[meta.tone],
                  "--spine-w": "4px",
                  ...(on ? {} : { background: TONE_SOFT_VAR[meta.tone] }),
                } as React.CSSProperties
              }
              className={`spine relative min-w-[92px] rounded-card border py-1.5 pe-2 ps-2.5 text-start transition-all ${
                compact ? "shrink-0" : "flex-1"
              } ${
                on
                  ? "border-brand bg-brand-soft"
                  : "border-transparent hover:brightness-105"
              } ${empty && !on ? "opacity-45 hover:opacity-100" : ""}`}
            >
              <span
                className="nums block text-base font-bold leading-none"
                style={{ color: on ? "var(--c-brand)" : TONE_VAR[meta.tone] }}
              >
                {number(count)}
              </span>
              {/* truncate ולא whitespace-nowrap: "נמכר ע״י משווק מקביל"
                  היה מותח את הקוביה שלו לרוחב שלוש אחרות */}
              <span
                className={`mt-0.5 block truncate text-[11px] ${
                  on ? "text-brand" : "text-ink-2"
                }`}
              >
                {meta.label}
              </span>
            </button>
          );
        })}

        {compact && (
          <button
            onClick={onExpand}
            className="shrink-0 whitespace-nowrap rounded-card border border-dashed border-line px-3 py-1.5 text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink-1"
          >
            כל הסטטוסים ({STATUS_ORDER.length})
          </button>
        )}
      </div>

      {active.length > 0 && (
        // `min-h-11` — היה 16px גובה. זה כפתור המילוט מסינון שהמשתמש
        // כבר לא זוכר שהפעיל, ובטלפון פשוט אי אפשר היה לפגוע בו.
        // `active:` כי `hover:` לבדו מתקמפל ל-`@media (hover: hover)`
        <button
          onClick={onClear}
          className="mt-1.5 inline-flex min-h-11 items-center text-xs text-ink-3 underline-offset-2 transition-colors active:text-ink-1 active:underline hover:text-ink-1 hover:underline lg:min-h-0"
        >
          ניקוי הסינון ({active.length})
        </button>
      )}
    </div>
  );
}
