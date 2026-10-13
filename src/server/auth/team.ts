import { db } from "@/server/repositories";
import { canLeadTeam, canSeeAllLeads } from "@/lib/domain/permissions";
import type { User } from "@/lib/domain/types";

/**
 * העובדים המשויכים לבעל העסק — כולל לא פעילים.
 *
 * ⚠️ לא פעילים נכללים בכוונה: עובד שעזב משאיר אחריו לידים, ובעל העסק
 * צריך לראות אותם כדי להעביר אותם הלאה. השבתה לא אמורה להעלים מהמסך
 * שלו לידים שעדיין שלו.
 */
export async function listTeamMembers(ownerId: string): Promise<User[]> {
  const all = await db.users.list();
  return all.filter((u) => u.teamOwnerId === ownerId);
}

/**
 * אילו `assigneeId`-ים המשתמש רשאי לראות ולערוך.
 *
 * - `null` — הכול (בעלים/מנהל).
 * - בעל עסק — הוא עצמו + העובדים המשויכים אליו.
 * - כל השאר — רק הוא עצמו.
 *
 * ⚠️ מקור אמת יחיד לשליפה (`leads/page.tsx`) ולהרשאת העריכה
 * (`assertCanEdit`). שתי רשימות נפרדות היו נפרדות זו מזו עם הזמן —
 * ובדיוק שם נפתח חור שבו מסך מציג ליד שאסור לגעת בו, או להפך.
 */
export async function teamScopeIds(user: User): Promise<string[] | null> {
  if (canSeeAllLeads(user.role)) return null;
  if (!canLeadTeam(user.role)) return [user.id];
  const members = await listTeamMembers(user.id);
  return [user.id, ...members.map((m) => m.id)];
}
