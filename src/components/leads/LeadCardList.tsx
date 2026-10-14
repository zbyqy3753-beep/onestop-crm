"use client";

import { Fragment, useEffect, useRef } from "react";
import type { Lead, LeadStatus, UserRef } from "@/lib/domain/types";
import { PICKABLE_STATUSES, STATUS_CONFIG } from "@/lib/domain/types";
import type { LeadPatch } from "@/app/(app)/leads/actions";
import { Badge, Button, EmptyState, inputClass, useNow } from "@/components/ui/primitives";
import { LeadCard } from "./LeadCard";
import { QUEUE_TIER_META, type QueueTiers } from "./queue";
import { number } from "@/lib/format";

/**
 * תצוגת הכרטיסים — בטלפון תמיד, ומאוקטובר 2026 ברירת המחדל גם בשולחן
 * (עם מעבר לטבלה ב-`LeadsClient`).
 *
 * ⚠️ אין כאן `overflow` ואין `max-h`. הטבלה עוטפת את עצמה בגובה קבוע
 * כדי שכותרת ה-`<thead>` הדביקה תהיה למה להידבק, ובטלפון זה יצר שלושה
 * צירי גלילה מקוננים שנאבקים על אותה החלקה: העמוד, הגובה הפנימי,
 * והרוחב. לרשימת כרטיסים אין כותרת, ולכן היא זורמת בעמוד — ציר אחד.
 */
