import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/client";
import { db } from "@/server/repositories";
import { updateAuthUser } from "./supabaseAdmin";
import { createSessionToken, hashSessionToken } from "./token";

/**
 * ── איפוס סיסמאות ─────────────────────────────────────────────────────
 *
 * ⚠️ **הכלל שמעצב את כל הקובץ: אף אחד לא רואה סיסמה — גם לא המנהל
 * שמריץ את האיפוס.** סיסמה שנשלחת למישהו יושבת אחר כך בתיבת דואר או
 * בשיחת וואטסאפ, קריאה לכל מי שמגיע למכשיר, ואי אפשר לבטל אותה. לכן
 * הזרימה כאן היא:
 *
 *   1. הסיסמה הקיימת נדרסת בערך אקראי ש**נזרק מיד** — היא מתה, ואיש
 *      לא יודע מה החליף אותה.
 *   2. מונפק טוקן חד-פעמי. הוא לבדו עובר לעובד.
 *   3. העובד בוחר סיסמה בעצמו ב-`/set-password`.
 *
 * הערך האקראי משלב 1 לא מוחזר מכאן, לא נרשם ליומן ולא נשמר בשום
 * מקום. אין שום דרך לשחזר אותו, וזו התכונה ולא תופעת לוואי.
 */

/**
 * ⚠️ 72 שעות ולא שעה. הקישור נמסר ידנית בוואטסאפ, ועובד שקורא הודעות
 * בסוף המשמרת או חוזר מסופ״ש צריך שהוא עדיין יעבוד. הסיכון נמוך: הוא
 * חד-פעמי, והסיסמה הישנה כבר מתה בין כה וכה.
 */
const TTL_MS = 72 * 3_600_000;

export interface ResetLink {
  userId: string;
  name: string;
  email: string;
  /** הכתובת המלאה להעברה לעובד. נוצרת פעם אחת ואי אפשר לשחזר אותה. */
  url: string;
  expiresAt: Date;
}

/**
 * ⚠️ סיסמת ביניים באורך 48 בתים אקראיים. היא לא נועדה להיזכר או
 * להיות מוקלדת — היא נועדה **לא** להיות ניחושה בזמן שבין האיפוס לבין
 * הרגע שהעובד קובע סיסמה משלו. מדיניות הסיסמאות לא חלה עליה בכוונה:
 * `lib/password.ts` שומר על מה שבני אדם בוחרים.
 */
function unknowablePassword(): string {
  return randomBytes(48).toString("base64url");
}

/**
 * מאפס משתמש אחד ומחזיר את הקישור שלו.
 *
 * `keepSessionOf` הוא מזהה המשתמש שמריץ את הפעולה. הסשנים שלו **לא**
 * נמחקים.
 *
 * ⚠️ בלי החריגה הזו, "אפס לכולם" היה מנתק את המנהל באמצע — והקישורים
 * שזה עתה הונפקו היו נעלמים מהמסך יחד איתו. במסד נשמר רק ה-hash, ולכן
 * קישור שנעלם מהמסך אבד לתמיד. הסיסמה שלו עצמה כן מתאפסת; מה שנשמר
 * הוא הסשן הפתוח שכבר אומת.
 */
export async function resetUserPassword(
  userId: string,
  options: { appUrl: string; issuedById: string; keepSessionOf?: string },
): Promise<ResetLink> {
  const user = await db.users.getById(userId);
  if (!user) throw new Error("המשתמש לא נמצא");

  // ⚠️ סדר הפעולות חשוב. קודם הורגים את הסיסמה, ורק אחר כך מנפיקים
  // קישור. הסדר ההפוך משאיר חלון שבו קיים קישור פתוח **וגם** הסיסמה
  // הישנה עדיין עובדת.
  await updateAuthUser(user.email, { password: unknowablePassword() });

  if (userId !== options.keepSessionOf) {
    await db.sessions.deleteAllForUser(userId);
  }

  // ⚠️ קישורים קודמים שטרם נוצלו מבוטלים. אחרת איפוס חוזר (״הקישור
  // אבד״) היה מותיר שני קישורים חיים לאותו חשבון, ומי שהשיג את
  // הראשון היה נשאר עם דלת פתוחה.
  await prisma.passwordReset.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.passwordReset.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      createdById: options.issuedById,
    },
  });

  const base = options.appUrl.replace(/\/$/, "");
  return {
    userId,
    name: user.name,
    email: user.email,
    url: `${base}/set-password?t=${token}`,
    expiresAt,
  };
}

