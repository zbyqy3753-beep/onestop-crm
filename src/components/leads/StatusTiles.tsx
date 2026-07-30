"use client";

import type { LeadStatus } from "@/lib/domain/types";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
import { TONE_VAR } from "@/lib/format";
import { number } from "@/lib/format";

/**
 * קוביית סטטוס לכל שלב בתור, עם מספר הלידים שבו.
 *
 * החליפה את סרגל המסננים (סוג/עדיפות/קטגוריה/עובד). הסרגל ההוא דרש
 * לפתוח תפריט כדי לגלות שיש בו משהו; כאן כל המצב של התור נקרא במבט
 * אחד, והסינון הוא לחיצה על מה שרואים.
 *
 * הספירות מגיעות מ-`countByStatus` בשרת ולא מהלידים שעל המסך, ולכן
 * הן לא משתנות כשמסננים — קוביה שמראה "12" ואז "0" ברגע שלוחצים
 * עליה הייתה חסרת שימוש.
 *
 * סטטוסים ריקים מוסתרים כברירת מחדל: 15 קוביות שרובן 0 הן רעש. הן
 * חוזרות ברגע שיש בהן ליד, וגם כשהן מסוננות (כדי שאפשר יהיה לבטל).
 */
export function StatusTiles({
  counts,
  active,
  onToggle,
  onClear,
}: {
  counts: Record<LeadStatus, number>;
  active: LeadStatus[];
  onToggle: (status: LeadStatus) => void;
  onClear: () => void;
}) {
  const tiles = STATUS_ORDER.filter(
    (s) => (counts[s] ?? 0) > 0 || active.includes(s),
  );

  if (tiles.length === 0) return null;

  return (
    <div
      className="scroll-thin -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label="סינון לפי סטטוס"
    >
      {tiles.map((status) => {
        const meta = STATUS_CONFIG[status];
        const on = active.includes(status);

        return (
          <button
            key={status}
            onClick={() => onToggle(status)}
            aria-pressed={on}
            style={{ "--spine-c": TONE_VAR[meta.tone] } as React.CSSProperties}
            className={`spine relative shrink-0 rounded-card border ps-3.5 pe-4 py-2 text-start transition-colors ${
              on
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
            }`}
          >
            <span
              className={`nums block text-lg font-bold leading-none ${
                on ? "text-brand" : "text-ink-1"
              }`}
            >
              {number(counts[status] ?? 0)}
            </span>
            <span
              className={`mt-1 block whitespace-nowrap text-xs ${
                on ? "text-brand" : "text-ink-3"
              }`}
            >
              {meta.label}
            </span>
          </button>
        );
      })}

      {active.length > 0 && (
        <button
          onClick={onClear}
          className="shrink-0 self-stretch rounded-card border border-dashed border-line px-3 text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink-1"
        >
          ניקוי
        </button>
      )}
    </div>
  );
}
