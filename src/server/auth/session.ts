import "server-only";

import { cookies } from "next/headers";
import { DEV_USER } from "@/lib/domain/seed";
import type { User } from "@/lib/domain/types";

export const SESSION_COOKIE = "os_session";

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
 * נקודת ההחלפה היחידה לאימות אמיתי.
 *
 * כרגע מחזירה `null` תמיד — אין אימות במערכת. כשיהיה מקור משתמשים
 * אמיתי, זו הפונקציה שמשנים, וכל השאר (המסך, העוגייה, ה-middleware)
 * נשאר כפי שהוא.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- הפרמטרים מתועדים בכוונה: הם החוזה שהמימוש האמיתי ימלא. */
export async function verifyCredentials(
  _email: string,
  _password: string,
): Promise<User | null> {
  return null;
}

/** המשתמש שהסשן מייצג. כרגע תמיד משתמש הבדיקה מנתוני הזרע. */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  if (!store.get(SESSION_COOKIE)) return null;
  return DEV_USER;
}
