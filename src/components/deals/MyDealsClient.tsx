"use client";

import { useMemo } from "react";
import type { Deal, Lead, Package, PackageId } from "@/lib/domain/types";
import { number } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";
import { MyDealCard } from "./MyDealCard";

/**
 * מסך "העסקאות שלי" — מעקב תפעולי אישי (כרטיס + סטפר), לא טבלת
 * רווח כמו `/deals`. בלי מוטציות, בלי server actions — תצפית בלבד.
 */
export function MyDealsClient({
  deals,
  leads,
  packages,
}: {
  deals: Deal[];
  leads: Lead[];
  packages: Package[];
}) {
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const packageById = useMemo(
    () => new Map<PackageId, Package>(packages.map((p) => [p.id, p])),
    [packages],
  );

  const sortedDeals = useMemo(
    () => [...deals].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt)),
    [deals],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-bold leading-tight">העסקאות שלי</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          {number(deals.length)} עסקאות · מעקב אחר שלבי ההזמנה של כל עסקה
        </p>
      </header>

      {sortedDeals.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon="myDeals"
            title="אין עדיין עסקאות"
            body="עסקאות שתסגור יופיעו כאן עם מעקב שלבי ההזמנה שלהן."
          />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {sortedDeals.map((deal) => (
            <MyDealCard
              key={deal.id}
              deal={deal}
              lead={leadById.get(deal.leadId)}
              packages={deal.packageIds
                .map((id) => packageById.get(id))
                .filter((p): p is Package => Boolean(p))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
