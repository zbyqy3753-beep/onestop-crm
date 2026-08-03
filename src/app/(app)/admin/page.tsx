import { notFound } from "next/navigation";
import { AdminClient } from "@/components/admin/AdminClient";
import { db } from "@/server/repositories";
import { prisma } from "@/server/db/client";
import { requireSessionUser } from "@/server/auth/session";

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

  const [users, { rows: leads }, health, failures] = await Promise.all([
    db.users.list(),
    db.leads.list(),
    // הדופק והכשלים נקראים ישירות מ-Prisma ולא דרך repository: אין
    // להם מימוש בזיכרון ואין להם קורא שני. שכבת repository כאן הייתה
    // הפשטה לצרכן יחיד.
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
    />
  );
}
