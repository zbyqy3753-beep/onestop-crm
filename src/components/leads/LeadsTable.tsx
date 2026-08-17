"use client";

import type { Lead, LeadCostTable, LeadStatus, UserRef } from "@/lib/domain/types";
import { leadCost } from "@/server/services/economics";
import { Button, EmptyState, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { SortField } from "./LeadsClient";
import { COLUMNS, allowedColumns, type ColumnKey } from "./columns";
import { LeadRow } from "./LeadRow";
import type { LeadPatch } from "@/app/(app)/leads/actions";

/**
 * טבלת הלידים: כותרת, מיון, ובחירה. השורה עצמה חיה ב-`LeadRow`
 * והתאים החוזרים ב-`cells.tsx`.
 *
 * בחירת "הכל" היא בהיקף העמוד המוצג בלבד — `LeadsClient` הוא זה
 * שמצליב את הבחירה מול מלוא התוצאה המסוננת.
 */

export function LeadsTable({
  leads,
  userById,
  leadCosts,
  visibleColumns,
  selected,
  onSelectedChange,
  sort,
  onSortChange,
  onOpen,
  onStatus,
  onCost,
  onStar,
  onPatch,
  users,
  onAdd,
  hasFilters,
  canSeeAll,
  busyIds,
}: {
  leads: Lead[];
  userById: Map<string, UserRef>;
  leadCosts: LeadCostTable;
  visibleColumns: ColumnKey[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  sort: { field: SortField; dir: "asc" | "desc" };
  onSortChange: (s: { field: SortField; dir: "asc" | "desc" }) => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, to: LeadStatus) => void;
  onCost: (id: string, cost: number | null) => void;
  onStar: (id: string, next: boolean) => void;
  onPatch: (id: string, patch: LeadPatch) => void;
  /** עובדים פעילים — לבורר השיוך שבתוך השורה */
  users: UserRef[];
  onAdd: () => void;
  hasFilters: boolean;
  /** רואה את כל הארגון — קובע את נוסח המצב הריק */
  canSeeAll: boolean;
  /** הלידים שיש להם כתיבה בטיסה — רק השורות שלהם ננעלות, לא כל הטבלה */
  busyIds: ReadonlySet<string>;
}) {
  const now = useNow();

  // סדר העמודות נקבע ב-columns.ts ולא בסדר שבו המשתמש סימן אותן.
  // `allowedColumns` כאן ולא אצל הקורא: זו הנקודה היחידה שמרנדרת
  // עמודות, ולכן היא היחידה שאי אפשר לעקוף בטעות מקריאה חדשה.
  const shown = allowedColumns(
    COLUMNS.filter((c) => visibleColumns.includes(c.key)),
    canSeeAll,
  );

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
        {/* ראה ההערה ב-`LeadCardList` — שלושה מצבים ריקים, לא שניים */}
        <EmptyState
          title={
            hasFilters
              ? "אין לידים שתואמים לסינון"
              : canSeeAll
                ? "אין לידים עדיין"
                : "אין לידים משויכים אליך"
          }
          body={
            hasFilters
              ? "נסה להסיר חלק מהמסננים או לשנות את מילת החיפוש."
              : canSeeAll
                ? "הוסף את הליד הראשון או ייבא רשימה מקובץ CSV."
                : "לידים יופיעו כאן ברגע שמנהל ישייך אותם אליך."
          }
          action={
            !hasFilters &&
            canSeeAll && (
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
    /*
      העוטף הוא scrollport אמיתי, עם גובה מוגבל.
      `overflow-x-auto` לבדו כבר הפך אותו ל-scrollport בשני הצירים (לפי
      מפרט CSS, ציר אחד שאינו visible הופך גם את השני ל-auto) — אבל בלי
      הגבלת גובה הוא מעולם לא גלל, ולכן ה-thead ה"נדבק" פשוט נעלם עם
      הגלילה. הגבלת הגובה היא מה שמחזירה לו משמעות.
    */
    <div className="scroll-thin max-h-[calc(100dvh-var(--chrome-h,60px)-280px)] min-h-[240px] overflow-auto rounded-card border border-line bg-surface shadow-card">
      {/*
        הרוחב הטבעי של התוכן נמדד ב-986px רגיל ו-1062px במקרה הקיצון,
        ולכן 900 הוא רצפה שלא כופה גלילה אופקית על מסך 1280.
      */}
      <table className="w-full min-w-[900px] border-collapse text-sm">
        {/* נדבקת לראש מיכל הגלילה עצמו, ולא לסרגל העליון של הדף */}
        <thead className="sticky top-0 z-10 bg-surface-2">
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
            {shown.map((col) => (
              <th
                key={col.key}
                className="whitespace-nowrap px-3 py-2.5 text-start font-medium"
              >
                {col.sort ? (
                  <button
                    onClick={() => sortBy(col.sort!)}
                    className="inline-flex items-center gap-1 hover:text-ink-1"
                  >
                    {col.label}
                    {sort.field === col.sort && (
                      <Icon
                        name="chevronDown"
                        size={13}
                        className={sort.dir === "asc" ? "rotate-180" : ""}
                      />
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
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
              columns={shown}
              cost={leadCost(lead, leadCosts)}
              checked={selected.has(lead.id)}
              busy={busyIds.has(lead.id)}
              onToggle={() => toggleOne(lead.id)}
              onOpen={() => onOpen(lead.id)}
              onStatus={(to) => onStatus(lead.id, to)}
              onCost={(cost) => onCost(lead.id, cost)}
              onStar={(next) => onStar(lead.id, next)}
              onPatch={(patch) => onPatch(lead.id, patch)}
              users={users}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
