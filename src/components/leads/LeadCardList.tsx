"use client";

import { useState } from "react";
import type { Lead, LeadStatus, User } from "@/lib/domain/types";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
import type { LeadPatch } from "@/app/(app)/leads/actions";
import { Button, EmptyState, inputClass, useNow } from "@/components/ui/primitives";
import { LeadCard } from "./LeadCard";

/**
 * תצוגת הלידים בטלפון — רשימת כרטיסים במקום טבלה.
 *
 * ⚠️ אין כאן `overflow` ואין `max-h`. הטבלה עוטפת את עצמה בגובה קבוע
 * כדי שכותרת ה-`<thead>` הדביקה תהיה למה להידבק, ובטלפון זה יצר שלושה
 * צירי גלילה מקוננים שנאבקים על אותה החלקה: העמוד, הגובה הפנימי,
 * והרוחב. לרשימת כרטיסים אין כותרת, ולכן היא זורמת בעמוד — ציר אחד.
 */
export function LeadCardList({
  leads,
  users,
  selected,
  onSelectedChange,
  busy,
  onOpen,
  onStatus,
  onStar,
  onPatch,
  onAdd,
  hasFilters,
  onBulkAssign,
  onBulkStatus,
  onBulkDelete,
}: {
  leads: Lead[];
  users: User[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  busy: boolean;
  onOpen: (id: string) => void;
  onStatus: (id: string, to: LeadStatus) => void;
  onStar: (id: string, next: boolean) => void;
  onPatch: (id: string, patch: LeadPatch) => void;
  onAdd: () => void;
  hasFilters: boolean;
  onBulkAssign: (assigneeId: string | null) => void;
  onBulkStatus: (to: LeadStatus) => void;
  onBulkDelete: () => void;
}) {
  const now = useNow();

  /*
   * מצב הבחירה הוא מפורש ומופעל בכפתור — לא בלחיצה ארוכה.
   *
   * לחיצה ארוכה מתנגשת בבחירת הטקסט ובתפריט ההקשר של iOS, ובעיקר
   * אי אפשר לגלות אותה: אין שום דבר על המסך שמרמז שהיא קיימת.
   *
   * כשהמצב כבוי הכרטיס לא נושא צ׳קבוקס בכלל — זה חוסך 44px מתוך 358
   * שיש, בדיוק במקום שבו נמצא השם.
   */
  const [selecting, setSelecting] = useState(false);

  function exitSelection() {
    setSelecting(false);
    onSelectedChange(new Set());
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
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

  const allChecked = leads.every((l) => selected.has(l.id));

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          variant={selecting ? "primary" : "ghost"}
          onClick={() => (selecting ? exitSelection() : setSelecting(true))}
          className="h-9"
        >
          {selecting ? "סיום בחירה" : "בחירה"}
        </Button>

        {selecting && (
          <Button
            variant="ghost"
            onClick={() =>
              onSelectedChange(
                allChecked ? new Set() : new Set(leads.map((l) => l.id)),
              )
            }
            className="h-9"
          >
            {allChecked ? "נקה הכל" : `בחר הכל (${leads.length})`}
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            now={now}
            checked={selected.has(lead.id)}
            selecting={selecting}
            busy={busy}
            onToggle={() => toggle(lead.id)}
            onOpen={() => onOpen(lead.id)}
            onStatus={(to) => onStatus(lead.id, to)}
            onStar={(next) => onStar(lead.id, next)}
            onPatch={(patch) => onPatch(lead.id, patch)}
          />
        ))}
      </ul>

      {/*
        סרגל הפעולות דביק לתחתית ולא לראש: בטלפון האגודל נמצא שם, וגם
        אין תחרות עם סרגל הכתובת שנפתח ונסגר בגלילה.
        `pb-[env(safe-area-inset-bottom)]` כדי שהוא לא ייחתך מתחת לפס
        הבית באייפון.
      */}
      {selecting && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-2 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-brand">
              {selected.size} נבחרו
            </span>
            <Button variant="ghost" onClick={exitSelection} className="h-9">
              ביטול
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className={`${inputClass} h-10 w-auto flex-1`}
              defaultValue=""
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onBulkAssign(v === "unassigned" ? null : v);
                e.target.value = "";
              }}
            >
              <option value="">שיוך לעובד…</option>
              <option value="unassigned">הסרת שיוך</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <select
              className={`${inputClass} h-10 w-auto flex-1`}
              defaultValue=""
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value as LeadStatus;
                if (v) onBulkStatus(v);
                e.target.value = "";
              }}
            >
              <option value="">סטטוס…</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>

            <Button
              variant="ghost"
              icon="trash"
              onClick={onBulkDelete}
              disabled={busy}
              className="h-10"
            >
              מחיקה
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
