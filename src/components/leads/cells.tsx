"use client";

import { useState } from "react";
import type { Lead, LeadStatus } from "@/lib/domain/types";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  whatsappGreeting,
} from "@/lib/domain/types";
import { money, waLink } from "@/lib/format";
import { Badge, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

/**
 * תאים שחוזרים בכל שורה בטבלת הלידים.
 *
 * הופרדו מ-`LeadsTable` כשמספר העמודות גדל — הקובץ ההוא צריך להישאר
 * "כותרת + מיפוי שורות" וכלום מעבר לזה.
 */

/**
 * שינוי סטטוס מתוך השורה, בלי לפתוח את הליד.
 * `<select>` מקורי — נגיש במקלדת ובמובייל בלי קוד נוסף.
 */
export function StatusPicker({
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

/**
 * עלות הליד, עם עריכה במקום.
 *
 * מציג `חינם` כשהעלות האפקטיבית 0 — זה מה שהופך "לא שילמנו על הליד"
 * למובחן מ"לא הזנו עלות". כשאין ערך פרטני מוצגת עלות הקטגוריה, בגוון
 * חלש יותר, כדי שיהיה ברור שזו ברירת מחדל ולא החלטה.
 */
export function CostCell({
  lead,
  effective,
  onSave,
  busy,
}: {
  lead: Lead;
  effective: number;
  onSave: (cost: number | null) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function open() {
    setDraft(lead.cost === undefined ? "" : String(lead.cost));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);

    if (next !== null && (!Number.isFinite(next) || next < 0)) return;
    // אין שינוי — לא שולחים בקשה סתם
    if (next === (lead.cost ?? null)) return;

    onSave(next);
  }

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        step="0.5"
        autoFocus
        value={draft}
        placeholder="ברירת מחדל"
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`עלות של ${lead.name}`}
        className={`${inputClass} nums h-8 w-24 py-0 text-xs`}
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
      title="לחץ לעריכת עלות"
      aria-label={`עריכת עלות של ${lead.name}`}
      className={`nums rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-surface-3 ${
        lead.cost === undefined ? "text-ink-4" : "text-ink-1"
      }`}
    >
      {effective === 0 ? "חינם" : money(effective)}
    </button>
  );
}

/** סימון ליד לטיפול. */
export function StarToggle({
  lead,
  onToggle,
  busy,
}: {
  lead: Lead;
  onToggle: (next: boolean) => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!lead.isStarred);
      }}
      disabled={busy}
      aria-pressed={lead.isStarred}
      aria-label={lead.isStarred ? `הסרת הסימון מ${lead.name}` : `סימון ${lead.name}`}
      title={lead.isStarred ? "הסרת סימון" : "סימון ליד"}
      className={`shrink-0 rounded p-0.5 transition-colors ${
        lead.isStarred
          ? "text-warn"
          : "text-ink-4 opacity-0 hover:text-ink-2 focus-visible:opacity-100 group-hover:opacity-100"
      }`}
    >
      <Icon
        name="star"
        size={14}
        fill={lead.isStarred ? "currentColor" : "none"}
      />
    </button>
  );
}

/**
 * דרכי יצירת הקשר עם הליד, ישירות מהשורה.
 *
 * וואטסאפ נפתח בלשונית חדשה עם הודעת פתיחה מוכנה; המייל מופיע רק
 * כשיש כתובת — כפתור מושבת לצמיתות היה רק רעש.
 */
export function RowActions({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex items-center justify-end gap-0.5">
      <a
        href={`tel:${lead.phone}`}
        onClick={stop}
        className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-brand-soft hover:text-brand"
        aria-label={`חיוג ל${lead.name}`}
        title="חיוג"
      >
        <Icon name="phone" size={16} />
      </a>

      <a
        href={waLink(lead.phone, whatsappGreeting(lead.name))}
        onClick={stop}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-good-soft hover:text-good"
        aria-label={`וואטסאפ ל${lead.name}`}
        title="וואטסאפ"
      >
        <Icon name="whatsapp" size={16} />
      </a>

      {lead.email && (
        <a
          href={`mailto:${lead.email}`}
          onClick={stop}
          className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-info-soft hover:text-info"
          aria-label={`מייל ל${lead.name}`}
          title="מייל"
        >
          <Icon name="mail" size={16} />
        </a>
      )}

      <button
        onClick={onOpen}
        className="rounded-lg p-2 text-ink-4 transition-colors hover:bg-surface-3 hover:text-ink-1"
        aria-label={`פתיחת ${lead.name}`}
        title="פתיחת הליד"
      >
        <Icon name="chevronLeft" size={16} />
      </button>
    </div>
  );
}
