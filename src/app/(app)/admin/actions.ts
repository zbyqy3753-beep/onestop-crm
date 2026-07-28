"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { createAuthUser } from "@/server/auth/supabaseAdmin";
import type { Role } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * יצירת משתמש חדש: גם רשומת User אצלנו, גם חשבון Supabase Auth
 * (כדי שיוכל להתחבר מייד עם המייל/סיסמה שהוזנו כאן).
 */
export async function createUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const store = String(formData.get("store") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!email.includes("@")) return { ok: false, error: "אימייל לא תקין" };
  if (!ROLE_CONFIG[role]) return { ok: false, error: "תפקיד לא מוכר" };
  if (password.length < 6)
    return { ok: false, error: "סיסמה חייבת להכיל לפחות 6 תווים" };

  const existing = await db.users.getByEmail(email);
  if (existing) return { ok: false, error: "כבר קיים משתמש עם האימייל הזה" };

  try {
    await createAuthUser(email, password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "יצירת חשבון האימות נכשלה" };
  }

  await db.users.create({
    name,
    email,
    phone: phone || undefined,
    store: store || undefined,
    role,
  });

  revalidatePath("/admin");
  return { ok: true };
}
