"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { actorForRoute } from "@/server/auth/session";
import type { RegistrationStatus } from "@/lib/domain/types";
import { REGISTRATION_STATUS_CONFIG } from "@/lib/domain/types";

/**
 * כל הכתיבות למסך טפסי הרישום.
 *
 * ⚠️ ההרשאה נגזרת מאותה רשימה שקובעת מי רואה את המסך —
 * `ROUTE_ROLES["/registrations"]` דרך `actorForRoute` — ולא מרשימה
 * מקומית. אחרת היה נוצר בדיוק המצב שהתיקון הזה בא לסגור: המסך נסגר
 * בפני תפקיד, בעוד הפעולה נשארת פתוחה בפניו.
 *
 * קודם עמד כאן `requireSessionUser` לבדו, כלומר זיהוי מי מבצע בלי
 * בדיקה אם מותר לו — וכל עובד יכול היה לשנות סטטוס של כל טופס.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const DENIED = {
  ok: false,
  error: "אין לך הרשאה לעדכן טפסי רישום",
} as const;

export async function updateRegistrationStatusAction(
  id: string,
  status: RegistrationStatus,
): Promise<ActionResult> {
  /*
   * ⚠️ בדיקת ההרשאה עוברת **מעל** אימות הסטטוס, ולא אחריו: קורא שאין
   * לו הרשאה לא אמור לגשש אילו מחרוזות סטטוס המערכת מכירה ואילו לא.
   */
  const actor = await actorForRoute("/registrations");
  if (!actor) return DENIED;

  if (!REGISTRATION_STATUS_CONFIG[status]) {
    return { ok: false, error: "סטטוס לא מוכר" };
  }

  await db.registrations.updateStatus(id, status, actor.id);
  revalidatePath("/registrations");
  return { ok: true };
}
