"use client";

import { useCallback, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { number, toE164 } from "@/lib/format";
import { useNow } from "@/lib/clock";
import { changeStatusAction } from "@/app/(app)/leads/actions";
import { StatusDialog } from "@/components/leads/StatusDialog";
import {
  Button,
  EmptyState,
  ToastStack,
  inputClass,
  type Toast,
} from "@/components/ui/primitives";
import { Icon, type IconKey } from "@/components/ui/Icon";
import { MissedLeadCard, MissedLeadCardSkeleton } from "./MissedLeadCard";
import {
  COMPETITOR_STATUS,
  NO_DEAL_STATUSES,
  STUCK_IDLE_DAYS,
  STUCK_OVERDUE_DAYS,
  isClosedMissed,
  isNoDeal,
  israelDay,
  stuckInfo,
  type ClosedTotals,
  type MissedGroup,
  type MissedLeadRow,
  type NoDealStatus,
  type StuckInfo,
} from "./groups";

/** כמה כרטיסים מצוירים בכל פעם. "נסגרו בלי עסקה" יכול להגיע לאלפים. */
const PAGE_SIZE = 30;

interface Entry {
  row: MissedLeadRow;
  /** קיים רק בלשונית "תקועים בתור" */
  stuck?: StuckInfo;
}

/**
 * שלוש הקבוצות, בסדר של הסיפור: מי הלך למתחרה, מי נסגר בלי עסקה, ומי
 * עוד פתוח אבל תקוע.
 *
 * ⚠️ שמות הסטטוסים נגזרים מ-`STATUS_CONFIG` ולא מוקלדים כאן שוב — תווית
 * שתשתנה שם תשתנה גם בהסבר. הספים של "תקועים" נגזרים מ-`groups.ts`.
 */
const GROUPS: { key: MissedGroup; title: string; hint: string }[] = [
  {
    key: "competitor",
    title: "עברו למתחרה",
    hint: `לידים שסומנו ״${STATUS_CONFIG[COMPETITOR_STATUS].label}״`,
  },
  {
    key: "noDeal",
    title: "נסגרו בלי עסקה",
    hint: NO_DEAL_STATUSES.map((s) => STATUS_CONFIG[s].label).join(" · "),
  },
  {
    key: "stuck",
    title: "תקועים בתור",
    hint: `חזרה באיחור של יותר מ-${STUCK_OVERDUE_DAYS} ימים, ״${STATUS_CONFIG.noAnswer2.label}״, או ${STUCK_IDLE_DAYS} ימים בלי תזוזה`,
  },
];

const GROUP_BY_KEY = Object.fromEntries(GROUPS.map((g) => [g.key, g])) as Record<
  MissedGroup,
  (typeof GROUPS)[number]
>;

/**
 * צ'יפ בסגנון המקור — `rounded-full` עם מסגרת, הנבחר מלא במותג.
 * אותן מחלקות כמו התצוגות המהירות ב-`QueueHeader`, כולל מגע 44px בטלפון
 * ו-`active:` (בטלפון אין `hover:` בכלל).
 */
function chip(on: boolean): string {
  return `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors active:scale-95 lg:min-h-0 lg:active:scale-100 ${
    on
      ? "border-brand bg-brand text-on-brand"
      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1 active:border-line-strong"
  }`;
}

/**
 * מסך "לידים שפוספסו": למה לידים לא הפכו לעסקה, לפי סיבה — ודרך להחזיר
 * ליד לתור.
 *
 * מקבל מהשרת שורות רזות בלבד (ראה `MissedLeadRow`). "עברו למתחרה"
 * ו"נסגרו בלי עסקה" נגזרים מהסטטוס ומוכנים כבר בשרת; "תקועים בתור" תלוי
 * בשעון, ולכן מחושב רק כאן, אחרי ההרכבה.
 */
export function MissedLeadsClient({
  rows,
  closedTotals,
}: {
  /** סגירות (חתוכות לכל סטטוס) ומועמדים ל"תקועים", מהעדכני לישן */
  rows: MissedLeadRow[];
  /** מספר הסגירות המלא בכל סטטוס — ראה `ClosedTotals` */
  closedTotals: ClosedTotals;
}) {
  const router = useRouter();
  const now = useNow();
  const listTitleId = useId();
  const reasonLabelId = useId();

  /** הלשונית שהמשתמש בחר. `null` = עוד לא בחר — ראה `autoTab`. */
  const [picked, setPicked] = useState<MissedGroup | null>(null);
  const [reason, setReason] = useState<NoDealStatus | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [target, setTarget] = useState<MissedLeadRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * לידים שהוחזרו לתור מכאן — עד שהשרת שולח נתונים חדשים.
   *
   * ⚠️ קשור למערך `rows` שהיה על המסך ברגע ההחזרה, ולא ל-`useOptimistic`.
   * ה-transition נגמר כשהפעולה חוזרת, **לפני** שהריענון מגיע, ושכבה
   * אופטימית הייתה מתאפסת באמצע: הכרטיס נעלם, חוזר לשבריר שנייה ונעלם
   * שוב. ברגע ש-`rows` מתחלף ההסתרה פוקעת מעצמה, והשרת הוא שקובע.
   */
  const [returned, setReturned] = useState<{
    rows: MissedLeadRow[];
    ids: ReadonlySet<string>;
  } | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const notify = useCallback((message: string, tone: Toast["tone"] = "good") => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((t) => [...t, { id, message, tone }]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  /* ── הקבוצות ──────────────────────────────────────────────────────── */

  const visible = useMemo(() => {
    if (!returned || returned.rows !== rows) return rows;
    return rows.filter((r) => !returned.ids.has(r.id));
  }, [rows, returned]);

  /** הספירות המלאות מהשרת, פחות מה שהוחזר לתור מאז שהגיעו */
  const totals = useMemo(() => {
    const out: ClosedTotals = { ...closedTotals };
    if (returned && returned.rows === rows) {
      for (const r of rows) {
        if (returned.ids.has(r.id) && isClosedMissed(r.status)) {
          out[r.status] = Math.max(0, out[r.status] - 1);
        }
      }
    }
    return out;
  }, [rows, returned, closedTotals]);

  const competitorRows = useMemo(
    () => visible.filter((r) => r.status === COMPETITOR_STATUS),
    [visible],
  );
  const noDealRows = useMemo(() => visible.filter((r) => isNoDeal(r.status)), [visible]);
  const openRows = useMemo(
    () => visible.filter((r) => !STATUS_CONFIG[r.status].terminal),
    [visible],
  );

  /*
   * ⚠️ יום הלוח ולא `now` כתלות: `useNow` מתקתק כל דקה, והתשובה "תקוע
   * או לא" משתנה רק כשמתחלף יום.
   */
  const today = now === null ? null : israelDay(now);
  const stuck = useMemo<Entry[] | null>(() => {
    if (today === null) return null;
    const out: Entry[] = [];
    for (const row of openRows) {
      const info = stuckInfo(row, today);
      if (info) out.push({ row, stuck: info });
    }
    /*
     * ליד חם לפני דאטה — אותו כלל כמו ברירת המחדל של תור הלידים: ייבוא
     * של מאות שורות דאטה שאיש לא נגע בהן חודש היה קובר את הלידים החמים
     * התקועים. המיון יציב, ולכן בתוך כל סוג נשמר הסדר מהשרת.
     */
    return out.sort((a, b) => kindRank(a.row) - kindRank(b.row));
  }, [openRows, today]);

  const competitorCount = totals[COMPETITOR_STATUS];
  const noDealCount = NO_DEAL_STATUSES.reduce((sum, s) => sum + totals[s], 0);
  const counts: Record<MissedGroup, number | null> = {
    competitor: competitorCount,
    noDeal: noDealCount,
    stuck: stuck === null ? null : stuck.length,
  };

  /*
   * ברירת המחדל: "תקועים בתור" אם יש בה משהו — אלה הלידים שעוד אפשר
   * להציל — ואחרת הקבוצה הגדולה.
   *
   * ⚠️ לפני ההרכבה אין שעון, ולכן ההחלטה נשענת על המועמדים שהשרת שלח.
   * אין אף מועמד = ברור כבר עכשיו שאין תקועים, והמסך לא יקפוץ מלשונית
   * ריקה לאחרת אחרי ההידרציה.
   *
   * נגזר בכל רינדור עד שהמשתמש בוחר — ואז `picked` מקבע. גם החזרה לתור
   * מקבעת (ראה `confirmReturn`): בלי זה, החזרת הליד התקוע האחרון הייתה
   * מעיפה את המשתמש ללשונית אחרת באמצע העבודה.
   */
  const anyStuck = stuck === null ? openRows.length > 0 : stuck.length > 0;
  const autoTab: MissedGroup =
    anyStuck || competitorCount + noDealCount === 0
      ? "stuck"
      : competitorCount > noDealCount
        ? "competitor"
        : "noDeal";
  const tab = picked ?? autoTab;

  const reasonRows = useMemo(
    () => (reason === null ? noDealRows : noDealRows.filter((r) => r.status === reason)),
    [noDealRows, reason],
  );

  const entries = useMemo<Entry[] | null>(() => {
    if (tab === "stuck") return stuck;
    return (tab === "competitor" ? competitorRows : reasonRows).map((row) => ({ row }));
  }, [tab, stuck, competitorRows, reasonRows]);

  const matches = useMemo(() => {
    const match = matcher(query);
    if (!entries || !match) return entries;
    return entries.filter((e) => match(e.row));
  }, [entries, query]);

  /*
   * החיפוש הוא בתוך הלשונית, אבל שם שיושב בלשונית אחרת לא אמור להיגמר
   * ב"לא נמצא" — עם שלוש לשוניות זו מלכודת. כשאין תוצאות, בודקים איפה כן.
   */
  const elsewhere = useMemo(() => {
    const match = matcher(query);
    if (!match || !matches || matches.length > 0) return [];
    const found: { key: MissedGroup | "allReasons"; count: number }[] = [];
    if (tab === "noDeal" && reason !== null) {
      found.push({ key: "allReasons", count: noDealRows.filter(match).length });
    }
    if (tab !== "competitor") {
      found.push({ key: "competitor", count: competitorRows.filter(match).length });
    }
    if (tab !== "noDeal") {
      found.push({ key: "noDeal", count: noDealRows.filter(match).length });
    }
    if (tab !== "stuck" && stuck) {
      found.push({ key: "stuck", count: stuck.filter((e) => match(e.row)).length });
    }
    return found.filter((f) => f.count > 0);
  }, [query, matches, tab, reason, competitorRows, noDealRows, stuck]);

  /**
   * פילוח "נסגרו בלי עסקה": הסיבה הנפוצה ראשונה — זו התשובה ל"למה".
   * סיבה בלי לידים לא מוצגת, אלא אם היא הנבחרת (אחרת היא הייתה נעלמת
   * מתחת לסמן אחרי שהליד האחרון בה הוחזר לתור).
   */
  const reasonChips = useMemo(
    () =>
      NO_DEAL_STATUSES.map((status, order) => ({ status, order, count: totals[status] }))
        .filter((c) => c.count > 0 || c.status === reason)
        .sort((a, b) => b.count - a.count || a.order - b.order),
    [totals, reason],
  );

  /*
   * הסגירות נחתכות בשרת (ראה `page.tsx`), ולכן ייתכן שלא כל מה שנספר
   * נמצא כאן. בלשונית "תקועים" אין חיתוך.
   */
  const loaded =
    tab === "competitor" ? competitorRows.length : tab === "noDeal" ? reasonRows.length : 0;
  const total =
    tab === "competitor"
      ? competitorCount
      : tab === "noDeal"
        ? reason === null
          ? noDealCount
          : totals[reason]
        : 0;
  const capped = loaded < total;

  const hasQuery = query.trim() !== "";
  const grandTotal = stuck === null ? null : competitorCount + noDealCount + stuck.length;

  /* ── פעולות ──────────────────────────────────────────────────────── */

  // כל מה שמחליף את הרשימה מחזיר לתחילתה — באירוע ולא באפקט
  function selectTab(next: MissedGroup) {
    setPicked(next);
    setLimit(PAGE_SIZE);
  }

  function selectReason(next: NoDealStatus | null) {
    setReason(next);
    setLimit(PAGE_SIZE);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setLimit(PAGE_SIZE);
  }

  function goElsewhere(key: MissedGroup | "allReasons") {
    if (key === "allReasons" || key === "noDeal") setReason(null);
    if (key !== "allReasons") setPicked(key);
    setLimit(PAGE_SIZE);
  }

  /**
   * "החזר לתור" — מעבר ל"ליד חוזר" דרך הפעולה הקיימת של מסך הלידים.
   *
   * הסטטוס דורש פירוט ("למה חזר?"), ו-`StatusDialog` הוא שאוסף אותו;
   * השרת אוכף את אותה חובה ואת ההרשאה על הליד בעצמו.
   */
  function confirmReturn(detail: string, followUpDate?: string) {
    const lead = target;
    if (!lead) return;
    const shown = rows;

    setPicked(tab);
    setBusyId(lead.id);
    startTransition(async () => {
      try {
        const res = await changeStatusAction(lead.id, "returning", detail, followUpDate);
        if (!res.ok) {
          // הדיאלוג נשאר פתוח עם מה שהוקלד — אפשר לתקן ולנסות שוב
          notify(res.error, "bad");
          return;
        }
        setReturned((prev) => ({
          rows: shown,
          ids: new Set(prev && prev.rows === shown ? prev.ids : []).add(lead.id),
        }));
        setTarget(null);
        notify(`הליד של ${lead.name} חזר לתור כ״${STATUS_CONFIG.returning.label}״`);
        router.refresh();
      } catch {
        // הפעולה זורקת (ולא מחזירה `ok:false`) כשהסשן פג או שהמסד לא זמין
        notify("השמירה נכשלה — בדוק את החיבור ונסה שוב", "bad");
      } finally {
        setBusyId(null);
      }
    });
  }

  function emptyState(): {
    icon: IconKey;
    title: string;
    body: string;
    action?: React.ReactNode;
  } {
    if (hasQuery) {
      return {
        icon: "search",
        title: "אין כאן ליד בשם או בטלפון הזה",
        body:
          elsewhere.length > 0
            ? "יש התאמות במקום אחר:"
            : "בדוק את האיות, או חפש לפי חלק מהמספר.",
        action: (
          <div className="flex flex-wrap justify-center gap-2">
            {elsewhere.map((f) => (
              <Button key={f.key} type="button" onClick={() => goElsewhere(f.key)}>
                {f.key === "allReasons" ? "כל הסיבות" : GROUP_BY_KEY[f.key].title}
                <span className="nums font-normal text-ink-3">{number(f.count)}</span>
              </Button>
            ))}
            <Button type="button" variant="ghost" onClick={() => changeQuery("")}>
              ניקוי החיפוש
            </Button>
          </div>
        ),
      };
    }
    if (tab === "noDeal" && reason !== null) {
      return {
        icon: "leads",
        title: `אין לידים שנסגרו כ״${STATUS_CONFIG[reason].label}״`,
        body: "בחר סיבה אחרת, או הצג את כל הסיבות.",
        action: (
          <Button type="button" onClick={() => selectReason(null)}>
            כל הסיבות
          </Button>
        ),
      };
    }
    if (tab === "stuck") {
      return {
        icon: "clock",
        title: "אין לידים תקועים",
        body: `אין חזרה שפוספסה ביותר מ-${STUCK_OVERDUE_DAYS} ימים, אף ליד לא נעצר ב״${STATUS_CONFIG.noAnswer2.label}״, וכל ליד פתוח זז ב-${STUCK_IDLE_DAYS} הימים האחרונים. ליד שייתקע יופיע כאן.`,
      };
    }
    if (tab === "competitor") {
      return {
        icon: "leads",
        title: "אף ליד לא עבר למתחרה",
        body: `ליד שיסומן ״${STATUS_CONFIG[COMPETITOR_STATUS].label}״ יופיע כאן עם מה שהנציג כתב — ומכאן אפשר להחזיר אותו לתור.`,
      };
    }
    return {
      icon: "leads",
      title: "אין לידים שנסגרו בלי עסקה",
      body: "ליד שייסגר בלי עסקה יופיע כאן עם הסיבה שנכתבה — ומכאן אפשר להחזיר אותו לתור.",
    };
  }

  /* ── תצוגה ───────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      {/*
        הכותרת — בטלפון היא כבר בסרגל העליון, ולכן שם היא רק לקוראי מסך
        (`max-lg:sr-only`), והמשפט שמתחתיה נשאר גלוי בכל רוחב.
      */}
      <header className="mb-4">
        <div className="flex flex-wrap items-baseline gap-x-3 max-lg:sr-only">
          <h1 className="font-display text-2xl font-bold leading-tight">לידים שפוספסו</h1>
          {grandTotal !== null && (
            <span className="nums text-sm font-semibold text-ink-3">{number(grandTotal)}</span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-3">
          <span>
            <span className="nums font-semibold text-ink-1">{number(competitorCount)}</span> עברו
            למתחרה
          </span>
          <Dot />
          <span>
            <span className="nums font-semibold text-ink-1">{number(noDealCount)}</span> נסגרו
            בלי עסקה
          </span>
          <Dot />
          <span>
            {counts.stuck === null ? (
              <Pulse />
            ) : (
              <span className="nums font-semibold text-ink-1">{number(counts.stuck)}</span>
            )}{" "}
            תקועים בתור
          </span>
        </p>
      </header>

      {/*
        שלוש הקבוצות — צ'יפים בסגנון המקור, עם מונה. `flex-wrap` ולא
        גלילה: שלושה צ'יפים כמעט נכנסים ב-360px, וצ'יפ שמסתתר מעבר לקצה
        הוא קבוצה שלא יודעים שקיימת.
      */}
      <div role="group" aria-label="קבוצת לידים" className="flex flex-wrap gap-2">
        {GROUPS.map((g) => {
          const on = g.key === tab;
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => selectTab(g.key)}
              className={chip(on)}
            >
              {g.title}
              <Count value={counts[g.key]} on={on} />
            </button>
          );
        })}
      </div>
      <p className="mb-4 mt-2 text-xs text-ink-3">{GROUP_BY_KEY[tab].hint}</p>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {tab === "noDeal" && (noDealCount > 0 || reason !== null) ? (
          /*
            פילוח לפי סיבה — עד שישה צ'יפים, ולכן רצועה נגללת.
            ⚠️ `scroll-x-cue`: בטלפון פס הגלילה מרחף ומופיע רק תוך כדי
            גלילה, ובלי הצל אין שום סימן שיש עוד סיבות מעבר לקצה.
          */
          <div
            role="group"
            aria-labelledby={reasonLabelId}
            className="scroll-thin scroll-x-cue -mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 pb-0.5"
          >
            <span id={reasonLabelId} className="me-1 shrink-0 text-xs font-medium text-ink-3">
              פילוח לפי סיבה
            </span>
            <button
              type="button"
              aria-pressed={reason === null}
              onClick={() => selectReason(null)}
              className={chip(reason === null)}
            >
              כל הסיבות
              <Count value={noDealCount} on={reason === null} />
            </button>
            {reasonChips.map(({ status, count }) => {
              const on = status === reason;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={on}
                  onClick={() => selectReason(status)}
                  className={chip(on)}
                >
                  {STATUS_CONFIG[status].label}
                  <Count value={count} on={on} />
                </button>
              );
            })}
          </div>
        ) : (
          <span className="hidden lg:block" />
        )}

        <div className="relative shrink-0 lg:w-72">
          <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ink-3">
            <Icon name="search" size={16} />
          </span>
          {/* `inputClass` נושא את `text-base lg:text-sm` — בלי 16px ספארי
              מזיים את העמוד ולא חוזר */}
          <input
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) changeQuery("");
            }}
            placeholder="חיפוש לפי שם או טלפון"
            aria-label="חיפוש לפי שם או טלפון"
            enterKeyHint="search"
            autoComplete="off"
            className={`${inputClass} ps-8 ${query ? "pe-10" : ""}`}
          />
          {query && (
            <span className="absolute inset-y-0 end-1.5 flex items-center">
              {/* `after:-inset-2.5` מרחיב את אזור הלחיצה ל-44px בלי לשנות
                  את הפריסה */}
              <button
                type="button"
                onClick={() => changeQuery("")}
                aria-label="ניקוי החיפוש"
                title="ניקוי החיפוש"
                className="relative rounded-md p-1 text-ink-3 transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95 active:bg-surface-3"
              >
                <Icon name="close" size={16} />
              </button>
            </span>
          )}
        </div>
      </div>

      <section aria-labelledby={listTitleId}>
        <h2 id={listTitleId} className="sr-only">
          {GROUP_BY_KEY[tab].title}
        </h2>

        {/* קיים תמיד ולא רק כשיש חיפוש: אזור חי שנוצר יחד עם התוכן שלו
            לא מוקרא */}
        <p
          role="status"
          className={hasQuery && matches && matches.length > 0 ? "mb-2 text-xs text-ink-3" : "sr-only"}
        >
          {hasQuery && matches ? `נמצאו ${number(matches.length)}` : ""}
        </p>

        {matches === null ? (
          <>
            <p className="sr-only">בודק אילו לידים תקועים…</p>
            <ul aria-hidden="true" className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <MissedLeadCardSkeleton key={i} />
              ))}
            </ul>
          </>
        ) : matches.length === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState {...emptyState()} />
          </div>
        ) : (
          /*
            `key` לפי לשונית: רשימה חדשה נכנסת בתנועה קצרה, וכך ברור
            שהתוכן התחלף גם כשהכרטיסים הראשונים נראים דומים.
          */
          <ul
            key={tab}
            className="animate-rise grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3"
          >
            {matches.slice(0, limit).map((e) => (
              <MissedLeadCard
                key={e.row.id}
                row={e.row}
                stuck={e.stuck}
                today={today}
                busy={busyId === e.row.id}
                onReturn={() => setTarget(e.row)}
              />
            ))}
          </ul>
        )}

        {matches && matches.length > limit && (
          <div className="mt-4 flex justify-center">
            <Button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              הצג עוד {number(Math.min(PAGE_SIZE, matches.length - limit))}
              <span className="nums font-normal text-ink-3">
                · נשארו {number(matches.length - limit)}
              </span>
            </Button>
          </div>
        )}

        {capped && (
          <p className="mt-3 text-center text-xs text-ink-3">
            מוצגות {number(loaded)} סגירות מתוך {number(total)} — הלידים החמים והאחרונים
            קודם. החיפוש מכסה רק אותן; ליד ישן יותר נמצא במסך הלידים.
          </p>
        )}
      </section>

      {/* ה-key מאפס את שדה הפירוט בין לידים */}
      <StatusDialog
        key={target ? `return:${target.id}` : "return:none"}
        target={target ? { leadIds: [target.id], to: "returning" } : null}
        onCancel={() => setTarget(null)}
        onConfirm={confirmReturn}
        busy={pending}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ── חלקים ─────────────────────────────────────────────────────────────── */

