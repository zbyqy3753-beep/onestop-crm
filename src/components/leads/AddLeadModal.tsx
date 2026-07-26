"use client";

import { useState, useTransition } from "react";
import type { User } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  KIND_ORDER,
  LEAD_CATEGORY_CONFIG,
  LEAD_CATEGORY_ORDER,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  PROVIDER_CONFIG,
  PROVIDER_ORDER,
} from "@/lib/domain/types";
import { createLeadAction } from "@/app/(app)/leads/actions";
import { Button, Field, Modal, inputClass } from "@/components/ui/primitives";

export function AddLeadModal({
  open,
  users,
  onClose,
  onNotify,
}: {
  open: boolean;
  users: User[];
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
        <Field label="שם מלא">
          <input
            name="name"
            required
            autoFocus
            placeholder="ישראל ישראלי"
            className={inputClass}
          />
        </Field>

        <Field label="טלפון" hint="מספר ישראלי, מתחיל ב-0">
          <input
            name="phone"
            required
            inputMode="tel"
            placeholder="0501234567"
            className={`${inputClass} ltr-num text-start`}
          />
        </Field>

        <Field label="אימייל">
          <input
            name="email"
            type="email"
            placeholder="name@example.co.il"
            className={inputClass}
          />
        </Field>

        <Field label="עיר">
          <input name="city" placeholder="תל אביב" className={inputClass} />
        </Field>

        <Field label="סוג הליד">
          <select name="kind" defaultValue="data" className={inputClass}>
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_CONFIG[k].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="עדיפות">
          <select name="priority" defaultValue="normal" className={inputClass}>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="קטגוריית עניין">
          <select name="category" defaultValue="" className={inputClass}>
            <option value="">לא ידוע</option>
            {LEAD_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {LEAD_CATEGORY_CONFIG[c].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="ספק נוכחי">
          <select name="currentProvider" defaultValue="" className={inputClass}>
            <option value="">לא ידוע</option>
            {PROVIDER_ORDER.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_CONFIG[p].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="שיוך לעובד">
          <select name="assigneeId" defaultValue="" className={inputClass}>
            <option value="">ללא שיוך (ברירת מחדל — אליי)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="הערה ראשונית">
            <textarea
              name="note"
              rows={2}
              placeholder="מאיפה הגיע, מה ביקש…"
              className={`${inputClass} resize-y`}
            />
          </Field>
        </div>

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
