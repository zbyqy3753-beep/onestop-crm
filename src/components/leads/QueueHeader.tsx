"use client";

import type { Lead, LeadStatus } from "@/lib/domain/types";
import { OPEN_STATUSES } from "@/lib/domain/types";
import { number, until } from "@/lib/format";
import { israelHourMinute } from "@/lib/tz";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { Filters } from "./FilterBar";
import { StatusTiles } from "./StatusTiles";
import { KindToggle } from "./KindToggle";
import { QUICK_VIEWS, isViewActive, toggleStatusFilter } from "./views";

/**
 * תזכורת אחת ברצועה: הליד, מועד החזרה שלו, והאם המועד כבר עבר
 * (`late`) או שהוא היום. נגזר ב-`LeadsClient` › `reminders`.
 */
export interface Reminder {
  lead: Lead;
  /** `lead.followUpAt`, מובטח — רק לידים עם מועד נכנסים לרצועה */
  at: string;
  late: boolean;
}

/** כמה תזכורות מוצגות כצ׳יפ לפני "+N". */
const REMINDER_CHIPS = 6;

/**
 * הצ׳יפ של המקור — `rounded-full` עם מסגרת, נבחר = כחול מלא.
 *
 * `min-h-11` בטלפון: אלה הפקדים שהעובד נוגע בהם הכי הרבה, והם היו
 * 34px. בשולחן חוזרים ל-30px ושום דבר לא זז. `active:` כי `hover:` לבדו
 * מתקמפל ל-`@media (hover: hover)` ולא קיים במגע.
 */
function chip(on: boolean): string {
  return `inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors active:scale-95 lg:min-h-0 lg:active:scale-100 ${
    on
      ? "border-brand bg-brand text-on-brand"
      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1"
  }`;
}

/**
 * ראש המסך, מלמעלה למטה — בסדר של מערכת הלידים שהמשתמש הצביע עליה:
 *
 *   1. הכותרת והפעולות (בשולחן בלבד)
 *   2. תיקיית החודשים (`PeriodPicker`, מוזרק כ-`period`)
 *   3. משפט הסיכום: לידים · פתוחים · נסגרו בהצלחה · עסקאות
 *   4. (הנתונים הפיננסיים, כשנפתחו)
 *   5. רצועת "להתקשר היום" — נעלמת כשאין
 *   6. קוביות הסטטוס — מצב התור, וגם הסינון
 *
 * החיפוש, המיון והתצוגות המהירות באים אחריו (`FilterBar`, `QuickViews`).
 */
