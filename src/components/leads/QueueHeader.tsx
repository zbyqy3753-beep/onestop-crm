"use client";

import type { LeadStatus } from "@/lib/domain/types";
import { OPEN_STATUSES } from "@/lib/domain/types";
import { number } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { Filters } from "./FilterBar";
import { StatusTiles } from "./StatusTiles";
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
  onExport,
  onImport,
  onToggleStats,
  statsOpen,
  filters,
  onFiltersChange,
  currentUserId,
  canSeeAll,
  compact = false,
  onExpandStatuses,
}: {
  counts: Record<LeadStatus, number>;
  total: number;
  showing: number;
  onAdd: () => void;
  onExport: () => void;
  onImport: () => void;
  onToggleStats: () => void;
  statsOpen: boolean;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  currentUserId: string;
  /** מסתיר תצוגות מהירות שאין להן משמעות בחתך אישי */
  canSeeAll: boolean;
  /** מסך צר — קוביות הסטטוס מתקפלות לשורה אחת */
  compact?: boolean;
  onExpandStatuses?: () => void;
}) {
  const segments = OPEN_STATUSES.map((status) => ({
    status,
    count: counts[status] ?? 0,
  })).filter((s) => s.count > 0);

  const openTotal = segments.reduce((sum, s) => sum + s.count, 0);
  const wonCount = counts.won ?? 0;
  const filtering = showing !== total;

  return (
    <header className="mb-3">
      {/*
        ⚠️ בטלפון הבלוק הזה **לא מרונדר בכלל**, ולא "מתכווץ".
        הוא עלה 111px מתוך 812 — 14% מהמסך — והכיל שלושה דברים
        מיותרים שם: כותרת שזהה מילה במילה למה שהסרגל העליון מציג
        60px מעליה, מונים שקוביות הסטטוס אומרות טוב יותר, ושלושה
        כפתורים של עבודה ממחשב (ייבוא/ייצוא/פיננסי) שעברו לגיליון
        ה-`⋯` שב-`FilterBar`. "ליד חדש" הפך ל-FAB בגובה האגודל.

        בכוונה תת-עץ נפרד ולא מחלקות `lg:` על הקיים — כך התנהגות
        ה-wrap בשולחן ב-1024–1280px לא יכולה להישבר בטעות.
      */}
      {!compact && (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-[22px] font-bold leading-none tracking-tight">
            תור העבודה
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
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

        <div className="flex flex-wrap items-center gap-2">
          {/* הטוגל של הפאנלים יושב כאן ולא ככרטיס נפרד — ככרטיס הוא עלה
              58 פיקסלים של גובה בלי להציג שום נתון */}
          <Button
            variant="ghost"
            onClick={onToggleStats}
            aria-expanded={statsOpen}
            className="h-9"
          >
            נתונים פיננסיים
            <Icon
              name="chevronDown"
              size={14}
              className={statsOpen ? "rotate-180" : ""}
            />
          </Button>
          <Button variant="secondary" icon="upload" onClick={onImport} className="h-9">
            ייבוא
          </Button>
          <Button
            variant="secondary"
            icon="download"
            onClick={onExport}
            disabled={showing === 0}
            className="h-9"
          >
            ייצוא
          </Button>
          <Button variant="primary" icon="plus" onClick={onAdd} className="h-9 px-4">
            ליד חדש
            <kbd className="ms-1 rounded border border-on-brand/30 px-1 text-[10px] font-normal opacity-70">
              N
            </kbd>
          </Button>
        </div>
      </div>
      )}

      {/* תצוגות מהירות — "מה אני צריך לעשות עכשיו" */}
      <div
        className="scroll-thin -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
        role="group"
        aria-label="תצוגות מהירות"
      >
        {QUICK_VIEWS.filter((v) => canSeeAll || !v.fullAccessOnly).map((view) => {
          const active = isViewActive(view, filters, currentUserId);
          return (
            <button
              key={view.key}
              /* החיפוש שורד את המעבר בין תצוגות. `patch` מחזיר אובייקט
                 מסננים שלם, ולכן בלי השורה הזו נגיעה בצ׳יפ מחקה בשקט
                 מילת חיפוש שהמשתמש הרגע הקליד. */
              onClick={() =>
                onFiltersChange({
                  ...view.patch(currentUserId),
                  query: filters.query,
                })
              }
              aria-pressed={active}
              // `min-h-11` בטלפון: אלה הפקדים שהעובד נוגע בהם הכי הרבה,
              // והם היו 34px. בשולחן חוזרים ל-30px ושום דבר לא זז.
              className={`min-h-11 shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors active:scale-95 lg:min-h-0 lg:active:scale-100 ${
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

      {/* קוביות הסטטוס — מצב התור וגם הסינון, באותו פקד */}
      <StatusTiles
        counts={counts}
        active={filters.status}
        compact={compact}
        onExpand={onExpandStatuses}
        onToggle={(status) => {
          const on = filters.status.includes(status);
          onFiltersChange({
            ...filters,
            status: on
              ? filters.status.filter((s) => s !== status)
              : [...filters.status, status],
          });
        }}
        onClear={() => onFiltersChange({ ...filters, status: [] })}
      />
    </header>
  );
}

function Dot() {
  return <span className="text-ink-4">·</span>;
}
