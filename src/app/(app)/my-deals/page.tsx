import { MyDealsClient } from "@/components/deals/MyDealsClient";
import { requireStaffUser } from "@/server/auth/session";
import { db } from "@/server/repositories";

/**
 * רכיב שרת. מסך "העסקאות שלי" — מעקב תפעולי אישי על העסקאות
 * שהסוכן המחובר סגר, בניגוד ל-`/deals` שהוא טבלת רווח ארגונית.
 */
export default async function MyDealsPage() {
  const currentUser = await requireStaffUser();

  /*
   * ⚠️ הלידים נשלפים **אחרי** העסקאות ולא לצידן, כי החתך נגזר מהן.
   *
   * קודם רץ כאן `db.leads.list()` בלי שום מסנן, ו-`MyDealsClient` הוא
   * רכיב לקוח — כלומר מסך אישי שלח את כל מאגר הלידים של הארגון
   * ל-payload של הדף, בשביל מפת חיפוש לפי מזהה.
   *
   * החתך הנכון אינו "הלידים המשויכים אליי" אלא "הלידים שהעסקאות
   * האלה מפנות אליהם": ליד של עסקה שנסגרה יכול היה לעבור שיוך מאז,
   * וסינון לפי משויך היה מעלים ממני עסקה שאני עצמי סגרתי.
   */
  const deals = await db.deals.listByAgent(currentUser.id);

  const [{ rows: leads }, packages] = await Promise.all([
    db.leads.list({ id: deals.map((d) => d.leadId) }),
    db.packages.list(),
  ]);

  return <MyDealsClient deals={deals} leads={leads} packages={packages} />;
}
