"use client";

import type { Lead, LeadStatus, User } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  LEAD_CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/lib/domain/types";
import { TONE_VAR, phone, relative, until } from "@/lib/format";
import { Badge, Button, EmptyState, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { SortField } from "./LeadsClient";

const COLUMNS: { field: SortField; label: string; className?: string }[] = [
  { field: "name", label: "ליד" },
  { field: "status", label: "סטטוס" },
  { field: "priority", label: "עדיפות" },
  { field: "updatedAt", label: "פעילות אחרונה" },
];

export function LeadsTable({
  leads,
  userById,
  selected,
  onSelectedChange,
  sort,
  onSortChange,
  onOpen,
  onStatus,
  onAdd,
  hasFilters,
}: {
  leads: Lead[];
  userById: Map<string, User>;
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  sort: { field: SortField; dir: "asc" | "desc" };
  onSortChange: (s: { field: SortField; dir: "asc" | "desc" }) => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, to: LeadStatus) => void;
  onAdd: () => void;
  hasFilters: boolean;
}) {
  const now = useNow();

  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function toggleAll() {
    onSelectedChange(allChecked ? new Set() : new Set(leads.map((l) => l.id)));
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
      <table className="w-full min-w-[860px] border-collapse text-sm">
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
            <th className="px-3 py-2.5 text-start font-medium">משויך ל</th>
            <th className="w-20">
              <span className="sr-only">פעולות</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead) => (
            <Row
              key={lead.id}
              lead={lead}
              now={now}
              assignee={lead.assigneeId ? userById.get(lead.assigneeId) : undefined}
              checked={selected.has(lead.id)}
              onToggle={() => toggleOne(lead.id)}
              onOpen={() => onOpen(lead.id)}
              onStatus={(to) => onStatus(lead.id, to)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  lead,
  now,
  assignee,
  checked,
  onToggle,
  onOpen,
  onStatus,
}: {
  lead: Lead;
  now: number | null;
  assignee?: User;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (to: LeadStatus) => void;
}) {
  const status = STATUS_CONFIG[lead.status];
  const priority = PRIORITY_CONFIG[lead.priority];

  /** הפירוט האחרון שהסוכן הזין — מה שהוא באמת צריך לראות לפני חיוג. */
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;

  return (
    <tr
      className="spine group border-b border-line last:border-0 hover:bg-surface-2"
      style={
        {
          "--spine-c": TONE_VAR[status.tone],
          "--spine-w": lead.priority === "urgent" ? "5px" : "3px",
        } as React.CSSProperties
      }
    >
      <td className="ps-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`בחירת ${lead.name}`}
          className="accent-[var(--c-brand)]"
        />
      </td>

      {/* ליד */}
      <td className="px-3 py-3">
        <button onClick={onOpen} className="block max-w-[280px] text-start">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink-1 group-hover:text-brand">
              {lead.name}
            </span>
            {lead.kind === "hot" && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-bad"
                title="ליד חם"
                aria-label="ליד חם"
              />
            )}
          </span>
          <span className="ltr-num mt-0.5 block text-[13px] text-ink-3">
            {phone(lead.phone)}
          </span>
        </button>
      </td>

      {/* סטטוס */}
      <td className="px-3 py-2.5">
        <StatusPicker current={lead.status} onPick={onStatus} />
        {lastDetail && (
          <p
            className="mt-1 max-w-[220px] truncate text-xs text-ink-4"
            title={lastDetail}
          >
            {lastDetail}
          </p>
        )}
      </td>

      {/* עדיפות */}
      <td className="px-3 py-2.5">
        {lead.priority === "normal" ? (
          <span className="text-xs text-ink-4">—</span>
        ) : (
          <Badge tone={priority.tone}>{priority.label}</Badge>
        )}
      </td>

      {/* פעילות אחרונה */}
      <td className="px-3 py-2.5 text-xs text-ink-3">
        {/* ריק עד ההרכבה — "עכשיו" לא קיים בשרת */}
        {now === null ? (
          <span className="inline-block h-3.5 w-16" />
        ) : (
          <>
            <span>{relative(lead.updatedAt, now)}</span>
            {lead.followUpAt && (
              <span className="mt-0.5 flex items-center gap-1 text-warn">
                <Icon name="clock" size={12} />
                {until(lead.followUpAt, now)}
              </span>
            )}
          </>
        )}
      </td>

      {/* קטגוריה */}
      <td className="px-3 py-2.5 text-xs text-ink-2">
        {lead.category ? (
          LEAD_CATEGORY_CONFIG[lead.category].label
        ) : (
          <span className="text-ink-4">—</span>
        )}
        <span className="mt-0.5 block text-ink-4">
          {KIND_CONFIG[lead.kind].short}
        </span>
      </td>

      {/* משויך */}
      <td className="px-3 py-2.5">
        {assignee ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[9px] font-bold text-ink-2">
              {assignee.name.slice(0, 2)}
            </span>
            {assignee.name}
          </span>
        ) : (
          <span className="text-xs text-ink-4">ללא שיוך</span>
        )}
      </td>

      {/* הפעולה העיקרית — חיוג. גלויה תמיד, לא מוסתרת מאחורי hover. */}
      <td className="pe-3">
        <div className="flex items-center justify-end gap-0.5">
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-brand-soft hover:text-brand"
            aria-label={`חיוג ל${lead.name}`}
            title="חיוג"
          >
            <Icon name="phone" size={16} />
          </a>
          <button
            onClick={onOpen}
            className="rounded-lg p-2 text-ink-4 transition-colors hover:bg-surface-3 hover:text-ink-1"
            aria-label={`פתיחת ${lead.name}`}
            title="פתיחת הליד"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * שינוי סטטוס מתוך השורה, בלי לפתוח את הליד.
 * `<select>` מקורי — נגיש במקלדת ובמובייל בלי קוד נוסף.
 */
function StatusPicker({
  current,
  onPick,
}: {
  current: LeadStatus;
  onPick: (to: LeadStatus) => void;
}) {
  const meta = STATUS_CONFIG[current];

  return (
    <span className="relative inline-flex">
      <Badge tone={meta.tone} className="pe-4">
        {meta.label}
      </Badge>
      <Icon
        name="chevronDown"
        size={11}
        className="pointer-events-none absolute inset-y-0 end-1 my-auto opacity-50"
      />
      <select
        value={current}
        onChange={(e) => onPick(e.target.value as LeadStatus)}
        aria-label="שינוי סטטוס"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>
    </span>
  );
}
