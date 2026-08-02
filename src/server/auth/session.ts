import "server-only";

import { cookies } from "next/headers";
import { db } from "@/server/repositories";
import type { User } from "@/lib/domain/types";
import { verifySupabasePassword } from "./supabase";

export const SESSION_COOKIE = "os_session";

/**
 * עוגיית ההתחזות — שומרת את מזהה הבעלים **האמיתי** בזמן שהוא מחובר
 * בתור משתמש אחר. קיומה = מצב התחזות פעיל. ראה admin/impersonation.ts.
 */
export const IMPERSONATION_COOKIE = "os_real";

/** שבוע — מספיק לסבב בדיקות, קצר מספיק שקישור ישן לא יחיה לנצח. */
const MAX_AGE = 60 * 60 * 24 * 7;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * מאמת מול Supabase Auth (auth.users), ואז מוצא את המשתמש המקביל
 * אצלנו לפי מייל. סיסמה נכונה ב-Supabase בלי שורת User תואמת = לא
 * מאומת אצלנו (המשתמש לא סופק למערכת עדיין).
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const ok = await verifySupabasePassword(email, password);
  if (!ok) return null;
  return db.users.getByEmail(email);
}

/** המשתמש שהסשן מייצג. תוכן העוגייה הוא מזהה המשתמש עצמו. */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return db.users.getById(userId);
}

/**
 * כמו `getSessionUser`, אבל זורק אם אין סשן תקין — לשימוש בפעולות
 * כתיבה שחייבות actorId אמיתי. `proxy.ts` כבר חוסם גישה בלי עוגיית
 * סשן; זה מכסה את המקרה הנדיר של עוגייה שמצביעה למשתמש שנמחק.
 */
export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new Error("אין משתמש מחובר");
  return user;
}

/**
 * הזהות **האמיתית** של מי שיושב מול המסך.
 *
 * בזמן התחזות `getSessionUser` מחזיר את המשתמש המתוחזה — וזה נכון
 * לכל שימוש רגיל (הרשאות, actorId, תצוגה): המערכת מתנהגת בדיוק כפי
 * שהיא מתנהגת לאותו משתמש. שני מקומות בלבד צריכים את האמת:
 * הרשאת ההתחזות עצמה, והבאנר שמציג "אתה מחובר בתור X".
 */
export async function getRealSessionUser(): Promise<User | null> {
  const store = await cookies();
  const realId = store.get(IMPERSONATION_COOKIE)?.value;
  if (realId) return db.users.getById(realId);
  return getSessionUser();
}

/** מזהה הבעלים האמיתי אם יש התחזות פעילה, אחרת `null`. */
export async function getImpersonatorId(): Promise<string | null> {
  const store = await cookies();
  return store.get(IMPERSONATION_COOKIE)?.value ?? null;
}
