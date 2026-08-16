import { RegistrationsClient } from "@/components/registrations/RegistrationsClient";
import { db } from "@/server/repositories";
import { requireStaffUser } from "@/server/auth/session";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 * כשמחליפים ל-Postgres, הקובץ הזה לא משתנה.
 */
export default async function RegistrationsPage() {
  // לפני השליפה ולא בתוכה — ראה requireStaffUser
  const currentUser = await requireStaffUser();

  const [registrations, users] = await Promise.all([
    db.registrations.list(),
    db.users.list(),
  ]);

  return (
    <RegistrationsClient
      registrations={registrations}
      users={users}
      currentUserId={currentUser.id}
    />
  );
}
