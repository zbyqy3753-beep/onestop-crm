import { RegistrationsClient } from "@/components/registrations/RegistrationsClient";
import { db } from "@/server/repositories";
import { requireRouteAccess } from "@/server/auth/session";
import type { UserRef } from "@/lib/domain/types";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 * כשמחליפים ל-Postgres, הקובץ הזה לא משתנה.
 */
export default async function RegistrationsPage() {
  // לפני השליפה ולא בתוכה — ראה requireRouteAccess
  const currentUser = await requireRouteAccess("/registrations");

  const [registrations, allUsers] = await Promise.all([
    db.registrations.list(),
    // ⚠️ `listActive` ולא `list`: חשבון מושבת אינו יעד שיוך, ואין שום
    // סיבה שהמייל והטלפון שלו ייסעו לדפדפן. ההיטל ל-`UserRef` משאיר
    // רק את מה שהמסך באמת מציג — ראה ההערה על `UserRef` ב-types.ts
    db.users.listActive(),
  ]);

  const users = allUsers.map(({ id, name, role }): UserRef => ({
    id,
    name,
    role,
  }));

  return (
    <RegistrationsClient
      registrations={registrations}
      users={users}
      currentUserId={currentUser.id}
    />
  );
}
