"use client";

import type { Deal, Lead, Package } from "@/lib/domain/types";
import { DEAL_STAGE_CONFIG, LEAD_CATEGORY_CONFIG, PROVIDER_CONFIG } from "@/lib/domain/types";
import { date, money, phone as formatPhone } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";
import { DealStageStepper } from "./DealStageStepper";

/**
 * כרטיס עסקה בודדת. הרצועה הצדדית (`spine`) צבועה לפי ספק החבילה
 * הראשית — אותה מוסכמה כמו `PackageCard` בקטלוג החבילות.
 */
export function MyDealCard({
  deal,
  lead,
  packages,
}: {
  deal: Deal;
  lead: Lead | undefined;
  packages: Package[];
}) {
  const primaryPackage = packages[0];
  const totalPrice = packages.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const accent = primaryPackage
    ? PROVIDER_CONFIG[primaryPackage.provider].accent
    : "var(--c-neutral)";
  const isOffRamp = deal.currentStage === "rejected" || deal.currentStage === "cancelled";

  return (
    <article
      className="spine rounded-card border border-line bg-surface p-3.5 ps-4 transition-shadow hover:shadow-card"
      style={{ "--spine-c": accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="nums text-xs font-semibold text-ink-4">
              #{deal.displayId}
            </span>
            <Badge tone="neutral">{LEAD_CATEGORY_CONFIG[deal.category].label}</Badge>
          </div>
          <h3 className="mt-1 font-semibold leading-tight">
            {lead?.name ?? "לקוח לא ידוע"}
          </h3>
          {lead?.phone && (
            <p className="nums mt-0.5 text-xs text-ink-3">{formatPhone(lead.phone)}</p>
          )}
        </div>

        {!isOffRamp && (
          <Badge tone={DEAL_STAGE_CONFIG[deal.currentStage].tone}>
            {DEAL_STAGE_CONFIG[deal.currentStage].label}
          </Badge>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-sm">
        <div>
          <p className="font-medium leading-tight">
            {packages.map((p) => p.name).join(" + ") || "—"}
          </p>
          {primaryPackage && (
            <p className="mt-0.5 text-xs text-ink-4">
              {PROVIDER_CONFIG[primaryPackage.provider].label}
            </p>
          )}
        </div>
        <div className="text-end">
          <p className="nums font-semibold">{money(totalPrice)}</p>
          <p className="mt-0.5 text-xs text-ink-4">{date(deal.closedAt)}</p>
        </div>
      </div>

      <DealStageStepper
        category={deal.category}
        currentStage={deal.currentStage}
        stageHistory={deal.stageHistory}
      />
    </article>
  );
}
