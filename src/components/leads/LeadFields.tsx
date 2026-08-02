"use client";

import type { Lead, User } from "@/lib/domain/types";
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
import { Field, inputClass } from "@/components/ui/primitives";

/**
 * שדות הליד, משותפים ליצירה ולעריכה.
 *
 * חסרי-state בכוונה — `defaultValue` בלבד, כך שהטופס העוטף שולט
 * במחזור החיים ושתי החלוניות מקבלות בדיוק את אותם שדות וכללים.
 * `lead` הוא הערכים ההתחלתיים; בלעדיו זה טופס ריק ליצירה.
 *
 * ההערה הראשונית שייכת רק ליצירה — בעריכה מוסיפים הערות מהמגירה,
 * ושדה כזה היה נראה כאילו הוא דורס את הקיימות.
 */
export function LeadFields({
  users,
  lead,
  showNote = false,
}: {
  users: User[];
  lead?: Lead;
  showNote?: boolean;
}) {
  return (
    <>
      <Field label="שם מלא">
        <input
          name="name"
          required
          autoFocus
          defaultValue={lead?.name}
          placeholder="ישראל ישראלי"
          className={inputClass}
        />
      </Field>

      <Field label="טלפון" hint="מספר ישראלי, מתחיל ב-0">
        <input
          name="phone"
          required
          inputMode="tel"
          defaultValue={lead?.phone}
          placeholder="0501234567"
          className={`${inputClass} ltr-num text-start`}
        />
      </Field>

      <Field label="אימייל">
        <input
          name="email"
          type="email"
          defaultValue={lead?.email ?? ""}
          placeholder="name@example.co.il"
          className={inputClass}
        />
      </Field>

      <Field label="עיר">
        <input
          name="city"
          defaultValue={lead?.city ?? ""}
          placeholder="תל אביב"
          className={inputClass}
        />
      </Field>

      <Field label="סוג הליד">
        <select name="kind" defaultValue={lead?.kind ?? "data"} className={inputClass}>
          {KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {KIND_CONFIG[k].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="עדיפות">
        <select
          name="priority"
          defaultValue={lead?.priority ?? "normal"}
          className={inputClass}
        >
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_CONFIG[p].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="קטגוריית עניין">
        <select
          name="category"
          defaultValue={lead?.category ?? ""}
          className={inputClass}
        >
          <option value="">לא ידוע</option>
          {LEAD_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {LEAD_CATEGORY_CONFIG[c].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="חבילה" hint="החבילה שהלקוח התעניין בה">
        <input
          name="packageName"
          defaultValue={lead?.packageName ?? ""}
          placeholder="500GB 5G Together"
          className={inputClass}
        />
      </Field>

      <Field label="מקור" hint="הקמפיין או הערוץ שהליד הגיע ממנו">
        <input
          name="sourceDetail"
          defaultValue={lead?.sourceDetail ?? ""}
          placeholder="קמפיין פייסבוק"
          className={inputClass}
        />
      </Field>

      <Field label="ספק נוכחי">
        <select
          name="currentProvider"
          defaultValue={lead?.currentProvider ?? ""}
          className={inputClass}
        >
          <option value="">לא ידוע</option>
          {PROVIDER_ORDER.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_CONFIG[p].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="שיוך לעובד">
        <select
          name="assigneeId"
          defaultValue={lead?.assigneeId ?? ""}
          className={inputClass}
        >
          <option value="">ללא שיוך (ברירת מחדל — אליי)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>

      {showNote && (
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
      )}
    </>
  );
}
