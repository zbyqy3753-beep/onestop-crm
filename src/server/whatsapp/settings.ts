import "server-only";

import { prisma } from "@/server/db/client";

/**
 * הגדרות הבוט שניתנות לשינוי מהאתר.
 *
 * הערכים כאן היו קבועים בקוד עד עכשיו. הסיבה שהם עברו למסד היא
 * **זמן תגובה**: כשמתברר שהבוט שולח משהו שגוי, העצירה חייבת להיות
 * לחיצה אחת. מחזור פריסה של Vercel הוא דקות — ובדקות האלה ההודעות
 * ממשיכות לצאת.
 *
 * הבוט קורא את השורה בכל סקר (כל 60 שניות), כך שכל שינוי נכנס לתוקף
 * תוך דקה בלי להפעיל שום דבר מחדש במשרד.
 */

export interface BotSettingsView {
  paused: boolean;
  pausedReason: string | null;
  pausedAt: Date | null;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  reminderLeadMinutes: number;
  dailyCap: number;
}

/**
 * ברירות המחדל — זהות לקבועים שהיו קודם ב-outbox.ts.
 *
 * הן קיימות כאן ולא רק כ-`@default` בסכימה כי השורה עשויה לא להתקיים
 * (מסד טרי, או לפני שמנהל נגע בהגדרות פעם ראשונה), ובמצב הזה הבוט
 * חייב להתנהג בדיוק כמו קודם ולא להיעצר.
 */
export const BOT_DEFAULTS: BotSettingsView = {
  paused: false,
  pausedReason: null,
  pausedAt: null,
  sendWindowStartHour: 8,
  sendWindowEndHour: 21,
  reminderLeadMinutes: 10,
  dailyCap: 200,
};

export async function readSettings(): Promise<BotSettingsView> {
  const row = await prisma.botSettings.findUnique({
    where: { id: "default" },
    select: {
      paused: true,
      pausedReason: true,
      pausedAt: true,
      sendWindowStartHour: true,
      sendWindowEndHour: true,
      reminderLeadMinutes: true,
      dailyCap: true,
    },
  });

  return row ?? BOT_DEFAULTS;
}

/**
 * כתיבה חלקית. `upsert` ולא `update` כי השורה נוצרת בשינוי הראשון —
 * אין מיגרציית seed שתיצור אותה, וגם לא צריך אחת.
 */
export async function writeSettings(
  patch: Partial<
    Pick<
      BotSettingsView,
      | "paused"
      | "pausedReason"
      | "sendWindowStartHour"
      | "sendWindowEndHour"
      | "reminderLeadMinutes"
      | "dailyCap"
    >
  > & { pausedAt?: Date | null },
  actorId: string,
): Promise<void> {
  await prisma.botSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...patch, updatedById: actorId },
    update: { ...patch, updatedById: actorId },
  });
}
