"use client";

import { useEffect, useState, useTransition } from "react";
import type { Lead, LeadStatus, User } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  LEAD_CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  PROVIDER_CONFIG,
  SOURCE_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
  whatsappGreeting,
} from "@/lib/domain/types";
import { addNoteAction } from "@/app/(app)/leads/actions";
import { dateTime, phone, relative, waLink } from "@/lib/format";
import { Badge, Button, inputClass, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { ActivityFeed } from "./ActivityFeed";

/**
 * מגירת הליד — כל מה שצריך לפני חיוג, במסך אחד.
 *
 * הסדר מכוון: קודם איך יוצרים קשר, אחר כך מה קרה עד עכשיו,
 * ורק בסוף פרטי המנהלה.
 */
export function LeadDrawer({
  lead,
  users,
  userById,
  onClose,
  onStatus,
  onAssign,
  onEdit,
  onDelete,
  onNotify,
  busy,
}: {
  lead: Lead | null;
  users: User[];
  userById: Map<string, User>;
  onClose: () => void;
  onStatus: (to: LeadStatus) => void;
  onAssign: (assigneeId: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onNotify: (message: string, tone?: "good" | "bad") => void;
  busy: boolean;
}) {
  const now = useNow();
  // מתאפסים כשנפתח ליד אחר, דרך ה-key שההורה נותן
  const [note, setNote] = useState("");
  const [savingNote, startNote] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!lead) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  if (!lead) return null;

  const status = STATUS_CONFIG[lead.status];
  const assignee = lead.assigneeId ? userById.get(lead.assigneeId) : undefined;

  function saveNote() {
    const text = note.trim();
    if (!text || !lead) return;

    startNote(async () => {
      const res = await addNoteAction(lead.id, text);
      if (!res.ok) return onNotify(res.error, "bad");
      setNote("");
      onNotify("ההערה נוספה");
    });
  }

  return (
    <>
      <button
        className="fixed inset-0 z-40 bg-ink-1/40"
        onClick={onClose}
        aria-label="סגירה"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`פרטי הליד ${lead.name}`}
        className="animate-rise fixed inset-y-0 start-0 z-50 flex w-full max-w-md flex-col border-e border-line bg-surface shadow-pop"
      >
        {/* כותרת */}
        <header className="shrink-0 border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold leading-tight">
                {lead.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={status.tone}>{status.label}</Badge>
                <Badge tone={KIND_CONFIG[lead.kind].tone}>
                  {KIND_CONFIG[lead.kind].label}
                </Badge>
                {lead.priority !== "normal" && (
                  <Badge tone={PRIORITY_CONFIG[lead.priority].tone}>
                    {PRIORITY_CONFIG[lead.priority].label}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded-md px-2 py-1.5 text-xs text-ink-3 hover:bg-surface-3 hover:text-ink-1"
                aria-label={`עריכת ${lead.name}`}
              >
                עריכה
              </button>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink-1"
                aria-label="סגירה"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* פעולות קשר — הדבר הראשון שסוכן צריך */}
          <div className="mt-3 flex gap-2">
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
            >
              <Icon name="phone" size={16} />
              <span className="ltr-num">{phone(lead.phone)}</span>
            </a>
            <a
              href={waLink(lead.phone, whatsappGreeting(lead.name))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-sm hover:bg-good-soft hover:text-good"
              title="וואטסאפ"
              aria-label={`וואטסאפ ל${lead.name}`}
            >
              <Icon name="whatsapp" size={16} />
            </a>
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-sm hover:bg-surface-2"
                title={lead.email}
              >
                <Icon name="mail" size={16} />
              </a>
            )}
          </div>
        </header>

        {/* גוף */}
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
          {/* בקרות */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-2">
                סטטוס
              </span>
              <select
                value={lead.status}
                onChange={(e) => onStatus(e.target.value as LeadStatus)}
                disabled={busy}
                className={inputClass}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-2">
                משויך ל
              </span>
              <select
                value={lead.assigneeId ?? ""}
                onChange={(e) => onAssign(e.target.value || null)}
                disabled={busy}
                className={inputClass}
              >
                <option value="">ללא שיוך</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* פרטים */}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
            <Detail label="קטגוריה">
              {lead.category ? LEAD_CATEGORY_CONFIG[lead.category].label : "—"}
            </Detail>
            <Detail label="ספק נוכחי">
              {lead.currentProvider
                ? PROVIDER_CONFIG[lead.currentProvider].label
                : "—"}
            </Detail>
            <Detail label="עיר">{lead.city ?? "—"}</Detail>
            <Detail label="מקור">{SOURCE_CONFIG[lead.source].label}</Detail>
            <Detail label="נוצר">{dateTime(lead.createdAt)}</Detail>
            <Detail label="עודכן">
              {now === null ? "—" : relative(lead.updatedAt, now)}
            </Detail>
            {assignee && <Detail label="סוכן מטפל">{assignee.name}</Detail>}
            {lead.followUpAt && (
              <Detail label="חזרה מתוכננת">{dateTime(lead.followUpAt)}</Detail>
            )}
          </dl>

          {/* ציר הזמן — סטטוסים, פעולות והערות במיזוג אחד */}
          <section className="mt-5 border-t border-line pt-4">
            <h3 className="mb-3 text-xs font-semibold text-ink-2">פעילות</h3>
            <ActivityFeed lead={lead} userById={userById} />
          </section>

          <section className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2.5 text-xs font-semibold text-ink-2">
              הוספת הערה
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="הוסף הערה…"
              rows={2}
              className={`${inputClass} resize-y`}
            />
            <Button
              onClick={saveNote}
              disabled={savingNote || !note.trim()}
              className="mt-2"
            >
              {savingNote ? "שומר…" : "הוספת הערה"}
            </Button>
          </section>
        </div>

        {/* תחתית */}
        <footer className="shrink-0 border-t border-line px-5 py-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-2">למחוק את הליד?</span>
              <Button variant="danger" onClick={onDelete} disabled={busy}>
                כן, מחק
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                ביטול
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              icon="trash"
              onClick={() => setConfirmDelete(true)}
              className="text-bad hover:bg-bad-soft"
            >
              מחיקת הליד
            </Button>
          )}
        </footer>
      </aside>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-4">{label}</dt>
      <dd className="mt-0.5 text-ink-1">{children}</dd>
    </div>
  );
}
