"use client";

import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";
import type { AgentPerformance } from "@/server/services/economics";
import { money, number } from "@/lib/format";

/**
 * עמלות ורווח לכל עובד, על העסקאות ששייכות ללידים המוצגים כרגע.
 *
 * מסודר לפי עמלה יורדת — זה מה שסוכן מחפש בטבלה הזו, לא סדר אלפביתי.
 */
export function LeadsPerformancePanel({
  rows,
  userById,
}: {
  rows: AgentPerformance[];
  userById: Map<string, User>;
}) {
  if (rows.length === 0) return null;

  const byCommission = [...rows].sort((a, b) => b.commission - a.commission);
  const max = byCommission[0].commission || 1;

  return (
    <section className="mb-4" aria-label="ביצועים ועמלות עובדים">
      <h2 className="mb-2 text-sm font-semibold text-ink-2">
        ביצועים ועמלות עובדים
      </h2>

      <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[460px] border-collapse text-sm">
          <thead className="bg-surface-2 text-xs text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-start font-medium">עובד</th>
              <th className="px-3 py-2 text-start font-medium">תפקיד</th>
              <th className="px-3 py-2 text-center font-medium">עסקאות</th>
              <th className="px-3 py-2 text-start font-medium">עמלות</th>
              <th className="px-3 py-2 text-start font-medium">רווח</th>
            </tr>
          </thead>
          <tbody>
            {byCommission.map((row) => {
              const user = userById.get(row.agentId);
              return (
                <tr
                  key={row.agentId}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-3 py-2.5 font-medium text-ink-1">
                    {user?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-3">
                    {user ? ROLE_CONFIG[user.role].label : "—"}
                  </td>
                  <td className="nums px-3 py-2.5 text-center text-ink-2">
                    {number(row.deals)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="nums block font-semibold text-ink-1">
                      {money(row.commission)}
                    </span>
                    {/* origin-right: הבר גדל מימין לשמאל כמו שאר המערכת */}
                    <span className="mt-1 block h-1 rounded-full bg-surface-3">
                      <span
                        className="block h-full origin-right rounded-full bg-brand"
                        style={{ transform: `scaleX(${row.commission / max})` }}
                      />
                    </span>
                  </td>
                  <td
                    className={`nums px-3 py-2.5 font-semibold ${
                      row.profit >= 0 ? "text-good" : "text-bad"
                    }`}
                  >
                    {money(row.profit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
