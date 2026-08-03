import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/server/repositories";
import type { User } from "@/lib/domain/types";
import { SESSION_COOKIE } from "@/lib/gate";
import { verifySupabasePassword } from "./supabase";

/**
 * שם העוגייה ואפשרויותיה חיים ב-`lib/gate.ts` ולא כאן: `proxy.ts` רץ
 * ב-Edge ומחדש אותן בכל ניווט, והוא לא יכול לייבא את הקובץ הזה (הוא
 * נושא `server-only` ואת כל שכבת ה-DB). מיוצאים מחדש כדי שהקוראים
 * הקיימים לא ידעו על ההזזה.
 */
export { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/gate";

/**
 * עוגיית ההתחזות — שומרת את מזהה הבעלים **האמיתי** בזמן שהוא מחובר
 * בתור משתמש אחר. קיומה = מצב התחזות פעיל. ראה admin/impersonation.ts.
 */
export const IMPERSONATION_COOKIE = "os_real";

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

/**
 * המשתמש שהסשן מייצג. תוכן העוגייה הוא מזהה המשתמש עצמו.
 *
 * עטוף ב-`cache()` של React — לא כמטמון בין בקשות אלא כדדופליקציה
 * **בתוך** בקשה אחת. כל Server Action קורא לו לפחות פעמיים
 * (`assertCanEdit` ואז `actor()`), ובלי זה כל כתיבה שילמה שתי
 * שאילתות משתמש מיותרות. ה-cache חי לאורך הבקשה בלבד, כך שהתנתקות
 * או החלפת משתמש נראות מיד בבקשה הבאה.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  return db.users.getById(userId);
});

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
