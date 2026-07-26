"use client";

import type { LeadStatus } from "@/lib/domain/types";
import { OPEN_STATUSES, STATUS_CONFIG } from "@/lib/domain/types";
import { number } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { StatusBreakdownStrip } from "@/components/ui/StatusBreakdownStrip";
import type { Filters } from "./FilterBar";
import { QUICK_VIEWS, isViewActive } from "./views";

/**
 * כותרת המסך.
 *
 * שלוש שכבות, מהגדול לקטן: מה המסך הזה, מה אני צריך לעשות עכשיו
 * (התצוגות המהירות), ואיפה העומס מצטבר (רצועת התור).
 *
 * רצועת התור מציגה חלק יחסי ולא רק מספר: "40 באין מענה" לא אומר
 * אם זה הרבה, "40 מתוך 51 הפתוחים" כן.
 */
export function QueueHeader({
  counts,
  total,
  showing,
  onAdd,
  filters,
  onFiltersChange,
  currentUserId,
}: {
  counts: Record<LeadStatus, number>;
  total: number;
  showing: number;
  onAdd: () => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  currentUserId: string;
}) {
  const segments = OPEN_STATUSES.map((status) => ({
    status,
    count: counts[status] ?? 0,
  })).filter((s) => s.count > 0);

  const openTotal = segments.reduce((sum, s) => sum + s.count, 0);
  const wonCount = counts.won ?? 0;
  const filtering = showing !== total;

  return (
    <header className="mb-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
            תור העבודה
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
            <span className="nums font-semibold text-ink-1">
              {number(filtering ? showing : total)}
            </span>
            {filtering ? <>מתוך {number(total)} לידים</> : <>לידים במערכת</>}
            {openTotal > 0 && (
              <>
                <Dot />
                <span className="nums">{number(openTotal)}</span> פתוחים
              </>
            )}
            {wonCount > 0 && (
              <>
                <Dot />
                <span className="nums">{number(wonCount)}</span> נסגרו
              </>
            )}
          </p>
        </div>

        <Button variant="primary" icon="plus" onClick={onAdd} className="h-10 px-4">
          ליד חדש
          <kbd className="ms-1 rounded border border-on-brand/30 px-1 text-[10px] font-normal opacity-70">
            N
          </kbd>
        </Button>
      </div>

      {/* תצוגות מהירות — "מה אני צריך לעשות עכשיו" */}
      <div
        className="scroll-thin -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="תצוגות מהירות"
      >
        {QUICK_VIEWS.map((view) => {
          const active = isViewActive(view, filters, currentUserId);
          return (
            <button
              key={view.key}
              onClick={() => onFiltersChange(view.patch(currentUserId))}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1"
              }`}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      {/* רצועת התור */}
      {openTotal > 0 && (
        <StatusBreakdownStrip
          segments={segments.map(({ status, count }) => ({
            key: status,
            label: STATUS_CONFIG[status].label,
            count,
            tone: STATUS_CONFIG[status].tone,
          }))}
          activeKeys={filters.status}
          onToggle={(key) => {
            const status = key as LeadStatus;
            const active = filters.status.includes(status);
            onFiltersChange({
              ...filters,
              status: active
                ? filters.status.filter((s) => s !== status)
                : [...filters.status, status],
            });
          }}
        />
      )}
    </header>
  );
}

function Dot() {
  return <span className="text-ink-4">·</span>;
}
