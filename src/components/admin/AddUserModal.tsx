"use client";

import { useState, useTransition } from "react";
import { ROLE_CONFIG, ROLE_ORDER } from "@/lib/domain/types";
import { createUserAction } from "@/app/(app)/admin/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
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

        {/* `type="text"` — ראה ההערה ב-LoginForm */}
        <Field
          label="שם משתמש"
          hint="ישמש להתחברות. אפשר גם כתובת מייל מלאה"
        >
          <input
            name="email"
            type="text"
            required
            dir="ltr"
            placeholder="idan"
            className={`${inputClass} text-start`}
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

        {/* ⚠️ שדה אחד ולא רשימה דינמית של קלטים: המספרים מודבקים
            מאנשי קשר או מוואטסאפ, וכל מפריד סביר מתקבל. */}
        <Field
          label="טלפונים נוספים"
          hint="אפשר כמה, מופרדים בפסיק. התראות יוצאות לכל המספרים"
        >
          <input
            name="extraPhones"
            placeholder="0521234567, 0539876543"
            className={`${inputClass} ltr-num text-start`}
          />
        </Field>

        <Field label="חנות/עסק" hint="אופציונלי">
          <input name="store" placeholder="" className={inputClass} />
        </Field>

        {/*
          מוצג תמיד ולא רק כשנבחר "ספק לידים": הצגה מותנית הייתה
          דורשת מצב בטופס שכולו לא-מבוקר, והשדה ממילא נשמר רק לספקים
          (`createUserAction` מתעלם ממנו לשאר התפקידים).
        */}
        <Field
          label='שם המקור (ספק לידים)'
          hint="חובה לספק — הערך שמופיע בעמודת ״מקור״ בלידים שלו"
        >
          <input
            name="leadSourceName"
            placeholder="לדוגמה: עידן"
            className={inputClass}
          />
        </Field>

        {/* ⚠️ נגזר מהקבוע ולא כתוב ביד. הטקסט הזה נשאר תקוע על
            "לפחות 10 תווים" בזמן שהסף עצמו היה 12 ואז 6 — כלומר המסך
            הבטיח מספר שלא היה נכון באף אחת משתי הגרסאות. */}
        <Field
          label="סיסמה ראשונית"
          hint={`לפחות ${MIN_PASSWORD_LENGTH} תווים`}
        >
          <input
            name="password"
            type="password"
            required
            minLength={10}
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
