import { PackagesClient } from "@/components/packages/PackagesClient";
import { db } from "@/server/repositories";
import { requireStaffUser } from "@/server/auth/session";

export default async function PackagesPage() {
  // קטלוג הספקים והעמלות הוא מידע מסחרי פנימי — לא לספק חיצוני.
  await requireStaffUser();

  const [packages, leadCosts] = await Promise.all([
    db.packages.list(),
    db.settings.getLeadCosts(),
  ]);

  return <PackagesClient packages={packages} leadCosts={leadCosts} />;
}