/** מונה בתוך צ'יפ. לפני ההרכבה ("תקועים") — שלד בגודל המספר, לא "0". */
function Count({ value, on }: { value: number | null; on: boolean }) {
  if (value === null) return <Pulse />;
  return (
    <span className={`nums text-xs ${on ? "text-on-brand/85" : "text-ink-3"}`}>
      {number(value)}
    </span>
  );
}

function Pulse() {
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block h-3 w-5 animate-pulse rounded bg-current align-middle opacity-20"
      />
      <span className="sr-only">מחשב…</span>
    </>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-ink-4">
      ·
    </span>
  );
}

/**
 * חיפוש בשם או בטלפון. `null` = אין חיפוש.
 *
 * מחרוזת שכולה ספרות ומפרידים היא טלפון, ומושווית בספרות בלבד — כך
 * "050-12" ו-"05012" מוצאים את אותו ליד, וגם "97250…" שהודבק מוואטסאפ.
 * כל דבר אחר הוא שם.
 */
function matcher(query: string): ((row: MissedLeadRow) => boolean) | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;

  if (/^[\d\s()+-]+$/.test(text)) {
    const digits = text.replace(/\D/g, "");
    if (!digits) return null;
    return (row) =>
      row.phone.replace(/\D/g, "").includes(digits) || toE164(row.phone).includes(digits);
  }

  return (row) => row.name.toLowerCase().includes(text);
}

function kindRank(row: MissedLeadRow): number {
  return row.kind === "hot" ? 0 : 1;
}
