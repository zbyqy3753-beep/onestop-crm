"use client";

import { useEffect, useState, useTransition } from "react";
import type { Lead, LeadStatus, UserRef } from "@/lib/domain/types";
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
import { dateTime, money, phone, relative, waLink } from "@/lib/format";
import { dateTimeInputValue } from "@/lib/tz";
import { useBodyScrollLock } from "@/lib/overlay";
import { Badge, Button, inputClass, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { ActivityFeed } from "./ActivityFeed";
import { CostCell, FollowUpCell } from "./cells";

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
  onPatchFollowUp,
  onCost,
  effectiveCost,
  onEdit,
  onDelete,
  onNotify,
  busy,
  canSeeAll,
}: {
  lead: Lead | null;
  users: UserRef[];
  userById: Map<string, UserRef>;
  onClose: () => void;
  onStatus: (to: LeadStatus) => void;
  onAssign: (assigneeId: string | null) => void;
  /** קביעה/ניקוי של תאריך החזרה ישירות מהמגירה. `null` = ניקוי. */
  onPatchFollowUp?: (date: string | null) => void;
  /**
   * עדכון עלות הליד. `null` מחזיר לברירת המחדל של הקטגוריה.
   *
   * ⚠️ בלי זה עריכת העלות לא הייתה קיימת בטלפון **בכלל**: היא חיה רק
   * ב-`CostCell` שבשורת הטבלה, והטבלה לא נטענת מתחת ל-1024px
   * (`useIsNarrow`). המגירה הציגה את העלות לקריאה בלבד, ול-`EditLeadModal`
   * אין שדה עלות — כלומר מנהל בטלפון לא יכול היה לתקן עלות של ליד בודד
   * בשום מסלול. ההרשאה נאכפת בשרת ב-`setLeadCostAction`.
   */
  onCost?: (cost: number | null) => void;
  /** העלות בפועל — פרטנית אם הוגדרה, אחרת של הקטגוריה. `leadCost()` */
  effectiveCost?: number;
  onEdit: () => void;
  onDelete: () => void;
  onNotify: (message: string, tone?: "good" | "bad") => void;
  busy: boolean;
  /** מקור הליד הוא נתון ניהולי — ראה `columns.ts` */
  canSeeAll: boolean;
}) {
  const now = useNow();
  // מתאפסים כשנפתח ליד אחר, דרך ה-key שההורה נותן
  const [note, setNote] = useState("");
  const [savingNote, startNote] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // המגירה היא גיליון מסך-מלא ב-390px. בלי הנעילה, החלקה שעברה את סוף
  // הגוף שלה ממשיכה לגלול את תור הלידים שמאחוריה.
  useBodyScrollLock(Boolean(lead));

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

            {/* שני יעדי המגע היחידים בראש גיליון מסך-מלא — מורחבים
                ל-44px דרך `after:-inset-*`, בלי לשנות את הפריסה */}
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="relative rounded-md px-2 py-1.5 text-xs text-ink-3 after:absolute after:-inset-2 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95"
                aria-label={`עריכת ${lead.name}`}
              >
                עריכה
              </button>
              <button
                onClick={onClose}
                className="relative rounded-md p-1.5 text-ink-3 after:absolute after:-inset-2.5 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95"
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
        <div className="scroll-thin flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          {/*
            ⚠️ עמודה אחת בבסיס. `grid-cols-2` ללא תנאי נתן ~140px לערך
            בטלפון של 360px, ומחרוזות כמו "ברירת מחדל לפי קטגוריה" או
            תאריך מלא נשברו לשלוש שורות — כלומר שתי העמודות תפסו יותר
            גובה ממה שעמודה אחת קריאה הייתה תופסת.
          */}
          <dl className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
            <Detail label="קטגוריה">
              {lead.category ? (
                <Badge tone={LEAD_CATEGORY_CONFIG[lead.category].tone}>
                  {LEAD_CATEGORY_CONFIG[lead.category].label}
                </Badge>
              ) : (
                "—"
              )}
            </Detail>
            <Detail label="ספק נוכחי">
              {lead.currentProvider
                ? PROVIDER_CONFIG[lead.currentProvider].label
                : "—"}
            </Detail>
            <Detail label="עיר">{lead.city ?? "—"}</Detail>
            <Detail label="חבילה">{lead.packageName?.trim() || "—"}</Detail>
            {/* הערוץ כתגית והפירוט לצדו — ראה `SOURCE_CONFIG`: קודם
                הפירוט הסתיר את הערוץ, ולכן מאיפה הליד הגיע לא הופיע */}
            {canSeeAll && (
              <Detail label="מקור">
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={SOURCE_CONFIG[lead.source].tone}>
                    {SOURCE_CONFIG[lead.source].label}
                  </Badge>
                  {/* `break-words` — פירוט מקור ארוך בלי רווחים גלש מהמגירה */}
                  {lead.sourceDetail?.trim() && (
                    <span className="break-words">{lead.sourceDetail.trim()}</span>
                  )}
                </span>
              </Detail>
            )}
            {/* האימייל כטקסט ולא רק כאייקון — tooltip לא קיים במגע */}
            <Detail label="אימייל">
              {lead.email ? (
                <span className="ltr-num break-all">{lead.email}</span>
              ) : (
                "—"
              )}
            </Detail>
            {/*
              אותו `CostCell` של שורת הטבלה, ולא מימוש שני — כך "לחיצה
              על העלות פותחת עריכה" מתנהג זהה בשני המקומות, וההבחנה בין
              `undefined` (ברירת מחדל) ל-`0` (הליד היה חינם) נשמרת
              במקום אחד. בלי `onCost` הוא חוזר להיות טקסט קריא-בלבד.
            */}
            <Detail label="עלות ליד">
              {onCost ? (
                <CostCell
                  lead={lead}
                  effective={effectiveCost ?? lead.cost ?? 0}
                  onSave={onCost}
                  busy={busy}
                />
              ) : lead.cost === undefined ? (
                "ברירת מחדל לפי קטגוריה"
              ) : lead.cost === 0 ? (
                "חינם"
              ) : (
                money(lead.cost)
              )}
            </Detail>
            <Detail label="נוצר">{dateTime(lead.createdAt)}</Detail>
            <Detail label="עודכן">
              {now === null ? "—" : relative(lead.updatedAt, now)}
            </Detail>
            {/* היה עד כה בלתי נראה בכל המערכת, למרות שהוא נכתב בכל שינוי סטטוס */}
            <Detail label="קשר אחרון">
              {lead.lastContactAt ? dateTime(lead.lastContactAt) : "—"}
            </Detail>
            {/*
              עד כה זה היה טקסט קריא-בלבד — הדרך היחידה לקבוע חזרה
              מהמגירה הייתה לצאת ממנה ולערוך מהשורה. אותו FollowUpCell
              של הטבלה והכרטיס, כדי שהתנהגות העריכה תישאר אחת.
            */}
            <Detail label="חזרה מתוכננת">
              <FollowUpCell
                value={
                  lead.followUpAt
                    ? dateTimeInputValue(Date.parse(lead.followUpAt))
                    : ""
                }
                busy={busy}
                onPick={(v) => onPatchFollowUp?.(v || null)}
              >
                {lead.followUpAt ? (
                  dateTime(lead.followUpAt)
                ) : (
                  <span className="text-ink-4">קבע חזרה</span>
                )}
              </FollowUpCell>
            </Detail>
            {assignee && <Detail label="סוכן מטפל">{assignee.name}</Detail>}
          </dl>

          {/*
            תיבת ההערה מעל ציר הזמן ולא מתחתיו. הציר לא חסום באורך, ולכן
            ליד עם 30 אירועים היה קובר את הפעולה הנפוצה ביותר במגירה
            מתחת ל-2000 פיקסלים של גלילה.
          */}
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

          {/* ציר הזמן — סטטוסים, פעולות והערות במיזוג אחד */}
          <section className="mt-5 border-t border-line pt-4">
            <h3 className="mb-3 text-xs font-semibold text-ink-2">פעילות</h3>
            <ActivityFeed lead={lead} userById={userById} />
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
