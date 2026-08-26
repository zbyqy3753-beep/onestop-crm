import "server-only";

import { prisma } from "@/server/db/client";

/**
 * הגדרות הדיוור, במקביל ל-`src/server/whatsapp/settings.ts`.
 *
 * במסד ולא בקוד מאותה סיבה בדיוק: כשמתברר שדיוור יצא שגוי, העצירה
 * חייבת להיות לחיצה אחת. מחזור פריסה של Vercel הוא דקות, ובדקות
 * האלה המיילים ממשיכים לצאת.
 */

export interface MailerSettingsView {
  paused: boolean;
  pausedReason: string | null;
  pausedAt: Date | null;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  dailyCap: number;
  perTick: number;
}

/**
 * ⚠️ קיימות כאן ולא רק כ-`@default` בסכימה, כי השורה עשויה לא
 * להתקיים — מסד טרי, או לפני שמנהל נגע בהגדרות פעם ראשונה.
 *
 * ⚠️ `dailyCap` הוא 400 ולא 500: התקרה של גוגל היא כ-500, וחשבון
 * שנשרף אינו ניתן לשחזור. המרווח הוא רשת הביטחון היחידה מפני באג
 * שמייצר לולאת שליחה.
 */
export const MAILER_DEFAULTS: MailerSettingsView = {
  paused: false,
  pausedReason: null,
  pausedAt: null,
  sendWindowStartHour: 8,
  sendWindowEndHour: 21,
  dailyCap: 400,
  perTick: 20,
};

export async function readMailerSettings(): Promise<MailerSettingsView> {
  const row = await prisma.mailerSettings.findUnique({
    where: { id: "default" },
    select: {
      paused: true,
      pausedReason: true,
      pausedAt: true,
      sendWindowStartHour: true,
      sendWindowEndHour: true,
      dailyCap: true,
      perTick: true,
    },
  });

  return row ?? MAILER_DEFAULTS;
}

/** `upsert` ולא `update` — השורה נוצרת בשינוי הראשון, בלי מיגרציית seed. */
export async function writeMailerSettings(
  patch: Partial<
    Pick<
      MailerSettingsView,
      | "paused"
      | "pausedReason"
      | "sendWindowStartHour"
      | "sendWindowEndHour"
      | "dailyCap"
      | "perTick"
    >
  > & { pausedAt?: Date | null },
  actorId: string,
): Promise<void> {
  await prisma.mailerSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...patch, updatedById: actorId },
    update: { ...patch, updatedById: actorId },
  });
}
