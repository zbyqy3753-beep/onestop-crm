"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { CURRENT_USER_ID } from "@/lib/domain/seed";
import type { RegistrationStatus } from "@/lib/domain/types";
import { REGISTRATION_STATUS_CONFIG } from "@/lib/domain/types";

/**
 * כל הכתיבות למסך טפסי הרישום.
 *
 * ⚠️ אין כאן עדיין בדיקת הרשאות. `actorId` נלקח מקבוע במקום
 * מ-session — ראה ההערה המקבילה ב-`leads/actions.ts`.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function actor(): string {
  return CURRENT_USER_ID;
}

export async function updateRegistrationStatusAction(
  id: string,
  status: RegistrationStatus,
): Promise<ActionResult> {
  if (!REGISTRATION_STATUS_CONFIG[status]) {
    return { ok: false, error: "סטטוס לא מוכר" };
  }

  await db.registrations.updateStatus(id, status, actor());
  revalidatePath("/registrations");
  return { ok: true };
}
