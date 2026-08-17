"use client";

import { useState, useTransition } from "react";
import type { Lead, UserRef } from "@/lib/domain/types";
import { updateLeadAction } from "@/app/(app)/leads/actions";
import { Button, Modal } from "@/components/ui/primitives";
import { LeadFields } from "./LeadFields";

/**
 * עריכת פרטי הליד.
 *
 * חלונית ולא הרחבה של המגירה: המגירה היא מסך העבודה השוטף (סטטוס,
 * הערות, היסטוריה) ועריכת פרטי הזיהוי היא פעולה נדירה יותר שמרוויחה
 * מ״אשר / בטל״ מפורש.
 */
export function EditLeadModal({
  open,
  lead,
  users,
  onClose,
  onNotify,
}: {
  open: boolean;
  lead: Lead | null;
  users: UserRef[];
  onClose: () => void;
  onNotify: (message: string, tone?: "good" | "bad") => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  function submit(formData: FormData) {
    if (!lead) return;

    startSubmit(async () => {
      const result = await updateLeadAction(lead.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onNotify("הליד עודכן");
      onClose();
    });
  }

  if (!open || !lead) return null;

  return (
    <Modal open onClose={onClose} title={`עריכת ${lead.name}`} wide>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <LeadFields users={users} lead={lead} />

        {error && (
          <p
            role="alert"
            className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad sm:col-span-2"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "שומר…" : "שמירת שינויים"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
