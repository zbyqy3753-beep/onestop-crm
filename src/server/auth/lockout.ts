import "server-only";

import { prisma } from "@/server/db/client";

/**
 * ── נעילת התחברות ─────────────────────────────────────────────────────
 *
 * ⚠️ מסך ההתחברות היה חסר כל מונה: אפשר היה לנסות סיסמאות ללא הגבלה,
 * והמגן היחיד היה מה ש-Supabase מחיל מצדו — שאנחנו לא שולטים בו ולא
 * רואים אותו. עם סף של 10 תווים לסיסמה זה עדיין לא מספיק: השם משתמש
 * הוא `שם.פרטי` צפוי, ומספר החשבונות קטן.
 *
 * המונה יושב במסד ולא בזיכרון התהליך — ראה `prisma/schema.prisma`
 * › LoginAttempt.
 *
 * ⚠️ **נעילה קצרה ומתגלגלת, לא חסימה שדורשת מנהל.** עובד שננעל בתשע
 * בבוקר באמצע התור צריך לחזור לעבודה בעצמו; נעילה שמחייבת התערבות
 * הופכת כל טעות הקלדה לתקלה תפעולית, והלחץ לבטל אותה יביא לכך שהיא
 * תוסר לגמרי.
 */

/** אחרי כמה כשלונות רצופים נועלים. */
const MAX_FAILURES = 8;

/** לכמה זמן. */
const LOCK_MS = 15 * 60 * 1000;

/**
 * חלון ההתיישנות: כשלונות ישנים מזה לא נספרים.
 *
 * בלי זה עובד שטעה שלוש פעמים לאורך חצי שנה היה מגיע לסף מתישהו,
 * בלי שום קשר לתקיפה.
 */
const WINDOW_MS = 60 * 60 * 1000;

/**
 * האם המזהה נעול כרגע.
 *
 * ⚠️ נקרא **לפני** אימות הסיסמה. בדיקה אחריו הייתה משאירה את הניחוש
 * עצמו רץ — הנעילה נועדה למנוע את הבדיקה, לא רק את התוצאה שלה.
 */
export async function isLockedOut(loginId: string): Promise<boolean> {
  const row = await prisma.loginAttempt.findUnique({ where: { loginId } });
  if (!row?.lockedUntil) return false;

  if (row.lockedUntil.getTime() > Date.now()) return true;

  // הנעילה פגה — מנקים אותה ואת המונה, כדי שהניסיון הבא יתחיל מדף חלק
  // ולא ייפול מיד שוב על כישלון בודד
  await prisma.loginAttempt.update({
    where: { loginId },
    data: { lockedUntil: null, failures: 0 },
  });
  return false;
}

/** רושם כישלון, ונועל אם נחצה הסף. */
export async function recordFailure(loginId: string): Promise<void> {
  const now = new Date();
  const row = await prisma.loginAttempt.findUnique({ where: { loginId } });

  // כישלון בודד אחרי שקט ארוך מתחיל ספירה חדשה — ראה WINDOW_MS
  const stale =
    row && now.getTime() - row.lastFailedAt.getTime() > WINDOW_MS;
  const failures = stale || !row ? 1 : row.failures + 1;
  const lockedUntil =
    failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;

  await prisma.loginAttempt.upsert({
    where: { loginId },
    create: { loginId, failures, lastFailedAt: now, lockedUntil },
    update: { failures, lastFailedAt: now, lockedUntil },
  });
}

/**
 * מאפס אחרי התחברות מוצלחת.
 *
 * `deleteMany` ולא `delete`: אין בהכרח שורה (התחברות ראשונה שהצליחה),
 * ו-`delete` על שורה חסרה זורק.
 */
export async function clearFailures(loginId: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { loginId } });
}
