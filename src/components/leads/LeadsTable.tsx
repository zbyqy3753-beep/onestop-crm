"use client";

import { Fragment } from "react";
import type { Lead, LeadCostTable, LeadStatus, UserRef } from "@/lib/domain/types";
import { leadCost } from "@/server/services/economics";
import { Button, EmptyState, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { SortField } from "./LeadsClient";
import { COLUMNS, SORT_PRIMARY_DIR, allowedColumns, type ColumnKey } from "./columns";
import { LeadRow } from "./LeadRow";
import { QUEUE_TIER_META, type QueueTiers } from "./queue";
import { TONE_SOFT_VAR, TONE_VAR, number } from "@/lib/format";
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
  tiers,
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
  /**
   * שכבות התור — הכותרות המפרידות. `null` = בלי כותרות (מיון שאינו
   * "תור עבודה", או לפני ההרכבה). ראה `LeadsClient` › `queueTiers`.
   */
  tiers: QueueTiers | null;
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

  /**
   * מחזור של שלושה מצבים: הכיוון השימושי → ההפוך → חזרה לתור העבודה.
   *
   * ⚠️ המצב השלישי הוא לא קישוט. מיון "תור עבודה" הוא ברירת המחדל של
   * המסך ואין לו כותרת עמודה משלו, ולכן בלי הלחיצה השלישית לחיצה אחת
   * על כותרת הייתה **חד-כיוונית**: אין בשולחן שום פקד שמחזיר לתור,
   * והדרך היחידה חזרה הייתה לרענן את הדף. עמודה שאי אפשר לבטל היא
   * עמודה שלוחצים עליה פעם אחת ואז נלחמים בה.
   */
  function sortBy(field: SortField) {
    const primary = SORT_PRIMARY_DIR[field];
    if (sort.field !== field) return onSortChange({ field, dir: primary });
    if (sort.dir === primary)
      return onSortChange({ field, dir: primary === "asc" ? "desc" : "asc" });
    onSortChange({ field: "queue", dir: "desc" });
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
            {shown.map((col) => {
              const active = col.sort !== undefined && sort.field === col.sort;
              return (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-3 py-2.5 text-start font-medium"
                  /* מה שקורא המסך מקריא, ומה שמבדיל בין "לא ממוין"
                     ל"ממוין עולה" בלי להסתמך על כיוון של חץ */
                  aria-sort={
                    active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                >
                  {col.sort ? (
                    <button
                      onClick={() => sortBy(col.sort!)}
                      title={sortHint(col.label, col.sort, sort)}
                      className={`group inline-flex items-center gap-1 hover:text-ink-1 ${
                        active ? "text-ink-1" : ""
                      }`}
                    >
                      {col.label}
                      {/*
                        ⚠️ החץ מרונדר **תמיד**, ולא רק בעמודה הפעילה.
                        בלעדיו שום דבר בכותרת לא רמז שהיא בכלל ניתנת
                        ללחיצה: חמש עמודות מתוך אחת-עשרה מיוּנות, וכולן
                        נראו זהות לשש שאינן. בעמודה שאינה פעילה הוא
                        עמום, ומתמלא בריחוף.
                      */}
                      <Icon
                        name="chevronDown"
                        size={13}
                        className={`transition ${sort.dir === "asc" && active ? "rotate-180" : ""} ${
                          active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                        }`}
                      />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
            <th className="w-20">
              <span className="sr-only">פעולות</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead, i) => {
            /*
              כותרת נפתחת רק כשהשכבה **משתנה** מהשורה הקודמת. השכבות
              רציפות במיון התור (זו ההגדרה שלהן), ולכן זה נותן בדיוק
              כותרת אחת לכל שכבה שמופיעה בעמוד הזה.

              ⚠️ `i === 0` נחשב שינוי גם באמצע התוצאה: בעמוד 2 השכבה
              הראשונה נמשכת מהעמוד הקודם, ובלי כותרת בראשו העמוד היה
              נפתח ברשימת שורות בלי שם.
            */
            const tier = tiers?.of(lead);
            const opens =
              tier !== undefined && (i === 0 || tiers!.of(leads[i - 1]) !== tier);

            return (
              <Fragment key={lead.id}>
                {opens && (
                  <QueueTierRow tier={tier!} tiers={tiers!} span={shown.length + 2} />
                )}
                <LeadRow
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
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * מה תעשה הלחיצה הבאה, במילים.
 *
 * ⚠️ "עולה"/"יורד" לא נאמר כאן בכוונה. למי שמסתכל על עמודת "חזרה"
 * "עולה" הוא לא מידע — "הכי דחוף קודם" כן. וכיוון שהמצב השלישי מחזיר
 * לתור העבודה ולא מהפך שוב, בלי הרמז הזה הלחיצה השלישית נראית כאילו
 * המיון פשוט קרס.
 */
function sortHint(
  label: string,
  field: SortField,
  sort: { field: SortField; dir: "asc" | "desc" },
): string {
  const next: "asc" | "desc" | "queue" =
    sort.field !== field
      ? SORT_PRIMARY_DIR[field]
      : sort.dir === SORT_PRIMARY_DIR[field]
        ? SORT_PRIMARY_DIR[field] === "asc"
          ? "desc"
          : "asc"
        : "queue";

  if (next === "queue") return "חזרה לתור העבודה";

  const meaning: Partial<Record<SortField, { asc: string; desc: string }>> = {
    name: { asc: "א׳ עד ת׳", desc: "ת׳ עד א׳" },
    status: { asc: "מהחדשים לסגורים", desc: "מהסגורים לחדשים" },
    priority: { asc: "רגיל קודם", desc: "דחוף קודם" },
    followUpAt: { asc: "הכי דחוף קודם", desc: "הרחוק ביותר קודם" },
    updatedAt: { asc: "הישן קודם", desc: "העדכני קודם" },
    createdAt: { asc: "הוותיק קודם", desc: "החדש קודם" },
  };

  const m = meaning[field];
  return m ? `${label}: ${m[next]}` : label;
}

/**
 * כותרת מפרידה בין שכבות התור.
 *
 * ⚠️ `<tr>` בתוך ה-`<tbody>` ולא `<tbody>` נפרד לכל שכבה: הטבלה
 * גוללת בגובה קבוע עם `<thead>` דביק, וכמה `<tbody>`-ים היו נותנים
 * לדפדפן הזדמנות לצייר גבול פנימי בין כל אחד מהם.
 *
 * המספר הוא סך השכבה בתוצאה המסוננת כולה ולא בעמוד המוצג — ראה
 * `LeadsClient` › `queueTiers`.
 */
function QueueTierRow({
  tier,
  tiers,
  span,
}: {
  tier: keyof QueueTiers["totals"];
  tiers: QueueTiers;
  span: number;
}) {
  const meta = QUEUE_TIER_META[tier];

  return (
    <tr>
      <td
        colSpan={span}
        style={{ background: TONE_SOFT_VAR[meta.tone] }}
        className="px-3 py-1.5"
      >
        <span className="flex items-baseline gap-2">
          <span
            className="text-[12px] font-semibold"
            style={{ color: TONE_VAR[meta.tone] }}
          >
            {meta.label}
          </span>
          <span className="nums text-[12px] text-ink-3">
            {number(tiers.totals[tier])}
          </span>
          {/* ההסבר מה השכבה אומרת. "באיחור" לבדו לא מבדיל בין "מועד
              החזרה עבר" לבין "הליד יושב יותר מדי זמן" */}
          <span className="text-[11px] text-ink-4">{meta.hint}</span>
        </span>
      </td>
    </tr>
  );
}
