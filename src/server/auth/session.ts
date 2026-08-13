import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/server/repositories";
import type { SessionRecord } from "@/server/repositories";
import type { User } from "@/lib/domain/types";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE,
} from "@/lib/gate";
import { verifySupabasePassword } from "./supabase";
import { createSessionToken, hashSessionToken } from "./token";

/**
 * שם העוגייה ואפשרויותיה חיים ב-`lib/gate.ts` ולא כאן: `proxy.ts` רץ
 * ב-Edge ומחדש אותן בכל ניווט, והוא לא יכול לייבא את הקובץ הזה (הוא
 * נושא `server-only` ואת כל שכבת ה-DB). מיוצאים מחדש כדי שהקוראים
 * הקיימים לא ידעו על ההזזה.
 */
export { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/gate";

/**
 * ── מודל הסשן ─────────────────────────────────────────────────────────
 *
 * העוגייה מחזיקה טוקן אקראי; ה-DB מחזיק את ה-hash שלו ואת מי שהוא
 * מייצג. `proxy.ts` בודק **רק שיש עוגייה** — הוא רץ ב-Edge ולא יכול
 * לגעת במסד — והאימות האמיתי קורה כאן, בכל בקשה שקוראת למשתמש.
 *
 * ⚠️ המשמעות: `proxy.ts` הוא הפניה, לא אבטחה. אל תוסיף לו בדיקות
 * הרשאה ואל תסמוך עליו — כל נתיב שמציג נתונים חייב לעבור דרך
 * `getSessionUser`/`requireSessionUser`.
 *
 * קדם לזה: העוגייה הכילה את מזהה המשתמש כטקסט. החלפת הערך ב-DevTools
 * במזהה של הבעלים נתנה גישת בעלים מלאה, ומזהי משתמשים ממילא מגיעים
 * לדפדפן (`assigneeId` על כל ליד). ראה prisma/schema.prisma › Session.
 */

/**
 * מרווח החידוש. התפוגה נדחפת קדימה רק אם עברו 24 שעות מהחידוש האחרון,
 * ולא בכל בקשה — אחרת כל טעינת דף הייתה כתיבה ל-DB, בזמן שמסך הלידים
 * מרענן את עצמו כל דקה.
 */
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE * 1000);
}

/**
 * מאמת מול Supabase Auth (auth.users), ואז מוצא את המשתמש המקביל
 * אצלנו לפי מייל. סיסמה נכונה ב-Supabase בלי שורת User תואמת = לא
 * מאומת אצלנו (המשתמש לא סופק למערכת עדיין).
 *
 * ⚠️ חשבון מושבת נדחה כאן ולא רק בבדיקת הסשן: אחרת עובד שהושבת היה
 * מקבל "התחברת בהצלחה" ואז מסך ריק, במקום תשובה שאומרת את האמת.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const ok = await verifySupabasePassword(email, password);
  if (!ok) return null;

  const user = await db.users.getByEmail(email);
  return user?.active ? user : null;
}

/**
 * פותח סשן חדש וכותב את העוגייה. מחזיר את הטוקן לצורך בדיקות בלבד —
 * הקוראים הרגילים לא צריכים אותו, הוא כבר בעוגייה.
 */
export async function startSession(userId: string): Promise<string> {
  const token = createSessionToken();

  await db.sessions.create({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: expiryFromNow(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);

  return token;
}

/** סוגר את הסשן הנוכחי — גם במסד וגם בדפדפן. */
export async function endSessionRecord(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) await db.sessions.delete(hashSessionToken(token));
  store.delete(SESSION_COOKIE);
}

/**
 * הסשן הגולמי של הבקשה הנוכחית, אחרי אימות מלא.
 *
 * עטוף ב-`cache()` של React — לא כמטמון בין בקשות אלא כדדופליקציה
 * **בתוך** בקשה אחת. כל Server Action קורא לזהות לפחות פעמיים
 * (`assertCanEdit` ואז `actor()`), ובלי זה כל כתיבה שילמה שאילתות
 * מיותרות. ה-cache חי לאורך הבקשה בלבד, כך שהתנתקות או החלפת משתמש
 * נראות מיד בבקשה הבאה.
 */
const currentSession = cache(async (): Promise<SessionRecord | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await db.sessions.find(tokenHash);
  if (!session) return null;

  // סשן שפג נמחק ולא רק נדחה: בלי זה שורות מתות מצטברות לנצח,
  // ואין כאן שום תהליך רקע שינקה אותן
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.sessions.delete(tokenHash);
    return null;
  }

  await touchIfStale(session);
  return session;
});

/** דוחף את התפוגה קדימה, לכל היותר פעם ב-`TOUCH_AFTER_MS`. */
async function touchIfStale(session: SessionRecord): Promise<void> {
  if (Date.now() - session.lastSeenAt.getTime() < TOUCH_AFTER_MS) return;
  await db.sessions.touch(session.tokenHash, expiryFromNow());
}

/**
 * המשתמש שהסשן מייצג — המתוחזה אם יש התחזות, אחרת המחובר עצמו.
 *
 * ⚠️ חשבון מושבת מוחזר כ-`null` **ובנוסף** כל הסשנים שלו נמחקים
 * בהשבתה (`admin/actions.ts`). שתי השכבות במכוון: המחיקה מנתקת מיד,
 * והבדיקה כאן מכסה מצב שבו החשבון הושבת ישירות במסד.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const session = await currentSession();
  if (!session) return null;

  const user = await db.users.getById(session.impersonatingId ?? session.userId);
  return user?.active ? user : null;
});

/**
 * כמו `getSessionUser`, אבל זורק אם אין סשן תקין — לשימוש בפעולות
 * כתיבה שחייבות actorId אמיתי. `proxy.ts` כבר מפנה למסך ההתחברות בלי
 * עוגייה; זה מכסה עוגייה שפגה, נמחקה, או מצביעה למשתמש שהושבת.
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
  const session = await currentSession();
  if (!session) return null;

  const user = await db.users.getById(session.userId);
  return user?.active ? user : null;
}

/** מזהה הבעלים האמיתי אם יש התחזות פעילה, אחרת `null`. */
export async function getImpersonatorId(): Promise<string | null> {
  const session = await currentSession();
  return session?.impersonatingId ? session.userId : null;
}

/**
 * מעבר למצב התחזות ובחזרה — הפעולה היחידה שמשנה את זהות התצוגה.
 * חיה כאן ולא ב-`admin/impersonation.ts` כי היא נוגעת בשורת הסשן,
 * וה-Server Action שם אחראי על ההרשאות בלבד.
 */
export async function setImpersonation(
  impersonatingId: string | null,
): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("אין משתמש מחובר");

  await db.sessions.setImpersonating(hashSessionToken(token), impersonatingId);
}
