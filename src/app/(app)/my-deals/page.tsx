import { MyDealsClient } from "@/components/deals/MyDealsClient";
import { CURRENT_USER_ID } from "@/lib/domain/seed";
import { db } from "@/server/repositories";

/**
 * רכיב שרת. מסך "העסקאות שלי" — מעקב תפעולי אישי על העסקאות
 * שהסוכן המחובר סגר, בניגוד ל-`/deals` שהוא טבלת רווח ארגונית.
 */
export default async function MyDealsPage() {
  const [deals, leads, packages] = await Promise.all([
    db.deals.listByAgent(CURRENT_USER_ID),
    db.leads.list(),
    db.packages.list(),
  ]);

  return <MyDealsClient deals={deals} leads={leads.rows} packages={packages} />;
}
