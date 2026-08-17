import { PackagesClient } from "@/components/packages/PackagesClient";
import { db } from "@/server/repositories";
import { requireStaffUser } from "@/server/auth/session";
import { canManageSettings } from "@/lib/domain/permissions";

export default async function PackagesPage() {
  // קטלוג הספקים והעמלות הוא מידע מסחרי פנימי — לא לספק חיצוני.
  // מעבר לכך המסך פתוח לכל הצוות בכוונה, ולכן אין כאן `ROUTE_ROLES`.
  const currentUser = await requireStaffUser();

  const [packages, leadCosts] = await Promise.all([
    db.packages.list(),
    db.settings.getLeadCosts(),
  ]);

  return (
    <PackagesClient
      packages={packages}
      leadCosts={leadCosts}
      canEditCosts={canManageSettings(currentUser.role)}
    />
  );
}
