/**
 * כמה מיילים מותר לתבוע בתקתוק אחד.
 *
 * ⚠️ **פונקציה טהורה בקובץ נפרד**, ולא שורה בתוך `claimMail`. שם היא
 * הייתה מוגנת רק בייבוא של `prisma` ו-`server-only` — כלומר בלתי
 * ניתנת לבדיקה — וזה בדיוק החשבון שאסור לו להישבר: תוצאה שלילית
 * מגיעה ל-`take` של Prisma ומפילה את הניקוז, ותוצאה גדולה מדי שורפת
 * את מכסת ה-Gmail.
 */
export function roomForTick(
  limits: { perTick: number; dailyCap: number },
  sentToday: number,
): number {
  const perTick = Math.max(0, limits.perTick);
  if (limits.dailyCap <= 0) return perTick;
  return Math.max(0, Math.min(perTick, limits.dailyCap - sentToday));
}
