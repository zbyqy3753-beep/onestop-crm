"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifyCredentials,
} from "@/server/auth/session";

/** "כניסת בדיקה" — הנתיב היחיד שבאמת מכניס למערכת כרגע. */
export async function startTestSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "1", SESSION_COOKIE_OPTIONS);
  redirect("/");
}

/**
 * שליחת הטופס. `verifyCredentials` מחזירה `null` תמיד כרגע, ולכן
 * זה תמיד נכשל — במכוון. כשיחובר אימות אמיתי, רק היא משתנה.
 */
export async function signIn(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return "יש למלא אימייל וסיסמה.";

  const user = await verifyCredentials(email, password);
  if (!user) return "האימות עדיין לא חובר. השתמש בכניסת בדיקה.";

  const store = await cookies();
  store.set(SESSION_COOKIE, "1", SESSION_COOKIE_OPTIONS);
  redirect("/");
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