export function QueueHeader({
  counts,
  tileCounts,
  total,
  showing,
  dealsCount,
  period,
  stats,
  reminders,
  now,
  onShowReminders,
  onAdd,
  onExport,
  onImport,
  onToggleStats,
  statsOpen,
  filters,
  onFiltersChange,
  compact = false,
  onExpandStatuses,
}: {
  /**
   * ספירות החתך כולו, **לידים חמים בלבד** — ראה `LeadsClient` ›
   * `headerCounts`.
   *
   * ⚠️ משמשות **רק** את מוני הסיכום ("N פתוחים / M נסגרו"), שהם מוני
   * חתך ולא מוני קוביה. הקוביות מקבלות את `tileCounts`. אל תחזיר את
   * אלה לקוביות — הן לא יודעות על אף מסנן שהמשתמש הדליק, וזה בדיוק מה
   * שגרם לקוביה להבטיח 412 בזמן שהטבלה הציגה 38.
   */
  counts: Record<LeadStatus, number>;
  /** המספר שעל כל קוביה. נגזר בלקוח — ראה `LeadsClient` › `tileCounts` */
  tileCounts: Record<LeadStatus, number>;
  /** לידים חמים בחתך — "N לידים". דאטה קרה לא נספרת. */
  total: number;
  showing: number;
  /** עסקאות שנסגרו מלידים שבחתך */
  dealsCount: number;
  /** שורת החודשים — `PeriodPicker`, מתחת לכותרת */
  period?: React.ReactNode;
  /** הפאנלים הפיננסיים, כשהם פתוחים — מתחת לסיכום */
  stats?: React.ReactNode;
  /** `null` עד ההרכבה — "היום" תלוי בשעון הלקוח */
  reminders: Reminder[] | null;
  now: number | null;
  /** מחיל את התצוגה "לחזור היום" — כל התזכורות ברשימה */
  onShowReminders: () => void;
  onAdd: () => void;
  onExport: () => void;
  onImport: () => void;
  onToggleStats: () => void;
  statsOpen: boolean;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  /** מסך צר — בלי כותרת ופעולות, קוביות הסטטוס בשורה אחת */
  compact?: boolean;
  onExpandStatuses?: () => void;
}) {
  const openTotal = OPEN_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const wonCount = counts.won ?? 0;
  const filtering = showing !== total;

  return (
    <header className="mb-3">
      {/*
        ⚠️ בטלפון הבלוק הזה **לא מרונדר בכלל**, ולא "מתכווץ".
        הוא עלה 111px מתוך 812 — 14% מהמסך — והכיל דברים מיותרים שם:
        כותרת שזהה מילה במילה למה שהסרגל העליון מציג 60px מעליה, ושלושה
        כפתורים של עבודה ממחשב (ייבוא/ייצוא/פיננסי) שעברו לגיליון ה-`⋯`
        שב-`FilterBar`. "ליד חדש" הפך ל-FAB בגובה האגודל.

        בכוונה תת-עץ נפרד ולא מחלקות `lg:` על הקיים — כך התנהגות
        ה-wrap בשולחן ב-1024–1280px לא יכולה להישבר בטעות.
      */}
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-[22px] font-bold leading-none tracking-tight">
            תור העבודה
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* הטוגל של הפאנלים יושב כאן ולא ככרטיס נפרד — ככרטיס הוא עלה
                58 פיקסלים של גובה בלי להציג שום נתון */}
            <Button
              variant="ghost"
              onClick={onToggleStats}
              aria-expanded={statsOpen}
              className="h-9"
            >
              נתונים פיננסיים
              <Icon
                name="chevronDown"
                size={14}
                className={statsOpen ? "rotate-180" : ""}
              />
            </Button>
            <Button variant="secondary" icon="upload" onClick={onImport} className="h-9">
              ייבוא
            </Button>
            <Button
              variant="secondary"
              icon="download"
              title="ייצוא לאקסל"
              onClick={onExport}
              disabled={showing === 0}
              className="h-9"
            >
              ייצוא
            </Button>
            <Button variant="primary" icon="plus" onClick={onAdd} className="h-9 px-4">
              ליד חדש
              <kbd className="ms-1 rounded border border-on-brand/30 px-1 text-[10px] font-normal opacity-70">
                N
              </kbd>
            </Button>
          </div>
        </div>
      )}

      {period}

      {/*
        משפט אחד ולא ארבעה כרטיסי KPI: הם נקראים ביחד, ובטלפון משפט
        שנשבר לשתי שורות זול בהרבה מרשת של ארבעה אריחים.

        ⚠️ מוני **חתך** (`headerCounts`, לידים חמים בתקופה), לא מוני סינון —
        הם לא זזים כשלוחצים על קוביה. מה שכן זז הוא "מוצגים N", שמופיע
        רק כשהרשימה מסוננת, כדי שיהיה ברור ששני המספרים אינם אותו דבר.
      */}
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
        <Figure value={total} label="לידים" />
        <Dot />
        <Figure value={openTotal} label="פתוחים" />
        <Dot />
        <Figure value={wonCount} label="נסגרו בהצלחה" />
        <Dot />
        <Figure value={dealsCount} label="עסקאות" />
        {filtering && (
          <span className="lg:ms-auto">
            מוצגים <span className="nums font-semibold text-ink-1">{number(showing)}</span>{" "}
            לפי הסינון
          </span>
        )}
      </p>

      {stats && <div className="mb-3">{stats}</div>}

      {reminders && reminders.length > 0 && now !== null && (
        <ReminderStrip reminders={reminders} now={now} onShowAll={onShowReminders} />
      )}

      {/* קוביות הסטטוס — מצב התור וגם הסינון, באותו פקד */}
      <StatusTiles
        counts={tileCounts}
        active={filters.status}
        compact={compact}
        onExpand={onExpandStatuses}
        onToggle={(status) =>
          onFiltersChange({
            ...filters,
            status: toggleStatusFilter(filters.status, status),
          })
        }
        onClear={() => onFiltersChange({ ...filters, status: [] })}
      />
    </header>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="nums font-semibold text-ink-1">{number(value)}</span> {label}
    </span>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-ink-4">
      ·
    </span>
  );
}

