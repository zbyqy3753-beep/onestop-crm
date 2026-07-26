import { DealsClient } from "@/components/deals/DealsClient";
import { db } from "@/server/repositories";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד — כשמחליפים ל-Postgres
 * הקובץ הזה לא משתנה.
 */
export default async function DealsPage() {
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
