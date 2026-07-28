import { RegistrationsClient } from "@/components/registrations/RegistrationsClient";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 * כשמחליפים ל-Postgres, הקובץ הזה לא משתנה.
 */
export default async function RegistrationsPage() {
  const [registrations, users, currentUser] = await Promise.all([
    db.registrations.list(),
    db.users.list(),
    requireSessionUser(),
  ]);

  return (
    <RegistrationsClient
      registrations={registrations}
      users={users}
      currentUserId={currentUser.id}
    />
  );
}
