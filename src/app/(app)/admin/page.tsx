import { AdminClient } from "@/components/admin/AdminClient";
import { db } from "@/server/repositories";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * מסך קריאה בלבד — אין עדיין מערכת הרשאות כתיבה, ולכן אין כאן
 * server actions כמו במסך הלידים.
 */
export default async function AdminPage() {
  const [users, { rows: leads }] = await Promise.all([
    db.users.list(),
    db.leads.list(),
  ]);

  return <AdminClient users={users} leads={leads} />;
}
