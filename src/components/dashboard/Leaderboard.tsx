import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";
import type { AgentPerformance } from "@/server/services/economics";
import { number } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";

/**
 * לוח מובילים לעובדים/סוכנים — כמה עסקאות סגרו היום ובחודש הנוכחי.
 *
 * `perfToday`/`perfMonth` מגיעים כבר מחושבים מ-`performanceByAgent()`
 * (ראה `src/app/(app)/page.tsx`) — הרכיב רק ממזג אותם עם נתוני המשתמש
 * ומרנדר טבלה. שים לב לכיתוב התחתון: גם במערכת האמיתית ספירת
 * העסקאות המאושרות לא מחוברת סופית, אז השארנו את ההסתייגות למרות
 * שהמספרים כאן כן אמיתיים (נגזרים מ-`SEED_DEALS`).
 */
export function Leaderboard({
  users,
  perfToday,
  perfMonth,
}: {
  users: User[];
  perfToday: AgentPerformance[];
  perfMonth: AgentPerformance[];
}) {
  const todayById = new Map(perfToday.map((p) => [p.agentId, p.deals]));
  const monthById = new Map(perfMonth.map((p) => [p.agentId, p.deals]));

  const rows = users
    .filter((u) => u.role === "agent" || u.role === "employee")
    .map((u) => ({
      user: u,
      today: todayById.get(u.id) ?? 0,
      month: monthById.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.month - a.month || b.today - a.today);

  return (
    <div>
      {rows.length === 0 ? (
        <EmptyState icon="user" title="אין עדיין עובדים פעילים" />
      ) : (
        // ⚠️ `min-w-[420px]` היה הופך את **מסך הבית** לנגלל לצדדים
        // בטלפון. ארבע עמודות של ערכים קצרים לא צריכות רוחב מינימלי —
        // הן פשוט מתכווצות, וגם ב-330px הן קריאות.
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse text-sm lg:min-w-[420px]">
            <thead>
              <tr className="border-b border-line text-right text-xs text-ink-3">
                <th className="py-2 font-medium">שם</th>
                <th className="py-2 font-medium">תפקיד</th>
                <th className="py-2 text-center font-medium">היום</th>
                <th className="py-2 text-center font-medium">החודש</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, today, month }) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 font-medium text-ink-1">{user.name}</td>
                  <td className="py-2.5 text-ink-3">{ROLE_CONFIG[user.role].label}</td>
                  <td className="nums py-2.5 text-center text-ink-1">{number(today)}</td>
                  <td className="nums py-2.5 text-center font-semibold text-ink-1">
                    {number(month)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-4">
        * ספירת עסקאות מאושרות תתעדכן אוטומטית
      </p>
    </div>
  );
}
