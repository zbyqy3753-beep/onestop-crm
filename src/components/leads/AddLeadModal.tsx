"use client";

import { useState, useTransition } from "react";
import type { UserRef } from "@/lib/domain/types";
import { createLeadAction } from "@/app/(app)/leads/actions";
import { Button, Modal } from "@/components/ui/primitives";
import { LeadFields } from "./LeadFields";

export function AddLeadModal({
  open,
  users,
  onClose,
  onNotify,
}: {
  open: boolean;
  users: UserRef[];
  onClose: () => void;
  onNotify: (message: string, tone?: "good" | "bad") => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  /**
   * התוצאה מטופלת כאן ולא ב-effect: הסגירה היא תוצאה ישירה של
   * השליחה, לא של שינוי מצב שצריך להגיב אליו.
   * כישלון משאיר את הטופס פתוח עם מה שהמשתמש הקליד.
   */
  function submit(formData: FormData) {
    startSubmit(async () => {
      const result = await createLeadAction(null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onNotify("הליד נוצר");
      onClose();
    });
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="ליד חדש" wide>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <LeadFields users={users} showNote />

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
            {pending ? "שומר…" : "יצירת ליד"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
