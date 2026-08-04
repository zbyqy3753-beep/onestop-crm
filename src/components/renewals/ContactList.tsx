"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { phone as formatPhone, relative, until } from "@/lib/format";
import { useNow } from "@/components/ui/primitives";
import {
  approveContactsAction,
  deleteContactAction,
  previewMessageAction,
} from "@/app/(app)/renewals/campaignActions";

/**
 * אנשי הקשר שחולצו ממסמכי החידוש.
 *
 * ⚠️ המסך הזה הוא **שער האישור** — הנקודה היחידה שבה אדם רואה מה
 * חולץ לפני שהודעה יוצאת ללקוח אמיתי. לכן: כלום לא נבחר מראש, יש
 * תצוגה מקדימה של הטקסט המדויק, וכפתור השליחה אומר כמה הודעות יֵצאו
 * ולא "אישור".
 */

export type ContactStatus =
  | "pending"
  | "queued"
  | "awaitingReply"
  | "needsReview"
  | "scheduled"
  | "declined"
  | "optedOut"
  | "noReply"
  | "failed";

export interface RenewalContactRow {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  provider: string | null;
  packageName: string | null;
  currentPrice: number | null;
  futurePrice: number | null;
  status: ContactStatus;
  agreedAt: string | null;
  leadId: string | null;
  sentAt: string | null;
  lastInboundText: string | null;
  lastInboundAt: string | null;
}

const STATUS_META: Record<
  ContactStatus,
  { label: string; tone: "neutral" | "info" | "active" | "warn" | "good" | "bad" }
> = {
  pending: { label: "ממתין לאישור", tone: "neutral" },
  queued: { label: "בתור לשליחה", tone: "info" },
  awaitingReply: { label: "ממתין לתשובה", tone: "active" },
  needsReview: { label: "ענה — דורש בדיקה", tone: "warn" },
  scheduled: { label: "נקבעה שיחה", tone: "good" },
  declined: { label: "סירב", tone: "neutral" },
  optedOut: { label: "ביקש הסרה", tone: "bad" },
  noReply: { label: "לא ענה", tone: "neutral" },
  failed: { label: "השליחה נכשלה", tone: "bad" },
};

export function ContactList({ rows }: { rows: RenewalContactRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pendingRows = rows.filter((r) => r.status === "pending");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = () => {
    setError(null);
    start(async () => {
      const res = await approveContactsAction([...selected]);
      if (res.ok) setSelected(new Set());
      else setError(res.error);
    });
  };

  if (rows.length === 0) return null;

  return (
    <section className="mt-6">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink-1">
          לקוחות שחולצו
          <span className="nums ms-2 text-sm font-normal text-ink-4">
            {rows.length}
          </span>
        </h2>

        {pendingRows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setSelected(
                  selected.size === pendingRows.length
                    ? new Set()
                    : new Set(pendingRows.map((r) => r.id)),
                )
              }
              className="text-xs text-ink-3 underline-offset-2 hover:underline"
            >
              {selected.size === pendingRows.length ? "בטל בחירה" : "בחר הכל"}
            </button>

            <Button
              variant="primary"
              className="h-9"
              disabled={pending || selected.size === 0}
              onClick={send}
            >
              שלח ל-{selected.size} לקוחות
            </Button>
          </div>
        )}
      </header>

      {/*
        ⚠️ האזהרה נשארת גם כשאין מה לשלוח. היא לא הוראת הפעלה אלא
        תזכורת שמה שקורה כאן יוצא לאנשים אמיתיים — בשונה מכל שאר
        המערכת, שנשארת בתוך הארגון.
      */}
      <p className="mb-3 rounded-card border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
        ההודעות האלה יוצאות <b>ללקוחות אמיתיים</b> מהמספר של הבוט. כל
        הודעה כוללת שורת הסרה, ותשובה &quot;הסר&quot; מכובדת מיידית.
      </p>

      {error && (
        <p className="mb-2 rounded-card border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
          {error}
        </p>
      )}

      {preview !== null && (
        <div className="mb-3 rounded-card border border-line bg-surface-2 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-2">
              ההודעה שתישלח
            </span>
            <button
              onClick={() => setPreview(null)}
              className="text-ink-4"
              aria-label="סגירת התצוגה"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
            {preview}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <Row
            key={r.id}
            row={r}
            checked={selected.has(r.id)}
            pending={pending}
            onToggle={() => toggle(r.id)}
            onPreview={() =>
              start(async () => {
                const res = await previewMessageAction(r.id);
                if (res.ok) setPreview(res.data?.body ?? "");
              })
            }
            onDelete={() =>
              start(async () => {
                const res = await deleteContactAction(r.id);
                if (!res.ok) setError(res.error);
              })
            }
          />
        ))}
      </ul>
    </section>
  );
}

function Row({
  row,
  checked,
  pending,
  onToggle,
  onPreview,
  onDelete,
}: {
  row: RenewalContactRow;
  checked: boolean;
  pending: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const now = useNow();
  const meta = STATUS_META[row.status];
  const selectable = row.status === "pending";

  const price =
    row.currentPrice !== null && row.futurePrice !== null
      ? `${row.currentPrice} ₪ → ${row.futurePrice} ₪`
      : null;

  return (
    <li className="rounded-card border border-line bg-surface px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        {selectable ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            disabled={pending}
            aria-label={`בחירת ${row.name}`}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          />
        ) : (
          <span className="mt-1 h-4 w-4 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-1">
            {row.name}
            <span className="ltr-num text-xs text-ink-4">
              {formatPhone(row.phone.replace(/^972/, "0"))}
            </span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </p>

          <p className="mt-0.5 text-xs text-ink-4">
            {[row.provider, row.packageName, row.city, price]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>

          {/* מה הלקוח ענה — הדבר הראשון שרוצים לראות בשורה שדורשת בדיקה */}
          {row.lastInboundText && (
            <p className="mt-1 rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink-2">
              <span className="text-ink-4">ענה: </span>
              {row.lastInboundText}
              {now !== null && row.lastInboundAt && (
                <span className="text-ink-4"> · {relative(row.lastInboundAt, now)}</span>
              )}
            </p>
          )}

          {row.agreedAt && now !== null && (
            <p className="mt-1 text-xs font-medium text-good">
              נקבעה שיחה {until(row.agreedAt, now)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          {row.status === "pending" && (
            <>
              <Button
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={pending}
                onClick={onPreview}
              >
                תצוגה
              </Button>
              <Button
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={pending}
                onClick={onDelete}
              >
                מחיקה
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
