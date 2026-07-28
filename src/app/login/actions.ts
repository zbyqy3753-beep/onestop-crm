"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_USER } from "@/lib/domain/seed";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifyCredentials,
} from "@/server/auth/session";

/** "כניסת בדיקה" — נכנס תמיד כמשתמש הפיתוח, בלי אימות. */
export async function startTestSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, DEV_USER.id, SESSION_COOKIE_OPTIONS);
  redirect("/");
}

/** שליחת הטופס — מאמת מול Supabase Auth דרך verifyCredentials. */
export async function signIn(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return "יש למלא אימייל וסיסמה.";

  const user = await verifyCredentials(email, password);
  if (!user) return "אימייל או סיסמה שגויים.";

  const store = await cookies();
  store.set(SESSION_COOKIE, user.id, SESSION_COOKIE_OPTIONS);
  redirect("/");
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
