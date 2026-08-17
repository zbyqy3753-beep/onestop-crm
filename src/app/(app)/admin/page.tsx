import { AdminClient } from "@/components/admin/AdminClient";
import { db } from "@/server/repositories";
import { prisma } from "@/server/db/client";
import { requireRouteAccess } from "@/server/auth/session";
import { readSettings } from "@/server/whatsapp/settings";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * ⚠️ המסך הזה חושף את כל המשתמשים בארגון ומאפשר ליצור משתמש חדש.
 * עד עכשיו לא הייתה בו שום בדיקה — גם לא `requireSessionUser` — כך
 * שכל מי שהגיע לכתובת ראה את הרשימה. הסתרת הפריט מהתפריט ב-`nav.ts`
 * היא הסתרה, לא הרשאה: הנתיב עצמו היה נגיש בהקלדה ישירה.
 *
 * ההרשאה מוגדרת ב-`ROUTE_ROLES` ולא בקבוע מקומי, כדי שהתפריט והמסך
 * לא יוכלו להסכים על דברים שונים — ראה `lib/domain/permissions.ts`.
 */
export default async function AdminPage() {
  const actor = await requireRouteAccess("/admin");

  // ⚠️ רק מה שהרצועה צריכה. הפירוט המלא — תור, היסטוריה, נמענים —
  // חי ב-`/bots`, ושליפתו כאן הייתה עולה בכל טעינה של מסך המשתמשים
  // בשביל נתונים שהמסך הזה לא מציג.
  const [users, { rows: leads }, health, failureCount, queuedCount, settings] =
    await Promise.all([
      db.users.list(),
      db.leads.list(),
      // הדופק והספירות נקראים ישירות מ-Prisma ולא דרך repository: אין
      // להם מימוש בזיכרון ואין להם קורא שני. שכבת repository כאן הייתה
      // הפשטה לצרכן יחיד.
      prisma.botHeartbeat.findUnique({ where: { id: "default" } }),
      prisma.whatsAppMessage.count({ where: { status: "failed" } }),
      prisma.whatsAppMessage.count({ where: { status: "queued" } }),
      readSettings(),
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
      botPaused={settings.paused}
      botFailureCount={failureCount}
      botQueuedCount={queuedCount}
    />
  );
}
