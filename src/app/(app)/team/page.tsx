import { TeamClient, type TeamMemberRow } from "@/components/team/TeamClient";
import { db } from "@/server/repositories";
import { requireRouteAccess } from "@/server/auth/session";
import { listTeamMembers } from "@/server/auth/team";
import { STATUS_CONFIG } from "@/lib/domain/types";

/**
 * "הצוות שלי" — בעל עסק (`bizManager` / `shopOwner`) רואה את העובדים
 * המשויכים אליו, מצרף עובד חדש ומנתק עובד.
 *
 * ⚠️ רק שדות תצוגה עוברים ללקוח — לא `User` מלא. בעל העסק לא צריך את
 * שם המקור או התפוגה של עובדיו, ופיזור של `User` היה מצרף כל שדה
 * שיתווסף לטיפוס בעתיד.
 */
export default async function TeamPage() {
  const actor = await requireRouteAccess("/team");
  const members = await listTeamMembers(actor.id);

  const { rows: leads } = members.length
    ? await db.leads.list({ assigneeId: members.map((m) => m.id) })
    : { rows: [] };

  const total = new Map<string, number>();
  const open = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.assigneeId) continue;
    total.set(lead.assigneeId, (total.get(lead.assigneeId) ?? 0) + 1);
    if (!STATUS_CONFIG[lead.status].terminal) {
      open.set(lead.assigneeId, (open.get(lead.assigneeId) ?? 0) + 1);
    }
  }

  const rows: TeamMemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    email: m.email,
    phone: m.phone,
    active: m.active,
    leads: total.get(m.id) ?? 0,
    openLeads: open.get(m.id) ?? 0,
  }));

  return <TeamClient ownerName={actor.name} members={rows} />;
}
