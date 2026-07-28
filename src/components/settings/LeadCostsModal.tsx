"use client";

import { useState, useTransition } from "react";
import type { LeadCostTable } from "@/lib/domain/types";
import { LEAD_CATEGORY_CONFIG, LEAD_CATEGORY_ORDER } from "@/lib/domain/types";
import { saveLeadCostsAction } from "@/app/(app)/packages/actions";
import {
  Button,
  Modal,
  inputClass,
  type Toast,
} from "@/components/ui/primitives";

/**
 * עריכת עלות הליד לפי קטגוריה.
 *
 * יושב ב-`settings/` ולא מתחת ל-`packages/` כי שני מסכים צריכים אותו:
 * הקטלוג (שם מחשבים רווח לכל חבילה) ומסך הלידים (שם מחשבים את הפאנל
 * הפיננסי). מקור אמת אחד לטופס אחד.
 */
export function LeadCostsModal({
  open,
  costs,
  onClose,
  onNotify,
}: {
  open: boolean;
  costs: LeadCostTable;
  onClose: () => void;
  onNotify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(LEAD_CATEGORY_ORDER.map((c) => [c, String(costs[c])])),
  );
  const [saving, startSave] = useTransition();

  function save() {
    const parsed: Record<string, number> = {};
    for (const c of LEAD_CATEGORY_ORDER) parsed[c] = Number(draft[c]);

    startSave(async () => {
      const res = await saveLeadCostsAction(parsed);
      if (!res.ok) return onNotify(res.error, "bad");
      onNotify("העלויות נשמרו");
      onClose();
    });
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="עלות ליד לפי קטגוריה">
      <p className="mb-3 text-sm text-ink-2">
        העלות נגרעת מהעמלה כדי לחשב את הרווח נטו על כל עסקה.
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {LEAD_CATEGORY_ORDER.map((c) => (
          <label key={c} className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">
              {LEAD_CATEGORY_CONFIG[c].label}
            </span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={draft[c]}
              onChange={(e) => setDraft({ ...draft, [c]: e.target.value })}
              className={`${inputClass} nums`}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose} disabled={saving}>
          ביטול
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירת עלויות"}
        </Button>
      </div>
    </Modal>
  );
}
