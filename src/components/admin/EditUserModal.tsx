"use client";

import { useState, useTransition } from "react";
import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG, ROLE_ORDER } from "@/lib/domain/types";
import {
  deleteUserAction,
  updateUserAction,
} from "@/app/(app)/admin/actions";
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
  canDelete,
  onClose,
}: {
  /** המשתמש לעריכה, או `null` כשהמודל סגור */
  user: User | null;
  /**
   * בעלים בלבד, ולא על עצמו. הסתרה של פקד ולא הרשאה —
   * `deleteUserAction` בודקת את התפקיד ואת הזהות בעצמה.
   */
  canDelete: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();
  /**
   * שלב האישור, לא `window.confirm`.
   *
   * ⚠️ דיאלוג המערכת נחסם בחלק מהדפדפנים בטלפון, ואז המחיקה פשוט
   * לא קורית בלי שום הודעה. אישור בתוך המודל עובד בכל מקום, וגם
   * מאפשר לנסח בעברית מה בדיוק עומד להימחק.
   */
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

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

  function remove() {
    if (!user) return;
    startDelete(async () => {
      const result = await deleteUserAction(user.id);
      if (!result.ok) {
        setError(result.error);
        // חזרה למצב הרגיל: ההודעה מסבירה שהמחיקה חסומה (למשל יש לו
        // לידים), ושורת האישור הפתוחה הייתה מזמינה לחיצה נוספת על
        // כפתור שכבר ידוע שייכשל.
        setConfirming(false);
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

        {/* `type="text"` — ראה ההערה ב-LoginForm */}
        <Field
          label="שם משתמש"
          hint="משמש להתחברות — שינוי מעדכן גם את חשבון הכניסה"
        >
          <input
            name="email"
            type="text"
            dir="ltr"
            autoComplete="off"
            defaultValue={user.email}
            className={`${inputClass} text-start`}
          />
        </Field>

        <Field label="סיסמה חדשה" hint="להשאיר ריק כדי לא לשנות">
          <input
            name="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            placeholder="••••••••"
            className={`${inputClass} text-start`}
          />
        </Field>

        <Field label="טלפון" hint="נדרש לקבלת תזכורות חזרה בוואטסאפ">
          <input
            name="phone"
            inputMode="tel"
            defaultValue={user.phone ?? ""}
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
            defaultValue={(user.extraPhones ?? []).join(", ")}
            placeholder="0521234567, 0539876543"
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

        {/* ראה ההערה המקבילה ב-AddUserModal */}
        <Field
          label="שם המקור (ספק לידים)"
          hint="חובה לספק — הערך שמופיע בעמודת ״מקור״ בלידים שלו"
        >
          <input
            name="leadSourceName"
            defaultValue={user.leadSourceName ?? ""}
            placeholder="לדוגמה: עידן"
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

        <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
          {/* המחיקה בקצה הנגדי של השורה, ולא צמודה ל"שמירת שינויים" */}
          {canDelete && !confirming && (
            <Button
              type="button"
              icon="trash"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={pending || deleting}
              className="me-auto text-bad"
            >
              מחיקת משתמש
            </Button>
          )}

          {canDelete && confirming && (
            <div className="me-auto flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-2">
                למחוק את {user.name} לצמיתות?
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={remove}
                disabled={deleting}
              >
                {deleting ? "מוחק…" : "כן, למחוק"}
              </Button>
              <Button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                לא
              </Button>
            </div>
          )}

          <Button type="button" onClick={onClose} disabled={pending || deleting}>
            ביטול
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={pending || deleting}
          >
            {pending ? "שומר…" : "שמירת שינויים"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
