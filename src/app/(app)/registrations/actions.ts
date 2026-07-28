"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import type { RegistrationStatus } from "@/lib/domain/types";
import { REGISTRATION_STATUS_CONFIG } from "@/lib/domain/types";

/**
 * כל הכתיבות למסך טפסי הרישום.
 *
 * ⚠️ אין כאן עדיין בדיקת הרשאות (מי מורשה לעשות מה) — רק זיהוי מי
 * מבצע את הפעולה, דרך הסשן האמיתי (`requireSessionUser`).
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function actor(): Promise<string> {
  return (await requireSessionUser()).id;
}

export async function updateRegistrationStatusAction(
  id: string,
  status: RegistrationStatus,
): Promise<ActionResult> {
  if (!REGISTRATION_STATUS_CONFIG[status]) {
    return { ok: false, error: "סטטוס לא מוכר" };
  }

  await db.registrations.updateStatus(id, status, await actor());
  revalidatePath("/registrations");
  return { ok: true };
}
