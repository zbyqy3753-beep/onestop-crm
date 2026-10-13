"use client";

import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";
import { canLeadTeam } from "@/lib/domain/permissions";
import { Field, inputClass } from "@/components/ui/primitives";

/**
 * שיוך המשתמש לבעל עסק — מה שמאפשר לבעל העסק לראות את הלידים שלו.
 *
 * מוצג תמיד, כמו שדה שם המקור: השרת מתעלם ממנו לתפקידים שאינם עובד
 * מן השורה (`canJoinTeam`), ולכן אין צורך במצב טופס מבוקר.
 */
export function TeamOwnerField({
  users,
  defaultValue,
  excludeId,
}: {
  users: User[];
  defaultValue?: string;
  /** המשתמש שנערך — לא מוצע כבעל העסק של עצמו */
  excludeId?: string;
}) {
  const owners = users.filter(
    (u) => canLeadTeam(u.role) && u.id !== excludeId,
  );

  return (
    <Field
      label="משויך לבעל עסק"
      hint="בעל העסק יראה וינהל את הלידים של העובד. לעובד, סוכן ומתפעל בלבד"
    >
      <select
        name="teamOwnerId"
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      >
        <option value="">ללא שיוך</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} · {ROLE_CONFIG[o.role].label}
            {o.store ? ` · ${o.store}` : ""}
          </option>
        ))}
      </select>
    </Field>
  );
}
