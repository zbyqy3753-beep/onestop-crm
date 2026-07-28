"use client";

import type { Lead, LeadStatus, User } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  LEAD_CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import { TONE_VAR, phone, relative, until } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { CostCell, RowActions, StarToggle, StatusPicker } from "./cells";
import { buildTimeline } from "./ActivityFeed";

/** שורה אחת בטבלת הלידים. */
export function LeadRow({
  lead,
  now,
  assignee,
  userById,
  cost,
  checked,
  busy,
  onToggle,
  onOpen,
  onStatus,
  onCost,
  onStar,
}: {
  lead: Lead;
  now: number | null;
  assignee?: User;
  /** למי שם הפעולות בציר הזמן שייך */
  userById: Map<string, User>;
  /** העלות האפקטיבית — פרטנית אם הוגדרה, אחרת של הקטגוריה */
  cost: number;
  checked: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (to: LeadStatus) => void;
  onCost: (cost: number | null) => void;
  onStar: (next: boolean) => void;
}) {
  const status = STATUS_CONFIG[lead.status];
  const priority = PRIORITY_CONFIG[lead.priority];

  /** הפירוט האחרון שהסוכן הזין — מה שהוא באמת צריך לראות לפני חיוג. */
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;

  const timeline = buildTimeline(lead, userById);

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
        <span className="flex items-center gap-1.5">
          <StarToggle lead={lead} onToggle={onStar} busy={busy} />
          <button onClick={onOpen} className="block max-w-[260px] text-start">
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
        </span>
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

      {/* עלות */}
      <td className="px-3 py-2.5">
        <CostCell lead={lead} effective={cost} onSave={onCost} busy={busy} />
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

      {/* פעילות — שתי הרשומות האחרונות, כדי לראות מה קרה בלי לפתוח */}
      <td className="px-3 py-2.5">
        {timeline.length === 0 ? (
          <span className="text-xs text-ink-4">—</span>
        ) : (
          <ul className="space-y-0.5">
            {timeline.slice(0, 2).map((entry) => (
              <li
                key={entry.id}
                className="max-w-[190px] truncate text-xs text-ink-3"
                title={entry.detail ? `${entry.title} — ${entry.detail}` : entry.title}
              >
                {entry.detail ?? entry.title}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={onOpen}
          className="mt-0.5 text-xs text-brand hover:underline"
        >
          + הערה
        </button>
      </td>

      {/* פעולות יצירת קשר. גלויות תמיד, לא מוסתרות מאחורי hover. */}
      <td className="pe-3">
        <RowActions lead={lead} onOpen={onOpen} />
      </td>
    </tr>
  );
}
