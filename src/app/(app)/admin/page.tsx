import { notFound } from "next/navigation";
import { AdminClient } from "@/components/admin/AdminClient";
import { db } from "@/server/repositories";
import { prisma } from "@/server/db/client";
import { requireSessionUser } from "@/server/auth/session";
import { readSettings } from "@/server/whatsapp/settings";
import { sentToday } from "@/server/whatsapp/outbox";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * ⚠️ המסך הזה חושף את כל המשתמשים בארגון ומאפשר ליצור משתמש חדש.
 * עד עכשיו לא הייתה בו שום בדיקה — גם לא `requireSessionUser` — כך
 * שכל מי שהגיע לכתובת ראה את הרשימה. הסתרת הפריט מהתפריט ב-`nav.ts`
 * היא הסתרה, לא הרשאה: הנתיב עצמו היה נגיש בהקלדה ישירה.
 *
 * `notFound()` ולא הפניה — מי שאין לו הרשאה לא צריך ללמוד שהמסך קיים.
 */
const ALLOWED = ["owner", "manager"] as const;

export default async function AdminPage() {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) notFound();

  const [users, { rows: leads }, health, failures, settings, queue, todayCount] =
    await Promise.all([
      db.users.list(),
      db.leads.list(),
      // הדופק, הכשלים והתור נקראים ישירות מ-Prisma ולא דרך repository:
      // אין להם מימוש בזיכרון ואין להם קורא שני. שכבת repository כאן
      // הייתה הפשטה לצרכן יחיד.
      prisma.botHeartbeat.findUnique({ where: { id: "default" } }),
      prisma.whatsAppMessage.findMany({
        where: { status: "failed" },
        orderBy: { scheduledFor: "desc" },
        take: 20,
        select: {
          id: true,
          toPhone: true,
          lastError: true,
          scheduledFor: true,
        },
      }),
      readSettings(),
      // 50 ולא הכול: כשהתור ארוך באמת (מחשב שהיה כבוי סוף שבוע) הרשימה
      // המלאה מנפחת את ה-HTML של המסך בלי להוסיף החלטה שאפשר לקבל ממנה
      prisma.whatsAppMessage.findMany({
        where: { status: "queued" },
        orderBy: { scheduledFor: "asc" },
        take: 50,
        select: {
          id: true,
          toPhone: true,
          body: true,
          scheduledFor: true,
          recipient: { select: { name: true } },
        },
      }),
      sentToday(),
    ]);

  return (
    <AdminClient
      users={users}
      leads={leads}
      canImpersonate={actor.role === "owner"}
      currentUserId={actor.id}
      botHealth={
        health
          ? {
              lastSeenAt: health.lastSeenAt.toISOString(),
              waConnected: health.waConnected,
              waNumber: health.waNumber,
              instanceId: health.instanceId,
              queuedCount: health.queuedCount,
            }
          : null
      }
      botFailures={failures.map((f) => ({
        ...f,
        scheduledFor: f.scheduledFor.toISOString(),
      }))}
      botSettings={{
        ...settings,
        pausedAt: settings.pausedAt?.toISOString() ?? null,
      }}
      botQueue={queue.map((m) => ({
        id: m.id,
        toPhone: m.toPhone,
        body: m.body,
        scheduledFor: m.scheduledFor.toISOString(),
        recipientName: m.recipient?.name ?? null,
      }))}
      botSentToday={todayCount}
    />
  );
}
