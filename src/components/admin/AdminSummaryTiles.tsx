import type { Role, User } from "@/lib/domain/types";
import { number } from "@/lib/format";

/**
 * 6 אריחי סיכום לפי תפקיד.
 *
 * המערכת האמיתית מציגה 5 קטגוריות מנהלה (מנהלים/סוכנים/מנהלי עסקים/
 * חנויות/עובדים), אבל `Role` בקודבייס הזה מכיל 8 ערכים. המיפוי:
 * - מנהלים = `owner` + `manager` יחד (שניהם "דרג ניהולי")
 * - סוכנים = `agent`
 * - מנהלי עסקים = `bizManager`
 * - חנויות = `shopOwner`
 * - עובדים = `employee`
 * - `operator` לא ממופה לאף קטגוריה אמיתית — הוא נספר רק בסה"כ הכללי,
 *   לא באף אריח ספציפי (אין מספיק עדות איזו קטגוריה הוא הכי קרוב אליה).
 * - `supplier` גם הוא רק בסה"כ, אבל מסיבה אחרת: ספק לידים אינו חלק
 *   מהצוות, ואריח משלו היה מציג צד חיצוני לצד קטגוריות של עובדים.
 */
export function AdminSummaryTiles({ users }: { users: User[] }) {
  const bucket = (predicate: (role: Role) => boolean) =>
    users.filter((u) => predicate(u.role));

  const managers = bucket((r) => r === "owner" || r === "manager");
  const agents = bucket((r) => r === "agent");
  const bizManagers = bucket((r) => r === "bizManager");
  const shops = bucket((r) => r === "shopOwner");
  const employees = bucket((r) => r === "employee");

  const tiles = [
    { label: "סה״כ", users, icon: "user" as const },
    { label: "מנהלים", users: managers },
    { label: "סוכנים", users: agents },
    { label: "מנהלי עסקים", users: bizManagers },
    { label: "חנויות", users: shops },
    { label: "עובדים", users: employees },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <Tile key={t.label} label={t.label} users={t.users} />
      ))}
    </div>
  );
}

function Tile({ label, users }: { label: string; users: User[] }) {
  const active = users.filter((u) => u.active).length;

  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="nums mt-1 text-2xl font-bold text-ink-1">{number(users.length)}</p>
      <p className="nums mt-0.5 text-xs text-ink-4">{number(active)} פעילים</p>
    </div>
  );
}