export function LeadCardList({
  leads,
  tiers,
  users,
  selected,
  onSelectedChange,
  busyIds,
  onOpen,
  onStatus,
  onQuickStatus,
  onStar,
  onPatch,
  onAdd,
  hasFilters,
  onClearFilters,
  canSeeAll,
  canSeeTeam = false,
  onBulkAssign,
  onBulkStatus,
  onBulkDelete,
  selecting,
  onSelectingChange,
}: {
  leads: Lead[];
  /**
   * שכבות התור — הכותרות המפרידות. `null` = בלי כותרות. ראה
   * `LeadsClient` › `queueTiers`.
   *
   * ⚠️ בטלפון זה **הפקד היחיד** שמסביר את הסדר: אין כותרות עמודה,
   * ובורר המיין נפתח כ-`<select>` שאיש לא פותח סתם. רשימת כרטיסים
   * שממוינת "נכון" בלי כותרות היא רשימה שנראית אקראית.
   */
  tiers: QueueTiers | null;
  users: UserRef[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  /** הלידים שיש להם כתיבה בטיסה — רק הכרטיסים שלהם ננעלים, לא כל הרשימה */
  busyIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
  onStatus: (id: string, to: LeadStatus) => void;
  /** סטטוס בנגיעה אחת מהכרטיס — מדלג על הדיאלוג כשאין שאלה חובה */
  onQuickStatus: (id: string, to: LeadStatus) => void;
  onStar: (id: string, next: boolean) => void;
  onPatch: (id: string, patch: LeadPatch) => void;
  onAdd: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  /** רואה את כל הארגון — קובע גם את שם המשויך על הכרטיס וגם את המצב הריק */
  canSeeAll: boolean;
  /** בעל עסק — רואה את שם המטפל מהצוות שלו על הכרטיס */
  canSeeTeam?: boolean;
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

  const userById = new Map(users.map((u) => [u.id, u]));

  // פקדי הסרגל הם פעולות **קבוצתיות** — הם ננעלים כשיש כתיבה כלשהי
  // בטיסה, בשונה מהכרטיסים שכל אחד ננעל רק על הליד שלו
  const bulkBusy = busyIds.size > 0;

  /*
   * מפרסם את גובה סרגל הפעולות כ-`--action-bar-h` על `<html>`.
   *
   * ⚠️ זה מה שמרחיק את הטוסטים מהסרגל. סדר השכבות לבדו לא פתר את זה:
   * הטוסט אמנם ב-`z-[70]` מעל הסרגל ב-`z-40`, אבל שניהם מעוגנים לאותה
   * פינה תחתונה, ולכן כל הודעת "N לידים עודכנו" נחתה בדיוק על מונה
   * הנבחרים ועל בורר השיוך — למשך 3.2 שניות, בדיוק כשמנסים לבחור את
   * הפעולה הבאה.
   *
   * הגובה נמדד ולא נכתב כקבוע, כי הסרגל הוא `flex-wrap` ומשתנה בגובהו
   * לפי רוחב המסך ואורך שמות העובדים.
   */
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty("--action-bar-h");
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty(
        "--action-bar-h",
        `${Math.round(entry.contentRect.height)}px`,
      );
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--action-bar-h");
    };
  }, [selecting]);

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
          {/*
            שלושה מצבים ריקים ולא שניים. עובד שרואה רק את הלידים שלו
            וטרם שויך לו דבר קיבל "אין לידים עדיין / ייבא מקובץ CSV" —
            אמירה שגויה (במערכת יש לידים) והצעה שאין לו הרשאה לבצע.
          */}
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
              hasFilters ? (
                <Button onClick={onClearFilters}>ניקוי מסננים</Button>
              ) : canSeeAll ? (
                <Button variant="primary" icon="plus" onClick={onAdd}>
                  ליד חדש
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        /*
          מרווח בתחתית כדי שסרגל הפעולות הקבוע + ניווט התחתית לא יכסו את
          הכרטיס האחרון.

          ⚠️ `pb-20` גם **מחוץ** למצב בחירה. קודם היה כאן ריפוד רק בזמן
          בחירה, ולכן במצב הרגיל — המצב שבו נמצאים כל הזמן — כפתור ה-+
          הצף (`LeadsClient`, `size-14` ב-`bottom-[3.5rem+safe+0.75rem]`)
          ישב על שורת הפעולות של הכרטיס האחרון ובלע לחיצות על "טען עוד".
          ריפוד ה-`<main>` ב-`AppShell` מפנה מקום לניווט התחתון בלבד ולא
          יודע דבר על ה-FAB. 3.5rem (ניווט) + 0.75rem (מרווח) + 3.5rem
          (הכפתור) ≈ 7.75rem, ו-`pb-20` נותן 5rem מעבר לריפוד הקיים.

          `lg:` — בשולחן אין ניווט תחתון ואין FAB, והסרגל דביק בזרימה
          (ראה למטה) ולכן תופס את המקום של עצמו.

          `gap-3` — 12px בין כרטיסים, האוויר של DC. רשימה אחת ברוחב מלא
          גם בשולחן, לא רשת עמודות: הכרטיס עצמו נפתח לשלושה אזורים
          (`@container` ב-`LeadCard`), ושתי עמודות כרטיסים היו שוברות את
          סדר התור — העין קוראת שורה-שורה, לא עמודה-עמודה.
        */
        <ul
          className={`flex flex-col gap-3 ${selecting ? "pb-56 lg:pb-0" : "pb-20 lg:pb-0"}`}
        >
          {leads.map((lead, i) => {
            // כותרת רק כשהשכבה משתנה — ראה `LeadsTable`, אותו כלל
            const tier = tiers?.of(lead);
            const opens =
              tier !== undefined && (i === 0 || tiers!.of(leads[i - 1]) !== tier);
            const assignee = lead.assigneeId
              ? userById.get(lead.assigneeId)
              : undefined;

            return (
              <Fragment key={lead.id}>
                {opens && <QueueTierHeading tier={tier!} tiers={tiers!} />}
                <LeadCard
                  lead={lead}
                  now={now}
                  checked={selected.has(lead.id)}
                  selecting={selecting}
                  busy={busyIds.has(lead.id)}
                  onToggle={() => toggle(lead.id)}
                  onOpen={() => onOpen(lead.id)}
                  onStatus={(to) => onStatus(lead.id, to)}
                  onQuickStatus={(to) => onQuickStatus(lead.id, to)}
                  onStar={(next) => onStar(lead.id, next)}
                  onPatch={(patch) => onPatch(lead.id, patch)}
                  canSeeAll={canSeeAll}
                  showAssignee={canSeeAll || canSeeTeam}
                  users={users}
                  assigneeName={assignee?.name}
                  assigneeTeamOwner={
                    assignee?.teamOwnerId
                      ? (userById.get(assignee.teamOwnerId)?.name ?? "")
                      : undefined
                  }
                />
              </Fragment>
            );
          })}
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

        שולחן (`lg:`): מאוקטובר 2026 הכרטיסים הם ברירת המחדל גם שם. אין
        ניווט תחתון, ו-`fixed inset-x-0` היה נפרש גם מעל סרגל הצד. שם
        הסרגל `sticky` בתוך עמודת התוכן — צף בתחתית המסך כל עוד הרשימה
        גלויה, ונעצר בסופה.
      */}
      {selecting && (
        <div
          ref={barRef}
          // הריפוד האופקי ב-`max()` — במצב נוף על מכשיר עם מגרעת, ה-inset
          // הצדדי אינו אפס, ו-`px-3` קבוע היה דוחף את בורר השיוך מתחתיה
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-surface-2 pb-2 pt-2 ps-[max(0.75rem,env(safe-area-inset-right))] pe-[max(0.75rem,env(safe-area-inset-left))] shadow-card lg:sticky lg:bottom-4 lg:mt-3 lg:flex lg:flex-wrap lg:items-center lg:gap-3 lg:rounded-card lg:border lg:p-3 lg:shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between gap-2 lg:mb-0 lg:justify-start">
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
            className={`flex flex-wrap gap-2 lg:flex-1 lg:justify-end ${selected.size === 0 ? "pointer-events-none opacity-40" : ""}`}
          >
            {/*
              ⚠️ `min-w-0` חובה: ל-`<select>` יש רוחב מובנה לפי ה-`option`
              הארוך ביותר, ו-`min-width: auto` בפריט flex מונע ממנו
              להתכווץ מתחתיו. שם עובד מלא ב-16px גלש מהסרגל הקבוע והזיז
              את כל הדף הצידה. `h-11` ולא `h-10` — 44px היא מטרת המגע
              המינימלית, ו-40px היה מתחתיה.
            */}
            <select
              className={`${inputClass} h-11 w-auto min-w-0 flex-1 lg:h-9 lg:max-w-56`}
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
              className={`${inputClass} h-11 w-auto min-w-0 flex-1 lg:h-9 lg:max-w-56`}
              defaultValue=""
              disabled={bulkBusy}
              onChange={(e) => {
                const v = e.target.value as LeadStatus;
                if (v) onBulkStatus(v);
                e.target.value = "";
              }}
            >
              <option value="">סטטוס…</option>
              {PICKABLE_STATUSES.map((s) => (
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
              className="h-11 lg:h-9"
            >
              מחיקה
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * כותרת שכבה ברשימת הכרטיסים: שם השכבה, כמה לידים בה, ומה היא אומרת.
 *
 * ⚠️ שקטה בכוונה — טקסט על הרקע, בלי פס צבעוני לרוחב המסך. הצבע יושב
 * רק במונה (`Badge` בטון השכבה), כך שהעין מוצאת את הקבוצה בלי שהכותרת
 * תתחרה בכרטיסים שמתחתיה. קודם היא הייתה רצועה ממולאת בצבע, וברשימה
 * של ארבע שכבות זה היה ארבעה פסים צבעוניים בין הלידים.
 *
 * ⚠️ `<li>` ולא `<div>`: ההורה הוא `<ul>`, וילד שאינו `<li>` שם הוא
 * HTML לא תקין שקוראי מסך מדווחים עליו כרשימה שבורה. `role="presentation"`
 * מוציא אותו מספירת הפריטים — הוא כותרת, לא ליד.
 */
function QueueTierHeading({
  tier,
  tiers,
}: {
  tier: keyof QueueTiers["totals"];
  tiers: QueueTiers;
}) {
  const meta = QUEUE_TIER_META[tier];

  return (
    <li
      role="presentation"
      className="mt-3 flex min-w-0 items-center gap-2 px-1 first:mt-0"
    >
      <span className="shrink-0 text-sm font-semibold text-ink-1">{meta.label}</span>
      <Badge tone={meta.tone} className="nums shrink-0">
        {number(tiers.totals[tier])}
      </Badge>
      {/* ההסבר מה השכבה אומרת. "באיחור" לבדו לא מבדיל בין "מועד
          החזרה עבר" לבין "הליד יושב יותר מדי זמן" */}
      <span className="min-w-0 truncate text-xs text-ink-3">{meta.hint}</span>
    </li>
  );
}
