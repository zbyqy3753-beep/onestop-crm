import { RegistrationsClient } from "@/components/registrations/RegistrationsClient";
import { db } from "@/server/repositories";
import { CURRENT_USER_ID } from "@/lib/domain/seed";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 * כשמחליפים ל-Postgres, הקובץ הזה לא משתנה.
 */
export default async function RegistrationsPage() {
  const [registrations, users] = await Promise.all([
    db.registrations.list(),
    db.users.list(),
  ]);

  return (
    <RegistrationsClient
      registrations={registrations}
      users={users}
      currentUserId={CURRENT_USER_ID}
    />
  );
}
