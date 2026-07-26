"use client";

import type { StatusTone } from "@/lib/domain/types";
import { TONE_VAR, number } from "@/lib/format";

/**
 * רצועת חלוקה: פס יחסי (רוחב = חלק מהסך) + מקרא לחיצה מתחתיו.
 *
 * חולץ מ-`QueueHeader.tsx` — אותה תבנית בדיוק נדרשת גם בדשבורד הבית
 * (`/`) וגם בתור העבודה (`/leads`), עם קבוצות סגמנטים שונות (סטטוסים
 * מול תמהיל סטטוס/סוג). הרכיב לא יודע כלום על הדומיין — כל קורא
 * מתרגם את המקור שלו לרשימת `{key,label,count,tone}`.
 *
 * `onToggle` אופציונלי: בלעדיו הרצועה תצוגתית בלבד (לא לחיצה), עם
 * כל הסגמנטים באטימות מלאה — זה מה שדשבורד הבית צריך.
 */
export interface StatusSegment {
  key: string;
  label: string;
  count: number;
  tone: StatusTone;
}

export function StatusBreakdownStrip({
  segments,
  activeKeys = [],
  onToggle,
  className = "",
}: {
  segments: StatusSegment[];
  activeKeys?: string[];
  onToggle?: (key: string) => void;
  className?: string;
}) {
  const visible = segments.filter((s) => s.count > 0);
  const total = visible.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) return null;

  const interactive = !!onToggle;

  return (
    <section
      aria-label="חלוקה לפי סטטוס"
      className={`rounded-card border border-line bg-surface p-3.5 ${className}`}
    >
      <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-surface-3">
        {visible.map((s) => (
          <span
            key={s.key}
            className="transition-opacity first:rounded-s-full last:rounded-e-full"
            style={{
              width: `${(s.count / total) * 100}%`,
              background: TONE_VAR[s.tone],
              opacity:
                !interactive || activeKeys.length === 0 || activeKeys.includes(s.key)
                  ? 1
                  : 0.22,
            }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {visible.map((s) => {
          const active = activeKeys.includes(s.key);
          const dot = (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                background: TONE_VAR[s.tone],
                opacity: !interactive || activeKeys.length === 0 || active ? 1 : 0.3,
              }}
            />
          );
          const label = (
            <span className={interactive && active ? "font-semibold" : ""}>
              {s.label}
            </span>
          );
          const count = <span className="nums font-semibold text-ink-2">{number(s.count)}</span>;

          if (!interactive) {
            return (
              <li key={s.key} className="flex items-center gap-1.5 text-[13px] text-ink-1">
                {dot}
                {label}
                {count}
              </li>
            );
          }

          return (
            <li key={s.key}>
              <button
                onClick={() => onToggle!(s.key)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded text-[13px] transition-colors ${
                  active ? "text-ink-1" : "text-ink-3 hover:text-ink-1"
                }`}
              >
                {dot}
                {label}
                {count}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
