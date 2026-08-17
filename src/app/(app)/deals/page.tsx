import { DealsClient } from "@/components/deals/DealsClient";
import { db } from "@/server/repositories";
import { requireRouteAccess } from "@/server/auth/session";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד — כשמחליפים ל-Postgres
 * הקובץ הזה לא משתנה.
 *
 * ⚠️ המסך מציג את **כל** העסקאות בארגון, את מאגר הלידים כולו ואת
 * רשימת המשתמשים — ולכן הוא ניהולי. עד עכשיו הוא הסתפק ב-
 * `requireStaffUser`, שחוסם ספק חיצוני בלבד: כל עובד שהקליד `/deals`
 * קיבל את הכול. הגבלת התפקידים הייתה כתובה ב-`nav.ts` ומעולם לא
 * נאכפה כאן.
 */
export default async function DealsPage() {
  // לפני השליפה, לא בתוך ה-Promise.all: `notFound` זורק, אבל שאילתה
  // שכבר יצאה כבר רצה. ראה requireRouteAccess.
  await requireRouteAccess("/deals");

  const [deals, leads, users, packages, leadCosts] = await Promise.all([
    db.deals.list(),
    db.leads.list(),
    db.users.list(),
    db.packages.list(),
    db.settings.getLeadCosts(),
  ]);

  return (
    <DealsClient
      deals={deals}
      leads={leads.rows}
      users={users}
      packages={packages}
      leadCosts={leadCosts}
    />
  );
}
