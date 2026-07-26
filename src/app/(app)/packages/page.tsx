import { PackagesClient } from "@/components/packages/PackagesClient";
import { db } from "@/server/repositories";

export default async function PackagesPage() {
  const [packages, leadCosts] = await Promise.all([
    db.packages.list(),
    db.settings.getLeadCosts(),
  ]);

  return <PackagesClient packages={packages} leadCosts={leadCosts} />;
}
