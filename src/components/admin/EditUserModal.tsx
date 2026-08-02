"use client";

import { useState, useTransition } from "react";
import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG, ROLE_ORDER } from "@/lib/domain/types";
import { updateUserAction } from "@/app/(app)/admin/actions";
import { Button, Field, Modal, inputClass } from "@/components/ui/primitives";

/**
 * עריכת משתמש קיים.
 *
 * אימייל מוצג אבל נעול: הוא המפתח לחשבון ה-Supabase Auth שהמשתמש
 * מתחבר איתו, ושינוי שלו רק אצלנו היה מנתק את השניים. הצגתו בכל
 * זאת — כדי שיהיה ברור על איזה חשבון עובדים.
 *
 * הכללים המלאים (מי רשאי לערוך את מי) נאכפים בשרת ב-`updateUserAction`;
 * מה שכאן הוא נוחות תצוגה בלבד.
 */
export function EditUserModal({
  user,
  onClose,
}: {
  /** המשתמש לעריכה, או `null` כשהמודל סגור */
  user: User | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  function submit(formData: FormData) {
    if (!user) return;
    startSubmit(async () => {
      const result = await updateUserAction(user.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  if (!user) return null;

  return (
    <Modal open onClose={onClose} title={`עריכת ${user.name}`} wide>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="שם מלא">
          <input
            name="name"
            required
            defaultValue={user.name}
            className={inputClass}
          />
        </Field>

        <Field label="תפקיד">
          <select name="role" defaultValue={user.role} className={inputClass}>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="אימייל" hint="לא ניתן לשינוי — משמש להתחברות">
          <input
            value={user.email}
            disabled
            className={`${inputClass} opacity-60`}
          />
        </Field>

        <Field label="טלפון">
          <input
            name="phone"
            inputMode="tel"
            defaultValue={user.phone ?? ""}
            placeholder="0501234567"
            className={`${inputClass} ltr-num text-start`}
          />
        </Field>

        <Field label="חנות/עסק" hint="אופציונלי">
          <input
            name="store"
            defaultValue={user.store ?? ""}
            className={inputClass}
          />
        </Field>

        <Field label="סטטוס">
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={user.active}
              className="accent-[var(--c-brand)]"
            />
            משתמש פעיל
          </label>
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
            {pending ? "שומר…" : "שמירת שינויים"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
