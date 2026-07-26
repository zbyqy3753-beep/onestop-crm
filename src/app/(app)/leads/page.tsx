import { LeadsClient } from "@/components/leads/LeadsClient";
import { db } from "@/server/repositories";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 * כשמחליפים ל-Postgres, הקובץ הזה לא משתנה.
 */
export default async function LeadsPage() {
  const [{ rows: leads }, users, counts] = await Promise.all([
    db.leads.list(),
    db.users.listActive(),
    db.leads.countByStatus(),
  ]);

  return <LeadsClient leads={leads} users={users} counts={counts} />;
}
