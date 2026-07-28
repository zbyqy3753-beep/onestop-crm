"use client";

import { money } from "@/lib/format";
import { Button } from "@/components/ui/primitives";

/**
 * המספרים הכספיים של מה שמוצג כרגע במסך.
 *
 * הכל נגזר מהקבוצה **המסוננת** ולא מכלל המערכת — הפאנל אמור לענות על
 * "כמה שווה החתך שאני מסתכל עליו עכשיו", ולכן הוא זז יחד עם המסננים.
 */
export function LeadsFinancePanel({
  cost,
  commission,
  onEditCosts,
}: {
  cost: number;
  commission: number;
  onEditCosts: () => void;
}) {
  const profit = commission - cost;

  return (
    <section className="mb-4" aria-label="נתונים פיננסיים">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-2">נתונים פיננסיים</h2>
        <Button variant="ghost" onClick={onEditCosts}>
          עדכון עלות לידים
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Stat label="עלות לידים" value={money(cost)} />
        <Stat label="עמלות מסגירה" value={money(commission)} />
        <Stat
          label="רווח (עמלות − עלות לידים)"
          value={money(profit)}
          tone={profit >= 0 ? "good" : "bad"}
        />
      </div>
    </section>
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
