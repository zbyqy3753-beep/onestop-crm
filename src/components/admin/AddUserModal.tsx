"use client";

import { useState, useTransition } from "react";
import { ROLE_CONFIG, ROLE_ORDER } from "@/lib/domain/types";
import { createUserAction } from "@/app/(app)/admin/actions";
import { Button, Field, Modal, inputClass } from "@/components/ui/primitives";

export function AddUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  function submit(formData: FormData) {
    startSubmit(async () => {
      const result = await createUserAction(null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="משתמש חדש" wide>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="שם מלא">
          <input
            name="name"
            required
            autoFocus
            placeholder="ישראל ישראלי"
            className={inputClass}
          />
        </Field>

        <Field label="תפקיד">
          <select name="role" defaultValue="agent" className={inputClass}>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="אימייל" hint="ישמש להתחברות למערכת">
          <input
            name="email"
            type="email"
            required
            placeholder="name@onestop.co.il"
            className={inputClass}
          />
        </Field>

        <Field label="טלפון" hint="נדרש לקבלת תזכורות חזרה בוואטסאפ">
          <input
            name="phone"
            inputMode="tel"
            placeholder="0501234567"
            className={`${inputClass} ltr-num text-start`}
          />
        </Field>

        <Field label="חנות/עסק" hint="אופציונלי">
          <input name="store" placeholder="" className={inputClass} />
        </Field>

        <Field label="סיסמה ראשונית" hint="לפחות 6 תווים">
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className={inputClass}
          />
        </Field>

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
            {pending ? "שומר…" : "יצירת משתמש"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
