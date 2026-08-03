import "server-only";

import { prisma } from "@/server/db/client";
import { isIsraeliPhone } from "@/lib/format";
import { startOfDay } from "@/lib/tz";
import { readSettings, type BotSettingsView } from "./settings";

/**
 * כל מה שמסך הבוטים מציג, בשליפה אחת מרוכזת.
 *
 * מרוכז כאן ולא ב-`page.tsx` כי זה כבר לא "עוד כמה שאילתות": יש כאן
 * ספירות, שלוש רשימות ותצוגת נמענים, וההרכבה עצמה היא לוגיקה שראוי
 * שתהיה ניתנת לקריאה במקום אחד.
 */

export interface MessageRow {
  id: string;
  toPhone: string;
  body: string;
  scheduledFor: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  recipientName: string | null;
  leadName: string | null;
}

export interface RecipientRow {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  /** יש מספר, אבל הוא לא עובר אימות — הבוט ידלג עליו בשקט */
  phoneInvalid: boolean;
  openLeadsWithFollowUp: number;
}

export interface BotOverview {
  settings: BotSettingsView;
  health: {
    lastSeenAt: string;
    waConnected: boolean;
    waNumber: string | null;
    instanceId: string | null;
    queuedCount: number;
  } | null;
  counts: {
    queued: number;
    sending: number;
    sentToday: number;
    failedToday: number;
    cancelledToday: number;
    sentWeek: number;
  };
  queue: MessageRow[];
  recent: MessageRow[];
  failures: MessageRow[];
  recipients: RecipientRow[];
}

const SELECT = {
  id: true,
  toPhone: true,
  body: true,
  scheduledFor: true,
  sentAt: true,
  attempts: true,
  lastError: true,
  recipient: { select: { name: true } },
  lead: { select: { name: true } },
} as const;

type Raw = {
  id: string;
  toPhone: string;
  body: string;
  scheduledFor: Date;
  sentAt: Date | null;
  attempts: number;
  lastError: string | null;
  recipient: { name: string } | null;
  lead: { name: string } | null;
};

function toRow(m: Raw): MessageRow {
  return {
    id: m.id,
    toPhone: m.toPhone,
    body: m.body,
    scheduledFor: m.scheduledFor.toISOString(),
    sentAt: m.sentAt?.toISOString() ?? null,
    attempts: m.attempts,
    lastError: m.lastError,
    recipientName: m.recipient?.name ?? null,
    leadName: m.lead?.name ?? null,
  };
}

export async function botOverview(): Promise<BotOverview> {
  const dayStart = new Date(startOfDay(Date.now()));
  const weekStart = new Date(startOfDay(Date.now()) - 6 * 86_400_000);

  const [
    settings,
    health,
    queued,
    sending,
    sentToday,
    failedToday,
    cancelledToday,
    sentWeek,
    queue,
    recent,
    failures,
    users,
  ] = await Promise.all([
    readSettings(),
    prisma.botHeartbeat.findUnique({ where: { id: "default" } }),

    prisma.whatsAppMessage.count({ where: { status: "queued" } }),
    prisma.whatsAppMessage.count({ where: { status: "sending" } }),
    prisma.whatsAppMessage.count({
      where: { status: "sent", sentAt: { gte: dayStart } },
    }),
    prisma.whatsAppMessage.count({
      where: { status: "failed", scheduledFor: { gte: dayStart } },
    }),
    prisma.whatsAppMessage.count({
      where: { status: "cancelled", scheduledFor: { gte: dayStart } },
    }),
    prisma.whatsAppMessage.count({
      where: { status: "sent", sentAt: { gte: weekStart } },
    }),

    prisma.whatsAppMessage.findMany({
      where: { status: { in: ["queued", "sending"] } },
      orderBy: { scheduledFor: "asc" },
      take: 50,
      select: SELECT,
    }),
    prisma.whatsAppMessage.findMany({
      where: { status: "sent" },
      orderBy: { sentAt: "desc" },
      take: 30,
      select: SELECT,
    }),
    prisma.whatsAppMessage.findMany({
      where: { status: "failed" },
      orderBy: { scheduledFor: "desc" },
      take: 30,
      select: SELECT,
    }),

    // מי בכלל זכאי לקבל: עובד פעיל. מספר לא תקין נספר כאן ולא מסונן,
    // כי "לא מקבל תזכורות" הוא בדיוק מה שהמסך אמור להראות
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        _count: {
          select: { assignedLeads: { where: { followUpAt: { not: null } } } },
        },
      },
    }),
  ]);

  return {
    settings,
    health: health
      ? {
          lastSeenAt: health.lastSeenAt.toISOString(),
          waConnected: health.waConnected,
          waNumber: health.waNumber,
          instanceId: health.instanceId,
          queuedCount: health.queuedCount,
        }
      : null,
    counts: {
      queued,
      sending,
      sentToday,
      failedToday,
      cancelledToday,
      sentWeek,
    },
    queue: queue.map(toRow),
    recent: recent.map(toRow),
    failures: failures.map(toRow),
    recipients: users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      phone: u.phone,
      phoneInvalid: !!u.phone && !isIsraeliPhone(u.phone),
      openLeadsWithFollowUp: u._count.assignedLeads,
    })),
  };
}
