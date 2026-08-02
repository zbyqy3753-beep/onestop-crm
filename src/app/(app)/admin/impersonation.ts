"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/repositories";
import {
  IMPERSONATION_COOKIE,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  getRealSessionUser,
} from "@/server/auth/session";

/**
 * כניסה בתור משתמש אחר ("התחזות") — למנהל ראשי בלבד.
 *
 * ⚠️ זה המנגנון הרגיש ביותר במערכת אחרי יצירת משתמשים, והעיצוב שלו
 * מוכתב מזה:
 *
 *  - **רק `owner`.** לא manager — מי שיכול להיכנס בתור כל אחד יכול
 *    לעשות כל דבר, ולכן הסמכות הזו שמורה לבעלים בלבד (אורחן ומשה).
 *  - **הזהות האמיתית לא הולכת לאיבוד.** עוגיית `os_real` נפרדת שומרת
 *    את מזהה הבעלים; `getSessionUser` ממשיך להחזיר את המשתמש המזוהה
 *    (המתוחזה), אבל היציאה מהמצב לא דורשת סיסמה — היא משחזרת את
 *    העוגייה המקורית.
 *  - **אי אפשר לשרשר.** בעלים שכבר מתחזה לא יכול להתחזות שוב מתוך
 *    המצב — קודם חוזרים, אחר כך נכנסים למישהו אחר. בלי זה עוגיית
 *    `os_real` הייתה נדרסת והדרך חזרה הייתה אובדת.
 *  - **התחזות לבעלים אחר חסומה.** אין סיבה תפעולית לכך, והיא הייתה
 *    מאפשרת למשה "להיות אורחן" — טשטוש אחריות בין שני החשבונות
 *    הרגישים ביותר.
 */

export async function impersonateAction(targetUserId: string): Promise<void> {
  const store = await cookies();

  // הזהות **האמיתית** — גם אם (בטעות) כבר בתוך התחזות
  const real = await getRealSessionUser();
  if (!real || real.role !== "owner") {
    throw new Error("רק מנהל ראשי יכול להיכנס בתור משתמש אחר");
  }

  if (store.get(IMPERSONATION_COOKIE)) {
    throw new Error("כבר במצב התחזות — קודם יש לחזור לחשבון שלך");
  }

  const target = await db.users.getById(targetUserId);
  if (!target) throw new Error("המשתמש לא נמצא");
  if (target.id === real.id) throw new Error("זה החשבון שלך");
  if (target.role === "owner") {
    throw new Error("אי אפשר להיכנס בתור מנהל ראשי אחר");
  }

  // הסדר חשוב: קודם שומרים את הזהות האמיתית, ורק אז מחליפים
  store.set(IMPERSONATION_COOKIE, real.id, SESSION_COOKIE_OPTIONS);
  store.set(SESSION_COOKIE, target.id, SESSION_COOKIE_OPTIONS);

  redirect("/leads");
}

/** חזרה לחשבון האמיתי. לא דורש הרשאה — היציאה תמיד מותרת. */
export async function stopImpersonationAction(): Promise<void> {
  const store = await cookies();
  const realId = store.get(IMPERSONATION_COOKIE)?.value;

  if (realId) {
    store.set(SESSION_COOKIE, realId, SESSION_COOKIE_OPTIONS);
  }
  store.delete(IMPERSONATION_COOKIE);

  redirect("/admin");
}
