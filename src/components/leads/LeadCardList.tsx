"use client";

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
  busyIds,
  onOpen,
  onStatus,
  onStar,
  onPatch,
  onAdd,
  hasFilters,
  onClearFilters,
  onBulkAssign,
  onBulkStatus,
  onBulkDelete,
  selecting,
  onSelectingChange,
}: {
  leads: Lead[];
  users: User[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  /** הלידים שיש להם כתיבה בטיסה — רק הכרטיסים שלהם ננעלים, לא כל הרשימה */
  busyIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
  onStatus: (id: string, to: LeadStatus) => void;
  onStar: (id: string, next: boolean) => void;
  onPatch: (id: string, patch: LeadPatch) => void;
  onAdd: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  onBulkAssign: (assigneeId: string | null) => void;
  onBulkStatus: (to: LeadStatus) => void;
  onBulkDelete: () => void;
  /*
   * מצב הבחירה הוא מפורש ומופעל בכפתור — לא בלחיצה ארוכה. לחיצה
   * ארוכה מתנגשת בבחירת טקסט ובתפריט ההקשר של iOS, ובעיקר אי אפשר
   * לגלות אותה.
   *
   * ⚠️ הוא **נשלט מבחוץ** ולא מצב פנימי: הכפתור שמפעיל אותו עבר
   * לגיליון ה-`⋯`, כי שורה שלמה של 36px בראש כל מסך עבור פעולה
   * שנעשית מדי פעם היא בדיוק סוג הדבר שדחק את הליד הראשון ל-49%
   * מגובה המסך.
   */
  selecting: boolean;
  onSelectingChange: (v: boolean) => void;
}) {
  const now = useNow();

  function exitSelection() {
    onSelectingChange(false);
    onSelectedChange(new Set());
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));

  // פקדי הסרגל הם פעולות **קבוצתיות** — הם ננעלים כשיש כתיבה כלשהי
  // בטיסה, בשונה מהכרטיסים שכל אחד ננעל רק על הליד שלו
  const bulkBusy = busyIds.size > 0;

  return (
    <>
      {/*
        מצב ריק מרונדר בתוך ה-fragment ולא ב-return מוקדם: אם המשתמש
        נכנס למצב בחירה ואז חיפש משהו בלי תוצאות, return מוקדם היה
        מעלים גם את סרגל הבחירה עם כפתור "סיום" — ובלי FAB (שמוסתר
        בזמן בחירה) לא נשארת שום דרך לצאת מהמצב.
      */}
      {leads.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            title={hasFilters ? "אין לידים שתואמים לסינון" : "אין לידים עדיין"}
            body={
              hasFilters
                ? "נסה להסיר חלק מהמסננים או לשנות את מילת החיפוש."
                : "הוסף את הליד הראשון או ייבא רשימה מקובץ CSV."
            }
            action={
              hasFilters ? (
                <Button onClick={onClearFilters}>ניקוי מסננים</Button>
              ) : (
                <Button variant="primary" icon="plus" onClick={onAdd}>
                  ליד חדש
                </Button>
              )
            }
          />
        </div>
      ) : (
        /* מרווח בתחתית כדי שסרגל הפעולות הקבוע + ניווט התחתית לא יכסו את הכרטיס האחרון */
        <ul className={`flex flex-col gap-2 ${selecting ? "pb-56" : ""}`}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              now={now}
              checked={selected.has(lead.id)}
              selecting={selecting}
              busy={busyIds.has(lead.id)}
              onToggle={() => toggle(lead.id)}
              onOpen={() => onOpen(lead.id)}
              onStatus={(to) => onStatus(lead.id, to)}
              onStar={(next) => onStar(lead.id, next)}
              onPatch={(patch) => onPatch(lead.id, patch)}
            />
          ))}
        </ul>
      )}

      {/*
        סרגל הפעולות דביק לתחתית ולא לראש: בטלפון האגודל נמצא שם, וגם
        אין תחרות עם סרגל הכתובת שנפתח ונסגר בגלילה.

        ⚠️ הוא יושב **מעל** ניווט התחתית ולא ב-`bottom-0`: ה-BottomNav
        של המעטפת גם הוא `fixed bottom-0 z-40` אטום ומרונדר אחרי הרכיב
        הזה ב-DOM, כך שהוא היה מכסה בדיוק את שורת השיוך/סטטוס/מחיקה.
        ההיסט הוא גובה הניווט (3.5rem) + ה-safe-area, והניווט שמתחת הוא
        זה שסופג את ה-safe-area — לכן כאן רק ריפוד רגיל.
      */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-surface-2 px-3 pb-2 pt-2 shadow-card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brand">
              {selected.size} נבחרו
            </span>
            {/* "בחר הכל" חי כאן ולא בשורה נפרדת בראש המסך — הוא רלוונטי
                רק בזמן בחירה, ובזמן בחירה הסרגל הזה ממילא על המסך */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                disabled={leads.length === 0}
                onClick={() =>
                  onSelectedChange(
                    allChecked ? new Set() : new Set(leads.map((l) => l.id)),
                  )
                }
                className="h-9"
              >
                {allChecked ? "נקה הכל" : `בחר הכל (${leads.length})`}
              </Button>
              <Button variant="ghost" onClick={exitSelection} className="h-9">
                סיום
              </Button>
            </div>
          </div>

          <div
            className={`flex flex-wrap gap-2 ${selected.size === 0 ? "pointer-events-none opacity-40" : ""}`}
          >
            <select
              className={`${inputClass} h-10 w-auto flex-1`}
              defaultValue=""
              disabled={bulkBusy}
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
              disabled={bulkBusy}
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
              disabled={bulkBusy}
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