export type ResetOutcome =
  | { ok: true; link: ResetLink }
  | { ok: false; name: string; email: string; error: string };

/**
 * מאפס רשימת משתמשים, אחד־אחד.
 *
 * ⚠️ **בלי טרנזקציה, ובכוונה.** כל איפוס נוגע ב-Supabase Auth — מערכת
 * אחרת לגמרי — ואי אפשר לגלגל אותו אחורה יחד עם שורה במסד. כישלון
 * באמצע לא מבטל את מי שכבר אופס, ולכן כל משתמש מדווח בנפרד: מי שנכשל
 * מוצג עם השגיאה שלו, והמנהל מריץ עליו שוב. "הכול או כלום" כאן היה
 * הבטחה שאי אפשר לקיים.
 */
export async function resetPasswords(
  userIds: string[],
  options: { appUrl: string; issuedById: string; keepSessionOf?: string },
): Promise<ResetOutcome[]> {
  const results: ResetOutcome[] = [];

  for (const userId of userIds) {
    const user = await db.users.getById(userId);
    try {
      const link = await resetUserPassword(userId, options);
      results.push({ ok: true, link });
    } catch (error) {
      results.push({
        ok: false,
        name: user?.name ?? userId,
        email: user?.email ?? "",
        error: error instanceof Error ? error.message : "האיפוס נכשל",
      });
    }
  }

  return results;
}

export interface ResetTarget {
  userId: string;
  email: string;
  name: string;
}

/**
 * מאמת טוקן מקישור. מחזיר את המשתמש, או `null` אם הוא פג, נוצל, או
 * לא קיים.
 *
 * ⚠️ תשובה אחת לשלושת המקרים כלפי חוץ — ראה ההודעה ב-`/set-password`.
 * הפרדה ביניהם הייתה מאפשרת למי שמנחש טוקנים ללמוד אילו מהם קיימים.
 */
export async function resetTarget(token: string): Promise<ResetTarget | null> {
  if (!token) return null;

  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.user.active) return null;

  return { userId: row.userId, email: row.user.email, name: row.user.name };
}

/**
 * קובע את הסיסמה שהעובד בחר וסוגר את הטוקן.
 *
 * ⚠️ **סימון `usedAt` הוא תנאי ל-`usedAt: null`, לא עדכון עיוור.**
 * שתי לחיצות על "שמור" בו-זמנית היו מגיעות שתיהן לכאן; התנאי גורם
 * לשנייה לעדכן אפס שורות, ואז היא נעצרת. בלעדיו הטוקן החד-פעמי היה
 * חד-פעמי רק בזמנים רגילים.
 *
 * ⚠️ הסיסמה נכתבת ל-Supabase **אחרי** שהטוקן נתפס בהצלחה. הסדר ההפוך
 * היה מאפשר לכתוב סיסמה ואז לגלות שהטוקן כבר נוצל.
 */
export async function completeReset(
  token: string,
  password: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const target = await resetTarget(token);
  if (!target) return { ok: false, error: "הקישור אינו תקף" };

  const claimed = await prisma.passwordReset.updateMany({
    where: { tokenHash: hashSessionToken(token), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, error: "הקישור אינו תקף" };

  try {
    await updateAuthUser(target.email, { password });
  } catch (error) {
    // הטוקן כבר נסגר ואי אפשר לפתוח אותו מחדש — שחרור היה מחזיר את
    // חלון המרוץ. העובד מקבל קישור חדש מהמנהל, וזה המצב הנדיר.
    return {
      ok: false,
      error: error instanceof Error ? error.message : "שמירת הסיסמה נכשלה",
    };
  }

  // ⚠️ ניתוק כל הסשנים גם כאן, ולא רק באיפוס. אם החשבון נפרץ והתוקף
  // פתח סשן, קביעת סיסמה חדשה חייבת לזרוק אותו החוצה — אחרת העובד
  // מחליף סיסמה והפורץ ממשיך לעבוד.
  await db.sessions.deleteAllForUser(target.userId);

  return { ok: true, email: target.email };
}
