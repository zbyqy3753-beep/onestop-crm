"use client";

import type { Deal, Lead, Package, User } from "@/lib/domain/types";
import { DEAL_STAGE_CONFIG, PROVIDER_CONFIG } from "@/lib/domain/types";
import { date, money, phone } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export interface DealRow {
  deal: Deal;
  lead?: Lead;
  agent?: User;
  packages: Package[];
  commission: number;
  profit: number;
}

export type DealSortField = "closedAt" | "revenue" | "commission" | "profit" | "agent";

export interface DealSort {
  field: DealSortField;
  direction: "asc" | "desc";
}

const COLUMNS: { field: DealSortField; label: string }[] = [
  { field: "closedAt", label: "נסגר" },
  { field: "agent", label: "סוכן" },
  { field: "revenue", label: "הכנסה" },
  { field: "commission", label: "עמלה" },
  { field: "profit", label: "רווח" },
];

export function DealsTable({
  rows,
  sort,
  onSortChange,
  hasFilters,
}: {
  rows: DealRow[];
  sort: DealSort;
  onSortChange: (s: DealSort) => void;
  hasFilters: boolean;
}) {
  function sortBy(field: DealSortField) {
    onSortChange(
      sort.field === field
        ? { field, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          icon="deals"
          title={hasFilters ? "אין עסקאות שתואמות לסינון" : "אין עסקאות בטווח הזה"}
          body={
            hasFilters
              ? "נסה להסיר חלק מהמסננים או להרחיב את טווח התאריכים."
              : "נסה טווח תאריכים רחב יותר."
          }
        />
      </div>
    );
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="sticky top-[60px] z-10 bg-surface-2">
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-3 py-2.5 text-start font-medium">לקוח</th>
            <th className="px-3 py-2.5 text-start font-medium">חבילות</th>
            <th className="px-3 py-2.5 text-start font-medium">שלב</th>
            {COLUMNS.map((col) => (
              <th
                key={col.field}
                className={`px-3 py-2.5 font-medium ${col.field === "agent" ? "text-start" : "text-end"}`}
              >
                <button
                  onClick={() => sortBy(col.field)}
                  className={`inline-flex items-center gap-1 hover:text-ink-1 ${
                    col.field === "agent" ? "" : "flex-row-reverse"
                  }`}
                >
                  {col.label}
                  {sort.field === col.field && (
                    <Icon
                      name="chevronDown"
                      size={13}
                      className={sort.direction === "asc" ? "rotate-180" : ""}
                    />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <Row key={row.deal.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: DealRow }) {
  const { deal, lead, agent, packages, commission, profit } = row;
  const primaryProvider = packages[0]?.provider;

  return (
    <tr
      className="border-b border-line last:border-0 hover:bg-surface-2"
      style={
        {
          "--spine-c": primaryProvider
            ? PROVIDER_CONFIG[primaryProvider].accent
            : "transparent",
        } as React.CSSProperties
      }
    >
      {/* `spine-cell` ולא `spine` על ה-`<tr>` — ראה globals.css */}
      <td className="spine-cell px-3 py-2.5">
        <p className="max-w-[200px] truncate font-semibold text-ink-1">
          {lead?.name ?? "לקוח לא ידוע"}
        </p>
        {lead && <p className="ltr-num mt-0.5 text-xs text-ink-3">{phone(lead.phone)}</p>}
      </td>

      <td className="px-3 py-2.5">
        <p className="max-w-[220px] truncate text-ink-2">
          {packages.map((p) => p.name).join(" + ") || "—"}
        </p>
      </td>

      <td className="px-3 py-2.5">
        <Badge tone={DEAL_STAGE_CONFIG[deal.currentStage].tone}>
          {DEAL_STAGE_CONFIG[deal.currentStage].label}
        </Badge>
      </td>

      <td className="px-3 py-2.5 text-end text-xs text-ink-3">{date(deal.closedAt)}</td>

      <td className="px-3 py-2.5 text-ink-2">{agent?.name ?? "—"}</td>

      <td className="nums px-3 py-2.5 text-end font-medium">{money(deal.revenue)}</td>

      <td className="nums px-3 py-2.5 text-end text-ink-2">{money(commission)}</td>

      <td
        className={`nums px-3 py-2.5 text-end font-bold ${
          profit >= 0 ? "text-good" : "text-bad"
        }`}
      >
        {money(profit)}
      </td>
    </tr>
  );
}
