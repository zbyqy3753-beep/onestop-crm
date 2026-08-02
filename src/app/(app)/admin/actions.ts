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

/**
 * עריכת משתמש קיים: שם, טלפון, חנות, תפקיד ופעיל/לא פעיל.
 *
 * אימייל לא ניתן לעריכה — הוא המפתח לחשבון ה-Supabase Auth, ושינוי
 * שלו רק אצלנו היה מנתק את המשתמש מהחשבון שהוא מתחבר איתו.
 *
 * אותם כללי סמכות כמו ביצירה, ועוד שניים שקיימים רק בעריכה:
 *  - **על חשבון בעלים רק בעלים נוגע** — לכל שינוי, לא רק לתפקיד.
 *    בלי זה מנהל היה יכול להשבית את הבעלים.
 *  - **אי אפשר להשבית או להוריד בדרגה את עצמך** — נעילה עצמית בטעות
 *    היא הדרך הקלה ביותר לאבד גישה למערכת.
 */
export async function updateUserAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSessionUser();
  if (actor.role !== "owner" && actor.role !== "manager") {
    return { ok: false, error: "אין לך הרשאה לערוך משתמשים" };
  }

  const target = await db.users.getById(userId);
  if (!target) return { ok: false, error: "המשתמש לא נמצא" };

  if (target.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול לערוך מנהל ראשי" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const store = String(formData.get("store") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!isRole(rawRole)) return { ok: false, error: "תפקיד לא מוכר" };
  const role: Role = rawRole;

  if (role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול להעניק תפקיד מנהל ראשי" };
  }

  if (target.id === actor.id) {
    if (!active) return { ok: false, error: "אי אפשר להשבית את החשבון שלך" };
    if (role !== actor.role) {
      return { ok: false, error: "אי אפשר לשנות את התפקיד של עצמך" };
    }
  }

  await db.users.update(userId, {
    name,
    phone: phone || null,
    store: store || null,
    role,
    active,
  });

  revalidateUserSurfaces();
  return { ok: true };
}
