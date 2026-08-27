import "server-only";

import { verifyUnsubscribe } from "@/lib/unsubscribeToken";
import { prisma } from "@/server/db/client";

/**
 * רישום הסרה מרשימת התפוצה לפי טוקן חתום.
 *
 * ⚠️ **מודול משלו ולא פונקציה בתוך קובץ ה-route.** שני צרכנים קוראים
 * לו — הדף `/unsubscribe/<token>` שאדם פותח, ונתיב ה-POST שספק
 * הדואר דופק בלחיצה על הכפתור המובנה — ומודול שיובא מתוך route
 * הוא דפוס שקשה לעקוב אחריו.
 */

/** מחזירה את הכתובת שהוסרה, או `null` אם הטוקן אינו תקף. */
export async function optOutByToken(
  token: string,
  reason: string,
): Promise<string | null> {
  const secret = process.env.MAILER_SECRET?.trim();
  if (!secret) return null;

  const email = verifyUnsubscribe(token, secret);
  if (!email) return null;

  // ⚠️ `upsert` ולא `create`: לחיצה שנייה על אותו קישור אינה שגיאה,
  // והיא לא אמורה לדרוס את הסיבה והזמן של ההסרה המקורית.
  await prisma.emailOptOut.upsert({
    where: { email },
    create: { email, reason },
    update: {},
  });

  return email;
}
