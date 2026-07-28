"use client";

import { number } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { inputClass } from "@/components/ui/primitives";

export const PAGE_SIZES = [10, 20, 30, 50, 70];

/**
 * עימוד לטבלת הלידים.
 *
 * הכל בכיוון לוגי (`start`/`end`), כולל השברונים: ב-RTL "הקודם" נמצא
 * מימין, ולכן האייקון מסובב ב-180 מעלות בדיוק כמו בכותרות המיון.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-3 py-2.5">
      <label className="flex items-center gap-2 text-xs text-ink-3">
        הצג
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="מספר שורות בעמוד"
          className={`${inputClass} h-8 w-auto py-0 text-xs`}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        לידים
      </label>

      <p className="nums text-xs text-ink-3">
        {number(from)}–{number(to)} מתוך {number(total)}
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="ניווט בין עמודים">
          <PageArrow
            direction="prev"
            disabled={safePage === 1}
            onClick={() => onPageChange(safePage - 1)}
          />

          {pageItems(safePage, totalPages).map((item, i) =>
            item === "gap" ? (
              <span key={`gap:${i}`} className="px-1 text-xs text-ink-4">
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                aria-current={item === safePage ? "page" : undefined}
                className={`nums min-w-8 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  item === safePage
                    ? "bg-brand text-on-brand"
                    : "text-ink-2 hover:bg-surface-3 hover:text-ink-1"
                }`}
              >
                {item}
              </button>
            ),
          )}

          <PageArrow
            direction="next"
            disabled={safePage === totalPages}
            onClick={() => onPageChange(safePage + 1)}
          />
        </nav>
      )}
    </div>
  );
}

function PageArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const prev = direction === "prev";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={prev ? "העמוד הקודם" : "העמוד הבא"}
      className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {/* chevronLeft מצביע לכיוון ההתקדמות; "הקודם" הוא ההיפוך שלו */}
      <Icon name="chevronLeft" size={14} className={prev ? "rotate-180" : ""} />
    </button>
  );
}

/**
 * רשימת העמודים להצגה: תמיד הראשון והאחרון, שכן אחד סביב הנוכחי,
 * ו"…" במקום כל מה שנחתך.
 */
function pageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}
