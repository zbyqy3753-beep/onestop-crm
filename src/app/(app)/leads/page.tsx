import { LeadsClient } from "@/components/leads/LeadsClient";
import { SupplierLeadsList } from "@/components/leads/SupplierLeadsList";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import { canSeeAllLeads, isSupplier } from "@/lib/domain/permissions";
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
   * ── ספק לידים חיצוני ──────────────────────────────────────────────
   *
   * מסלול נפרד לגמרי, ולא `LeadsClient` עם props מוגבלים. `LeadsClient`
   * הוא רכיב לקוח שמקבל את הלידים המלאים ואיתם משתמשים, עלויות רכישה,
   * עסקאות וחבילות — כלומר גם אם היינו מסתירים כל פקד, כל אלה היו
   * יושבים ב-payload של הדף וקריאים לכל מי שפותח DevTools. prop אחד
   * שנשכח בעוד שנה מחזיר את הדליפה בשקט.
   *
   * כאן במקום זה נשלפים רק הלידים שלו, וממופים לשם ותאריך **בשרת**,
   * לפני שמשהו עוזב אותו.
   */
  if (isSupplier(currentUser.role)) {
    /*
     * בלי `leadSourceName` אין שום דרך לדעת אילו לידים שלו — ורשימה
     * ריקה היא התשובה הנכונה. ההיפך (סינון ריק = "החזר הכול") היה
     * מציג לספק את כל מאגר הלידים של הארגון.
     */
    const sourceName = currentUser.leadSourceName?.trim();
    /*
     * מיון מפורש לפי `createdAt` ולא ברירת המחדל (`updatedAt`): המסך
     * מציג את תאריך **הקליטה**, ומיון לפי עדכון אחרון היה מקפיץ לראש
     * ליד בן חודש רק משום שעובד נגע בו הבוקר — רשימה שנראית מעורבבת
     * למי שרואה רק את התאריך השני.
     */
    const rows = sourceName
      ? (
          await db.leads.list({ sourceDetail: sourceName }, {
            field: "createdAt",
            direction: "desc",
          })
        ).rows
      : [];

    return (
      <SupplierLeadsList
        supplierName={currentUser.name}
        rows={rows.map((lead, i) => ({
          // מזהה הליד עצמו לא נשלח: הוא המפתח לכל Server Action על
          // הליד, ולספק אין שום פעולה לבצע. הרשימה מרונדרת בשרת ולא
          // ממוינת מחדש בלקוח, ולכן אינדקס הוא מפתח תקף — ובניגוד
          // לשם+תאריך, הוא ייחודי גם לשני לידים זהים באותו יום.
          key: String(i),
          name: lead.name,
          createdAt: lead.createdAt,
        }))}
      />
    );
  }

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