/* ── למי להתקשר ───────────────────────────────────────────────────────── */

/**
 * "N להתקשר היום" — מי שמועד החזרה שלו הגיע, בצ׳יפים שמחייגים.
 *
 * צ׳יפ הוא קישור `tel:` — הנגיעה בו היא השיחה עצמה, בלי לפתוח קודם את
 * הליד. צ׳יפ של מועד שכבר **עבר** אדום רך (`bad`), כמו איחור בכל המערכת.
 *
 * ⚠️ נעלמת כשאין תזכורות, ולא מציגה "0": רצועה שאומרת "אין כלום" היא
 * רעש שמלמד להתעלם ממנה בדיוק ביום שיש בה משהו.
 */
function ReminderStrip({
  reminders,
  now,
  onShowAll,
}: {
  reminders: Reminder[];
  now: number;
  onShowAll: () => void;
}) {
  const shown = reminders.slice(0, REMINDER_CHIPS);
  const rest = reminders.length - shown.length;
  const late = reminders.filter((r) => r.late).length;

  return (
    <section
      aria-label="להתקשר היום"
      className="mb-3 flex items-center gap-3 rounded-card border border-warn/30 bg-warn-soft py-1.5 pe-2 ps-3"
    >
      {/*
        הכותרת היא גם כפתור: היא מחילה את התצוגה "לחזור היום", כך
        שהדרך לרשימה המלאה קיימת גם כשאין "+N".
      */}
      <button
        type="button"
        onClick={onShowAll}
        title="הצג את כולם ברשימה"
        className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 text-sm font-semibold text-warn underline-offset-4 hover:underline active:underline lg:min-h-0"
      >
        <Icon name="bell" size={16} className="shrink-0" />
        <span>
          <span className="nums">{number(reminders.length)}</span> להתקשר היום
        </span>
        {late > 0 && (
          <span className="font-medium text-bad max-lg:hidden">
            · <span className="nums">{number(late)}</span> באיחור
          </span>
        )}
      </button>

      {/*
        ⚠️ `--scroll-cue-bg` ב-`style` ולא כמחלקה `[--scroll-cue-bg:…]`.
        `.scroll-x-cue` ב-globals.css יושב **מחוץ** לכל `@layer`, ומחלקות
        Tailwind 4 יושבות ב-`@layer utilities` — וכלל לא-שכבתי גובר על כל
        כלל שכבתי. המכסים של הרמז חייבים להיות בצבע הרצועה, אחרת הם
        נראים כפס בצבע הדף על הענבר. ערך inline גובר על שניהם.

        בשולחן הצ׳יפים נשברים לשורות ולא נגללים.
      */}
      <ul
        className="scroll-thin scroll-x-cue -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 lg:flex-wrap lg:overflow-visible"
        style={{ "--scroll-cue-bg": "var(--c-warn-soft)" } as React.CSSProperties}
      >
        {shown.map((r) => (
          <li key={r.lead.id} className="shrink-0">
            <ReminderChip reminder={r} now={now} />
          </li>
        ))}
        {rest > 0 && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={onShowAll}
              aria-label={`עוד ${rest} — הצג את כולם ברשימה`}
              className={chip(false)}
            >
              <span className="nums font-semibold">+{number(rest)}</span>
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

function ReminderChip({ reminder, now }: { reminder: Reminder; now: number }) {
  const { lead, at, late } = reminder;
  /*
    ⚠️ מועד פגום לא נכנס לפורמט. `until` ו-`israelHourMinute` עוברים דרך
    `Intl.DateTimeFormat`, שזורק `RangeError` על `NaN` — וכאן זה לא תא
    אחד שנשבר אלא כל מסך הלידים, מיד אחרי ההידרציה (כשהשעון נרשם).
    ליד כזה כן נכנס לרצועה, כי הוא גם ב"לחזור היום" (`NaN > endOfToday`
    הוא false) והמונה חייב להתאים לרשימה שהכותרת פותחת.
  */
  const t = Date.parse(at);
  const valid = !Number.isNaN(t);
  const when = valid ? until(at, now) : "מועד לא תקין";
  // שעה רק לתזכורת של היום, ורק כשנקבעה שעה: "00:00" הוא תאריך בלי
  // שעה, ולא שיחה שמתוכננת לחצות
  const time = late || !valid ? null : israelHourMinute(t);

  return (
    <a
      href={`tel:${lead.phone}`}
      aria-label={`התקשר ל${lead.name} — ${when}`}
      title={`${lead.name} — ${when}`}
      className={`inline-flex min-h-11 touch-manipulation select-none items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors active:scale-95 lg:min-h-0 lg:active:scale-100 ${
        late
          ? "border-bad/30 bg-bad-soft text-bad hover:border-bad/50"
          : "border-line bg-surface text-ink-1 hover:border-line-strong"
      }`}
    >
      <Icon name="phone" size={13} className={`shrink-0 ${late ? "" : "text-brand"}`} />
      <span className="max-w-40 truncate">{lead.name}</span>
      {time && time !== "00:00" && (
        <span className="nums text-xs text-ink-3">{time}</span>
      )}
    </a>
  );
}

/* ── תצוגות מהירות ────────────────────────────────────────────────────── */

/**
 * תצוגות מהירות — "מה אני צריך לעשות עכשיו" — ובקצה השורה בורר הסוג.
 *
 * יושבות מתחת לחיפוש ולמיון, ממש מעל הרשימה: הן הלשוניות של הרשימה
 * עצמה, וכך הן לא נדבקות לקוביות הסטטוס שבסוף הכותרת.
 *
 * ⚠️ `scroll-x-cue` הוא לא קישוט. למנהל מוצגות כאן עשר תצוגות
 * (`views.ts`), כלומר ~720px של צ׳יפים בתוך ~336px פנויים בטלפון —
 * "סגורים", "לידים חמים" ו"לידים מדאטה" יושבים מחוץ למסך. ו-
 * `scroll-thin` לא עוזר: במסך מגע פס הגלילה מרחף ומופיע רק תוך כדי
 * גלילה, כך שאין **שום** סימן שיש עוד. `scroll-x-cue` מצייר צל
 * בקצה שבו נשאר תוכן, ונעלם מעצמו כשמגיעים אליו.
 */
export function QuickViews({
  filters,
  onFiltersChange,
  currentUserId,
  canSeeAll,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  currentUserId: string;
  /** מסתיר תצוגות שאין להן משמעות בחתך אישי */
  canSeeAll: boolean;
}) {
  return (
    <div
      className="scroll-thin scroll-x-cue -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
      role="group"
      aria-label="תצוגות מהירות"
    >
      {QUICK_VIEWS.filter((v) => canSeeAll || !v.fullAccessOnly).map((view) => {
        const active = isViewActive(view, filters, currentUserId);
        return (
          <button
            key={view.key}
            type="button"
            /* החיפוש שורד את המעבר בין תצוגות. `patch` מחזיר אובייקט
               מסננים שלם, ולכן בלי השורה הזו נגיעה בצ׳יפ מחקה בשקט
               מילת חיפוש שהמשתמש הרגע הקליד. */
            onClick={() =>
              onFiltersChange({
                ...view.patch(currentUserId),
                query: filters.query,
              })
            }
            aria-pressed={active}
            className={chip(active)}
          >
            {view.label}
          </button>
        );
      })}

      {/*
        ⚠️ מתגי הסוג יושבים **באותה שורה** עם התצוגות המהירות, אחרי
        מפריד. הם ממד ולא תצוגה (ראה `KindToggle`), אבל הם נשאלים
        באותו רגע — "מה אני צריך לעשות עכשיו, ובאיזה סוג לידים" —
        ושורה שנייה בשבילם הייתה עולה 44px בטלפון בשביל שני כפתורים.
      */}
      <span className="mx-0.5 w-px shrink-0 self-stretch bg-line" aria-hidden />
      <KindToggle
        value={filters.kind}
        onChange={(kind) => onFiltersChange({ ...filters, kind })}
      />
    </div>
  );
}
