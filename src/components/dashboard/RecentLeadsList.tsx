"use client";

import type { Lead } from "@/lib/domain/types";
import { KIND_CONFIG, LEAD_CATEGORY_CONFIG } from "@/lib/domain/types";
import { relative } from "@/lib/format";
import { useNow } from "@/lib/clock";
import { Badge, EmptyState } from "@/components/ui/primitives";

/**
 * "אחרונים" — הלידים האחרונים שנכנסו למערכת.
 *
 * "use client" רק בגלל הזמן היחסי ("לפני 3 שע׳"): צריך `useNow()`
 * עם שער ה-null כדי לא ליצור אי-התאמת הידרציה, בדיוק כמו ב-LeadsTable.
 */
export function RecentLeadsList({ leads }: { leads: Lead[] }) {
  const now = useNow();

  if (leads.length === 0) {
    return (
      <EmptyState icon="leads" title="אין עדיין לידים" body="לידים חדשים יופיעו כאן." />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {leads.map((lead) => (
        <li key={lead.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-1">{lead.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
              <span>{lead.category ? LEAD_CATEGORY_CONFIG[lead.category].label : "כללי"}</span>
              <span className="text-ink-4">·</span>
              {now === null ? (
                <span className="inline-block h-3 w-14" />
              ) : (
                <span>{relative(lead.createdAt, now)}</span>
              )}
            </p>
          </div>
          <Badge tone={KIND_CONFIG[lead.kind].tone} className="shrink-0">
            {KIND_CONFIG[lead.kind].short}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
