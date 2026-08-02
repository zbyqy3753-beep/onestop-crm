import { LeadsClient } from "@/components/leads/LeadsClient";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import { canSeeAllLeads } from "@/lib/domain/permissions";
import type { LeadFilter } from "@/server/repositories";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * ⚠️ **הגבלת הצפייה נעשית כאן, בשליפה עצמה — לא בסינון בצד הלקוח.**
 * עובד שאינו מנהל מקבל מהשרת רק את הלידים שמשויכים אליו, כך שלידים
 * של אחרים לא מגיעים לדפדפן שלו בכלל. סינון בלקוח היה משאיר אותם
 * ב-payload של הדף וניתנים לקריאה לכל מי שפותח כלי פיתוח.
 *
 * אותו מסנן מוזרק גם ל-`countByStatus`, אחרת הקוביות היו מונות את
 * כל הארגון בזמן שהטבלה מציגה חתך אישי — שני מספרים סותרים במסך אחד.
 */
export default async function LeadsPage() {
  const currentUser = await requireSessionUser();

  /*
   * עובד רואה **אך ורק** לידים שמשויכים אליו — גם לא לידים ללא שיוך.
   *
   * המשמעות התפעולית: חלוקת הלידים היא באחריות ההנהלה בלבד. ליד
   * שנכנס מה-API ולא שויך אוטומטית יושב במאגר וגלוי רק למנהלים, עד
   * שמישהו מהם משייך אותו. עובד לא לוקח לעצמו לידים.
   */
  const scope: LeadFilter = canSeeAllLeads(currentUser.role)
    ? {}
    : { assigneeId: [currentUser.id] };

  const [{ rows: leads }, users, counts, leadCosts, deals, packages] =
    await Promise.all([
      db.leads.list(scope),
      db.users.listActive(),
      db.leads.countByStatus(scope),
      db.settings.getLeadCosts(),
      db.deals.list(),
      db.packages.list(),
    ]);

  return (
    <LeadsClient
      leads={leads}
      users={users}
      counts={counts}
      leadCosts={leadCosts}
      deals={deals}
      packages={packages}
      currentUserId={currentUser.id}
      canSeeAll={canSeeAllLeads(currentUser.role)}
    />
  );
}
