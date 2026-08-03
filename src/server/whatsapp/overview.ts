import "server-only";

import { prisma } from "@/server/db/client";
import { isIsraeliPhone } from "@/lib/format";
import { startOfDay } from "@/lib/tz";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { readSettings, type BotSettingsView } from "./settings";
import { plannedSendAt } from "./outbox";

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

/**
 * חזרה עתידית שעדיין לא הפכה להודעה בתור.
 *
 * ⚠️ הקטגוריה הזו קיימת בגלל בלבול אמיתי: שורה בתור נוצרת רק דקות
 * לפני השליחה, ולכן חזרה שנקבעה למחר לא מופיעה בשום מקום במסך — מה
 * שנראה בדיוק כמו תזכורת שאבדה. כאן רואים גם *מתי* היא תצא, וגם
 * *למה לא* תצא, במקום להסיק את זה משתיקה.
 */
export interface UpcomingRow {
  leadId: string;
  leadName: string;
  followUpAt: string;
  /** מתי התזכורת מתוכננת לצאת. null כשהיא חסומה ולא תצא כלל. */
  sendAt: string | null;
  assigneeName: string | null;
  /** הסיבה שלא תישלח. null = תקין ותצא במועד. */
  blockedReason: string | null;
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
  upcoming: UpcomingRow[];
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

/**
 * למה הליד הזה לא ייצר תזכורת. `null` = ייצר.
 *
 * ⚠️ הסדר והתנאים **חייבים** להישאר זהים ל-`enqueueDueFollowUps`.
 * מסך שמבטיח "תצא ב-16:20" על ליד שהמנוע ידלג עליו גרוע ממסך שלא
 * אומר כלום — הוא הופך כשל שקט לשקט מאושר.
 */
function blockedReasonFor(lead: {
  status: string;
  assigneeId: string | null;
  assignee: { active: boolean; phone: string | null } | null;
}): string | null {
  if (STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.terminal) {
    return "הליד סגור";
  }
  if (!lead.assigneeId) return "הליד לא משויך לאף אחד";
  if (!lead.assignee?.active) return "העובד המשויך לא פעיל";
  if (!lead.assignee.phone) return "לעובד המשויך אין מספר טלפון";
  if (!isIsraeliPhone(lead.assignee.phone)) {
    return "מספר הטלפון של העובד לא תקין";
  }
  return null;
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
    withFollowUp,
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

    // כל ליד עם תאריך חזרה. הסינון לפי זכאות נעשה בקוד ולא בשאילתה
    // **בכוונה** — ליד שנפסל הוא בדיוק מה שהמסך צריך להראות, עם הסיבה.
    prisma.lead.findMany({
      where: { followUpAt: { not: null } },
      orderBy: { followUpAt: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        status: true,
        followUpAt: true,
        assigneeId: true,
        assignee: { select: { name: true, active: true, phone: true } },
        whatsappMessages: {
          where: { status: { notIn: ["cancelled"] } },
          select: { id: true },
        },
      },
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

  // חזרות שעדיין לא הפכו להודעה. שורה שכבר קיימת בתור או שנשלחה
  // מוצגת בלשוניות שלה, ולהופיע בשתיהן היה נראה ככפילות.
  const upcoming: UpcomingRow[] = withFollowUp
    .filter((l) => l.whatsappMessages.length === 0)
    .map((l) => {
      const followUpAt = l.followUpAt!;
      const blocked = blockedReasonFor(l);

      return {
        leadId: l.id,
        leadName: l.name,
        followUpAt: followUpAt.toISOString(),
        sendAt: blocked ? null : plannedSendAt(followUpAt, settings).toISOString(),
        assigneeName: l.assignee?.name ?? null,
        blockedReason: blocked,
      };
    });

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
    upcoming,
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
