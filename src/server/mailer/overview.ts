import "server-only";

import { prisma } from "@/server/db/client";
import { readMailerSettings } from "./settings";
import { sentMailToday } from "./outbox";

/**
 * מצב הדיוור למסך.
 *
 * ⚠️ **המונים נספרים מהתור ולא נקראים משדה.** מונה שנשמר בקמפיין
 * יכול לסתור את התור — וכשהוא סותר, זה שקר שנראה כמו מידע.
 */

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  createdAt: Date;
}

export interface MailerOverview {
  paused: boolean;
  pausedReason: string | null;
  sentToday: number;
  dailyCap: number;
  perTick: number;
  campaigns: CampaignRow[];
}

export async function mailerOverview(): Promise<MailerOverview> {
  const [settings, today, campaigns] = await Promise.all([
    readMailerSettings(),
    sentMailToday(),
    prisma.emailCampaign.findMany({
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

  const counts = await prisma.emailMessage.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });

  const rows: CampaignRow[] = campaigns.map((c) => {
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
    perTick: settings.perTick,
    campaigns: rows,
  };
}

/** שורת נמען ברשימת הדיוור. */
export interface RecipientRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  sentAt: Date | null;
  error: string | null;
}

/**
 * הנמענים של דיוור אחד.
 *
 * ⚠️ **קיים כדי לענות על "לא קיבלתי".** בלי הרשימה הזו, דילר שטוען
 * שלא קיבל מייל מייצר בירור שאי אפשר להכריע: המונה אומר "22 נשלחו"
 * ולא אומר למי. כאן רואים את השורה שלו, את הסטטוס ואת השעה.
 *
 * ⚠️ תקרה של 500 שורות. דיוור גדול יותר יוצג חלקית, והחיפוש הוא
 * הדרך להגיע לכתובת מסוימת — עדיף מלמשוך עשרות אלפי שורות לדפדפן.
 */
export async function campaignRecipients(
  campaignId: string,
  search?: string,
): Promise<RecipientRow[]> {
  const q = search?.trim();

  const rows = await prisma.emailMessage.findMany({
    where: {
      campaignId,
      ...(q
        ? {
            OR: [
              { toEmail: { contains: q, mode: "insensitive" as const } },
              { toName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ sentAt: "asc" }, { toEmail: "asc" }],
    take: 500,
    select: {
      id: true,
      toEmail: true,
      toName: true,
      status: true,
      sentAt: true,
      lastError: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.toEmail,
    name: r.toName,
    status: r.status,
    sentAt: r.sentAt,
    error: r.lastError,
  }));
}
