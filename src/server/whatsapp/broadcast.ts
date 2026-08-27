import "server-only";

import { prisma } from "@/server/db/client";
import {
  BROADCAST_MAX_CHARS,
  broadcastDedupeKey,
  normalizeBroadcastText,
} from "@/lib/domain/broadcast";
import { readSettings } from "./settings";
import { sentToday } from "./outbox";

/**
 * הכנסת דיוור המוני לתור הוואטסאפ.
 *
 * ⚠️ **אין כאן שליחה ואין קריאה למטא.** השורות נכנסות לאותו תור
 * שממנו יוצאות התזכורות, ו-`drainOutbox` מוציא אותן בקצב שנקבע
 * בהגדרות הבוט — חלון שליחה, מתג השהיה ותקרה יומית. הפרדה הזו היא
 * מה שמאפשר לעצור דיוור שיצא לא נכון בלחיצה אחת.
 */

export interface EnqueueBroadcastResult {
  campaignId: string;
  queued: number;
  optedOut: number;
}

export async function enqueueBroadcast(input: {
  name: string;
  message: string;
  createdById: string | null;
  /** E.164 בלי הפלוס, כבר מנוקה ומאוחד ב-`parsePhoneList` */
  phones: string[];
}): Promise<EnqueueBroadcastResult> {
  const body = normalizeBroadcastText(input.message).slice(
    0,
    BROADCAST_MAX_CHARS,
  );

  /*
   * ⚠️ **אותו רישום הסרה של החידושים, ולא רישום שני.** לקוח שכתב
   * "הסר" התכוון להסרה מהודעות של החברה, לא מקמפיין מסוים. רישום
   * נפרד לדיוור היה מכבד את הבקשה במסך אחד וממשיך לשלוח מהשני.
   */
  const optedOut = new Set(
    (await prisma.renewalOptOut.findMany({ select: { phone: true } })).map(
      (r) => r.phone,
    ),
  );

  const targets = input.phones.filter((p) => !optedOut.has(p));

  const campaign = await prisma.waCampaign.create({
    data: {
      name: input.name,
      message: input.message,
      status: targets.length > 0 ? "sending" : "done",
      totalCount: targets.length,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  const now = new Date();
  const { count } = await prisma.whatsAppMessage.createMany({
    data: targets.map((phone) => ({
      dedupeKey: broadcastDedupeKey(campaign.id, phone),
      campaignId: campaign.id,
      toPhone: phone,
      // ⚠️ ה-snapshot הוא הטקסט **המנורמל**: הוא מה שנכנס לפרמטר
      // התבנית ב-`deliver`, וגם מה שיוצג אחר כך כראיה למה שנשלח.
      body,
      scheduledFor: now,
    })),
    skipDuplicates: true,
  });

  return {
    campaignId: campaign.id,
    queued: count,
    optedOut: input.phones.length - targets.length,
  };
}

export interface BroadcastRow {
  id: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  createdAt: Date;
}

export interface BroadcastOverview {
  paused: boolean;
  pausedReason: string | null;
  sentToday: number;
  dailyCap: number;
  optedOut: number;
  campaigns: BroadcastRow[];
}

/**
 * מצב הדיוור למסך.
 *
 * ⚠️ המונים נספרים מהתור ולא נקראים משדה שמור, כמו בדיוור במייל:
 * מונה שסותר את התור הוא שקר שנראה כמו מידע.
 *
 * ⚠️ `sentToday` ו-`dailyCap` הם של **כל** הוואטסאפ ולא של הדיוור
 * בלבד — התזכורות והדיוור חולקים מספר אחד, ולכן גם תקרה אחת.
 */
export async function broadcastOverview(): Promise<BroadcastOverview> {
  const [settings, today, optedOut, campaigns] = await Promise.all([
    readSettings(),
    sentToday(),
    prisma.renewalOptOut.count(),
    prisma.waCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        status: true,
        totalCount: true,
        createdAt: true,
      },
    }),
  ]);

  const counts = await prisma.whatsAppMessage.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });

  const rows: BroadcastRow[] = campaigns.map((c) => {
    const mine = counts.filter((x) => x.campaignId === c.id);
    const of = (status: string) =>
      mine.find((x) => x.status === status)?._count._all ?? 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      total: c.totalCount,
      sent: of("sent"),
      failed: of("failed"),
      pending: of("queued") + of("sending"),
      createdAt: c.createdAt,
    };
  });

  return {
    paused: settings.paused,
    pausedReason: settings.pausedReason,
    sentToday: today,
    dailyCap: settings.dailyCap,
    optedOut,
    campaigns: rows,
  };
}
