"use client";

import { useState } from "react";
import type { LeadStatus } from "@/lib/domain/types";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { Button, Modal, inputClass } from "@/components/ui/primitives";

/**
 * נפתח כשסטטוס דורש פירוט.
 *
 * זו הנקודה שבה נוצרת היסטוריית הליד: בלי הפירוט, "לא מעוניין"
 * הוא מילה אחת שאי אפשר ללמוד ממנה כלום.
 */
export function StatusDialog({
  target,
  onCancel,
  onConfirm,
  busy,
}: {
  target: { leadIds: string[]; to: LeadStatus } | null;
  onCancel: () => void;
  onConfirm: (detail: string, followUpDate?: string) => void;
  busy: boolean;
}) {
  // מתאפס בין פתיחות דרך ה-key שההורה נותן, לא דרך effect
  const [detail, setDetail] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  if (!target) return null;

  const meta = STATUS_CONFIG[target.to];
  const prompt = meta.prompt;
  const many = target.leadIds.length > 1;
  const blocked = Boolean(prompt?.required) && !detail.trim();

  // רק שני הסטטוסים האלה שומרים תזכורת חזרה — ראה changeStatus ברפוזיטורי
  const wantsFollowUp =
    target.to === "followUp" || target.to === "futureTracking";

  return (
    <Modal
      open
      onClose={onCancel}
      title={many ? `עדכון ${target.leadIds.length} לידים` : "עדכון סטטוס"}
    >
      <p className="mb-3 text-sm text-ink-2">
        הסטטוס ישתנה ל
        <strong className="font-semibold text-ink-1">״{meta.label}״</strong>
        {many && ` עבור ${target.leadIds.length} לידים`}.
      </p>

      {prompt && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            {prompt.question}
            {!prompt.required && (
              <span className="font-normal text-ink-4"> (אופציונלי)</span>
            )}
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={prompt.placeholder}
            rows={3}
            autoFocus
            className={`${inputClass} resize-y`}
          />
        </label>
      )}

      {wantsFollowUp && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            תאריך חזרה
            <span className="font-normal text-ink-4"> (אופציונלי)</span>
          </span>
          <input
            type="date"
            value={followUpDate}
            min={today()}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className={`${inputClass} nums`}
          />
          <span className="mt-1 block text-xs text-ink-4">
            הליד יופיע בתצוגה ״לחזור היום״ בתאריך שנבחר.
          </span>
        </label>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel} disabled={busy}>
          ביטול
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(detail, followUpDate || undefined)}
          disabled={busy || blocked}
        >
          {busy ? "שומר…" : "עדכון"}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * היום בפורמט של `<input type="date">`, בשעון המקומי.
 * `toISOString()` היה מחזיר UTC ובישראל זה נופל ליום הקודם בלילה.
 */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
