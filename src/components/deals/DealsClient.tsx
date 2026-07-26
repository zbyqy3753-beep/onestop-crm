"use client";

import { useMemo, useState } from "react";
import type {
  Deal,
  Lead,
  LeadCostTable,
  Package,
  PackageId,
  User,
} from "@/lib/domain/types";
import { netProfit, payableCommission } from "@/server/services/economics";
import { useNow } from "@/lib/clock";
import { DealsSummary } from "./DealsSummary";
import { DealsFilterBar } from "./DealsFilterBar";
import { DealsTable, type DealRow, type DealSort } from "./DealsTable";
import { DEFAULT_DEAL_FILTERS, rangeStart, type DealFilters } from "./filters";

/**
 * מחזיק את מצב מסך "מעקב עסקאות" ומרכיב שורות מוכנות לתצוגה.
 *
 * מסך תצפית בלבד (view-only) — בניגוד למסך הלידים, אין כאן
 * מוטציות, ולכן אין Server Actions ואין טרנזישן.
 */
export function DealsClient({
  deals,
  leads,
  users,
  packages,
  leadCosts,
}: {
  deals: Deal[];
  leads: Lead[];
  users: User[];
  packages: Package[];
  leadCosts: LeadCostTable;
}) {
  const [filters, setFilters] = useState<DealFilters>(DEFAULT_DEAL_FILTERS);
  const [sort, setSort] = useState<DealSort>({
    field: "closedAt",
    direction: "desc",
  });

  const now = useNow();

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const packageById = useMemo(
    () => new Map<PackageId, Package>(packages.map((p) => [p.id, p])),
    [packages],
  );

  /** כל עסקה מורכבת פעם אחת לשורה שלמה — כדי שסינון/מיון/סיכום יעבדו על נתונים מוכנים. */
  const allRows: DealRow[] = useMemo(() => {
    return deals.map((deal) => {
      const dealPackages = deal.packageIds
        .map((id) => packageById.get(id))
        .filter((p): p is Package => Boolean(p));

      return {
        deal,
        lead: leadById.get(deal.leadId),
        agent: userById.get(deal.agentId),
        packages: dealPackages,
        commission: payableCommission(deal.packageIds, packageById),
        profit: netProfit(deal, packageById, leadCosts),
      };
    });
  }, [deals, leadById, userById, packageById, leadCosts]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const start = rangeStart(filters.range, now ?? 0);
    // הטווח לא "all" אבל now עדיין לא נטען — מציג ריק במקום מצב שגוי לרגע
    if (filters.range !== "all" && now === null) return [];

    return allRows.filter((row) => {
      if (start !== null && Date.parse(row.deal.closedAt) < start) return false;
      if (filters.agent.length && !filters.agent.includes(row.deal.agentId))
        return false;

      if (filters.provider.length) {
        const providers = new Set(row.packages.map((p) => p.provider));
        if (!filters.provider.some((p) => providers.has(p))) return false;
      }
      if (filters.category.length) {
        const categories = new Set(row.packages.map((p) => p.category));
        if (!filters.category.some((c) => categories.has(c))) return false;
      }
      if (filters.stage.length && !filters.stage.includes(row.deal.currentStage))
        return false;

      if (q) {
        const haystack = `${row.lead?.name ?? ""} ${row.lead?.phone ?? ""} ${
          row.agent?.name ?? ""
        } ${row.packages.map((p) => p.name).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allRows, filters, now]);

  const sorted = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.field) {
        case "revenue":
          return (a.deal.revenue - b.deal.revenue) * dir;
        case "commission":
          return (a.commission - b.commission) * dir;
        case "profit":
          return (a.profit - b.profit) * dir;
        case "agent":
          return (a.agent?.name ?? "").localeCompare(b.agent?.name ?? "", "he") * dir;
        case "closedAt":
        default:
          return (Date.parse(a.deal.closedAt) - Date.parse(b.deal.closedAt)) * dir;
      }
    });
  }, [filtered, sort]);

  const providerOptions = useMemo(
    () => uniqueSorted(packages.map((p) => p.provider)),
    [packages],
  );
  const categoryOptions = useMemo(
    () => uniqueSorted(packages.map((p) => p.category)),
    [packages],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <DealsSummary
        rows={sorted}
        totalDeals={deals.length}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <DealsFilterBar
        filters={filters}
        onChange={setFilters}
        users={users}
        providerOptions={providerOptions}
        categoryOptions={categoryOptions}
      />

      <DealsTable
        rows={sorted}
        sort={sort}
        onSortChange={setSort}
        hasFilters={hasActiveFilters(filters)}
      />
    </div>
  );
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

function hasActiveFilters(f: DealFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.range !== DEFAULT_DEAL_FILTERS.range ||
    f.agent.length > 0 ||
    f.provider.length > 0 ||
    f.category.length > 0 ||
    f.stage.length > 0
  );
}
