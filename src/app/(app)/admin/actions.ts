"use server";

import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import { createAuthUser } from "@/server/auth/supabaseAdmin";
import type { Role } from "@/lib/domain/types";
import { isRole } from "@/lib/domain/types";
import { revalidateUserSurfaces } from "@/app/(app)/_revalidate";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * יצירת משתמש חדש: גם רשומת User אצלנו, גם חשבון Supabase Auth
 * (כדי שיוכל להתחבר מייד עם המייל/סיסמה שהוזנו כאן).
 *
 * ⚠️ זו הפעולה הרגישה ביותר במערכת — היא מייצרת חשבון התחברות אמיתי
 * עם תפקיד שהקורא בוחר. לכן היא לא מסתפקת ב"יש סשן": רק ניהול רשאי
 * ליצור משתמשים, ורק בעלים רשאי ליצור בעלים נוסף. בלי הבדיקה השנייה
 * כל מנהל היה יכול להנפיק לעצמו חשבון בעלים.
 */
export async function createUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSessionUser();
  if (actor.role !== "owner" && actor.role !== "manager") {
    return { ok: false, error: "אין לך הרשאה ליצור משתמשים" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const store = String(formData.get("store") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!email.includes("@")) return { ok: false, error: "אימייל לא תקין" };
  if (!isRole(rawRole)) return { ok: false, error: "תפקיד לא מוכר" };
  const role: Role = rawRole;
  if (role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול ליצור מנהל ראשי נוסף" };
  }
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

  revalidateUserSurfaces();
  return { ok: true };
}
