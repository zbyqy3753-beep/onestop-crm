import { LeadsClient } from "@/components/leads/LeadsClient";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 * כשמחליפים ל-Postgres, הקובץ הזה לא משתנה.
 */
export default async function LeadsPage() {
  const [{ rows: leads }, users, counts, currentUser] = await Promise.all([
    db.leads.list(),
    db.users.listActive(),
    db.leads.countByStatus(),
    requireSessionUser(),
  ]);

  return (
    <LeadsClient
      leads={leads}
      users={users}
      counts={counts}
      currentUserId={currentUser.id}
    />
  );
}
