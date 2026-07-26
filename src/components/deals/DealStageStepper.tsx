"use client";

import type { DealStage, DealStageEvent, LeadCategoryKey } from "@/lib/domain/types";
import { DEAL_STAGE_CONFIG, STAGE_PIPELINE_FOR_CATEGORY } from "@/lib/domain/types";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

/**
 * סטפר רב-שלבי למעקב הזמנה.
 *
 * `rejected`/`cancelled` הם off-ramp — יכולים לקרות בכל נקודה בצנרת
 * ואינם חלק מהרצף הליניארי (ראה `STAGE_PIPELINE_FOR_CATEGORY`), ולכן
 * מקבלים תג אדום נפרד במקום להיכנס בכוח לתוך הסטפר.
 */
export function DealStageStepper({
  category,
  currentStage,
  stageHistory,
}: {
  category: LeadCategoryKey;
  currentStage: DealStage;
  stageHistory: DealStageEvent[];
}) {
  const pipeline = STAGE_PIPELINE_FOR_CATEGORY[category];
  const isOffRamp = currentStage === "rejected" || currentStage === "cancelled";

  if (isOffRamp) {
    return (
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
        <Badge tone={DEAL_STAGE_CONFIG[currentStage].tone}>
          {DEAL_STAGE_CONFIG[currentStage].label}
        </Badge>
        <span className="text-xs text-ink-4">מעקב ההזמנה נעצר בשלב זה</span>
      </div>
    );
  }

  const currentIndex = pipeline.indexOf(currentStage);
  const historyStages = new Set(stageHistory.map((e) => e.to));

  return (
    <div className="mt-3 border-t border-line pt-3">
      <ol className="scroll-thin flex items-center overflow-x-auto pb-1">
        {pipeline.map((stage, i) => {
          const passed = i <= currentIndex || historyStages.has(stage);
          const isCurrent = stage === currentStage;

          return (
            <li
              key={stage}
              className="flex shrink-0 items-center last:shrink last:grow-0"
              title={DEAL_STAGE_CONFIG[stage].label}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  isCurrent
                    ? "bg-brand text-on-brand"
                    : passed
                      ? "bg-good text-white"
                      : "bg-surface-3 text-ink-4"
                }`}
              >
                {passed && !isCurrent ? <Icon name="check" size={11} /> : i + 1}
              </span>
              {i < pipeline.length - 1 && (
                <span
                  className={`mx-1 h-0.5 w-6 shrink-0 rounded sm:w-9 ${
                    i < currentIndex ? "bg-good" : "bg-line"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-1.5 text-xs text-ink-3">
        שלב נוכחי:{" "}
        <span className="font-medium text-ink-1">
          {DEAL_STAGE_CONFIG[currentStage].label}
        </span>
      </p>
    </div>
  );
}
