"use client";

import { money, number } from "@/lib/format";
import type { DealRow } from "./DealsTable";
import { RANGE_OPTIONS, type DealFilters } from "./filters";

/**
 * כותרת המסך: מה קרה בטווח הנבחר, במבט אחד.
 *
 * שורת הצ׳יפים היא ציר הזמן — הבחירה הראשונה שמנהל עושה כשהוא
 * נכנס למסך היא "איזו תקופה מעניינת אותי", לא איזה סוכן.
 */
export function DealsSummary({
  rows,
  totalDeals,
  filters,
  onFiltersChange,
}: {
  rows: DealRow[];
  totalDeals: number;
  filters: DealFilters;
  onFiltersChange: (f: DealFilters) => void;
}) {
  const revenue = rows.reduce((sum, r) => sum + r.deal.revenue, 0);
  const commission = rows.reduce((sum, r) => sum + r.commission, 0);
  const profit = rows.reduce((sum, r) => sum + r.profit, 0);

  return (
    <header className="mb-5">
      <div className="mb-4">
        <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
          מעקב עסקאות
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          {rows.length === totalDeals ? (
            <>
              <span className="nums font-semibold text-ink-1">
                {number(totalDeals)}
              </span>{" "}
              עסקאות בסך הכל
            </>
          ) : (
            <>
              <span className="nums font-semibold text-ink-1">
                {number(rows.length)}
              </span>{" "}
              מתוך {number(totalDeals)} עסקאות
            </>
          )}
        </p>
      </div>

      {/* טווח תאריכים — הבחירה הראשונה */}
      <div
        className="scroll-thin scroll-x-cue -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="טווח תאריכים"
      >
        {RANGE_OPTIONS.map((opt) => {
          const active = filters.range === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onFiltersChange({ ...filters, range: opt.key })}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/*
        שורת סיכום.

        ⚠️ עמודה אחת בבסיס ולא שלוש. `grid-cols-3` כבר ב-breakpoint
        הבסיסי נתן ~100px לאריח בטלפון של 360px, ומתוכם ~74px לסכום
        בגופן `text-xl` — מספרי הכנסה נשברו או נחתכו. (ה-`sm:grid-cols-3`
        שהיה כאן גם חזר על הבסיס ולא עשה כלום.)
      */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Stat label="הכנסה" value={money(revenue)} />
        <Stat label="עמלה" value={money(commission)} />
        <Stat
          label="רווח"
          value={money(profit)}
          tone={profit >= 0 ? "good" : "bad"}
        />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "good" | "bad";
}) {
  const valueClass =
    tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink-1";

  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`nums mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
