"use client";

import type { Lead, LeadCostTable, LeadStatus, User } from "@/lib/domain/types";
import { leadCost } from "@/server/services/economics";
import { Button, EmptyState, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { SortField } from "./LeadsClient";
import { LeadRow } from "./LeadRow";

/**
 * טבלת הלידים: כותרת, מיון, ובחירה. השורה עצמה חיה ב-`LeadRow`
 * והתאים החוזרים ב-`cells.tsx`.
 *
 * בחירת "הכל" היא בהיקף העמוד המוצג בלבד — `LeadsClient` הוא זה
 * שמצליב את הבחירה מול מלוא התוצאה המסוננת.
 */

const COLUMNS: { field: SortField; label: string; className?: string }[] = [
  { field: "name", label: "ליד" },
  { field: "status", label: "סטטוס" },
  { field: "priority", label: "עדיפות" },
  { field: "updatedAt", label: "פעילות אחרונה" },
];

export function LeadsTable({
  leads,
  userById,
  leadCosts,
  selected,
  onSelectedChange,
  sort,
  onSortChange,
  onOpen,
  onStatus,
  onCost,
  onStar,
  onAdd,
  hasFilters,
  busy,
}: {
  leads: Lead[];
  userById: Map<string, User>;
  leadCosts: LeadCostTable;
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  sort: { field: SortField; dir: "asc" | "desc" };
  onSortChange: (s: { field: SortField; dir: "asc" | "desc" }) => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, to: LeadStatus) => void;
  onCost: (id: string, cost: number | null) => void;
  onStar: (id: string, next: boolean) => void;
  onAdd: () => void;
  hasFilters: boolean;
  busy: boolean;
}) {
  const now = useNow();

  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function toggleAll() {
    const next = new Set(selected);
    // רק שורות העמוד הנוכחי מושפעות — בחירות בעמודים אחרים נשמרות
    if (allChecked) for (const l of leads) next.delete(l.id);
    else for (const l of leads) next.add(l.id);
    onSelectedChange(next);
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  function sortBy(field: SortField) {
    onSortChange(
      sort.field === field
        ? { field, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { field, dir: field === "name" ? "asc" : "desc" },
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          title={hasFilters ? "אין לידים שתואמים לסינון" : "אין לידים עדיין"}
          body={
            hasFilters
              ? "נסה להסיר חלק מהמסננים או לשנות את מילת החיפוש."
              : "הוסף את הליד הראשון או ייבא רשימה מקובץ CSV."
          }
          action={
            !hasFilters && (
              <Button variant="primary" icon="plus" onClick={onAdd}>
                ליד חדש
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      {/* 9 עמודות — הרוחב המינימלי גדל יחד עם עמודות העלות והפעילות */}
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        {/* הכותרת נדבקת מתחת לסרגל העליון — 64 שורות זה הרבה גלילה */}
        <thead className="sticky top-[60px] z-10 bg-surface-2">
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="w-10 ps-3 text-start">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                aria-label="בחירת כל הלידים המוצגים"
                className="accent-[var(--c-brand)]"
              />
            </th>
            {COLUMNS.map((col) => (
              <th key={col.field} className="px-3 py-2.5 text-start font-medium">
                <button
                  onClick={() => sortBy(col.field)}
                  className="inline-flex items-center gap-1 hover:text-ink-1"
                >
                  {col.label}
                  {sort.field === col.field && (
                    <Icon
                      name="chevronDown"
                      size={13}
                      className={sort.dir === "asc" ? "rotate-180" : ""}
                    />
                  )}
                </button>
              </th>
            ))}
            <th className="px-3 py-2.5 text-start font-medium">קטגוריה</th>
            <th className="px-3 py-2.5 text-start font-medium">עלות</th>
            <th className="px-3 py-2.5 text-start font-medium">משויך ל</th>
            <th className="px-3 py-2.5 text-start font-medium">פעילות</th>
            <th className="w-20">
              <span className="sr-only">פעולות</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              now={now}
              assignee={lead.assigneeId ? userById.get(lead.assigneeId) : undefined}
              userById={userById}
              cost={leadCost(lead, leadCosts)}
              checked={selected.has(lead.id)}
              busy={busy}
              onToggle={() => toggleOne(lead.id)}
              onOpen={() => onOpen(lead.id)}
              onStatus={(to) => onStatus(lead.id, to)}
              onCost={(cost) => onCost(lead.id, cost)}
              onStar={(next) => onStar(lead.id, next)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
