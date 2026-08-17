"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type {
  Deal,
  Lead,
  LeadCostTable,
  LeadStatus,
  Package,
  UserRef,
} from "@/lib/domain/types";
import {
  PRIORITY_CONFIG,
  PROVIDER_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/lib/domain/types";
import {
  assignAction,
  changeStatusManyAction,
  patchLeadAction,
  type LeadPatch,
  deleteLeadsAction,
  setLeadCostAction,
  toggleStarAction,
} from "@/app/(app)/leads/actions";
import { useNow } from "@/lib/clock";
import { useIsNarrow } from "@/lib/media";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  leadCost,
  payableCommission,
  performanceByAgent,
  totalLeadCostForLeads,
} from "@/server/services/economics";
import {
  Button,
  Modal,
  ToastStack,
  inputClass,
  type Toast,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { LeadCostsModal } from "@/components/settings/LeadCostsModal";
import { LeadsFinancePanel } from "./LeadsFinancePanel";
import { LeadsPerformancePanel } from "./LeadsPerformancePanel";
import { leadsCsvFilename, leadsToCsvRows } from "./leadsCsv";
import { QueueHeader } from "./QueueHeader";
import { FilterBar, type Filters, EMPTY_FILTERS } from "./FilterBar";
import { INITIAL_FILTERS, isOpeningStatus } from "./views";
import { LeadsTable } from "./LeadsTable";
import { LeadCardList } from "./LeadCardList";
import { LeadsMoreSheet } from "./LeadsMoreSheet";
import { StatusTiles } from "./StatusTiles";
import { Pagination, PAGE_SIZES } from "./Pagination";
import { ColumnPicker } from "./ColumnPicker";
import { setVisibleColumns, useVisibleColumns } from "./columns";
import { LeadDrawer } from "./LeadDrawer";
import { AddLeadModal } from "./AddLeadModal";
import { EditLeadModal } from "./EditLeadModal";
import { ImportLeadsModal } from "./ImportLeadsModal";
import { StatusDialog } from "./StatusDialog";

/**
 * מחזיק את כל המצב של מסך הלידים ומעביר נתונים לילדים פרזנטציוניים.
 *
 * הנגזרות (filtered → sorted) הן שרשרת useMemo. נגזרת חדשה מצטרפת
 * לשרשרת ולא מחושבת אד-הוק בתוך הרינדור.
 */

/**
 * כל כמה זמן למשוך לידים חדשים. דקה — מספיק צמוד לליד שנכנס מהאתר,
 * ורחוק מספיק כדי שלא ייצור עומס DB מיותר על מסך שפתוח כל היום.
 */
const AUTO_REFRESH_MS = 60_000;

export type SortField =
  /** תור העבודה: באיחור/להיום → חדשים → כל השאר. ראה `sorted`. */
  | "queue"
  | "updatedAt"
  | "createdAt"
  | "name"
  | "priority"
  | "status"
  | "followUpAt";

export function LeadsClient({
  leads,
  users,
  counts,
  leadCosts,
  deals,
  packages,
  currentUserId,
  canSeeAll,
  canEditCosts,
  periodPicker,
}: {
  leads: Lead[];
  users: UserRef[];
  counts: Record<LeadStatus, number>;
  leadCosts: LeadCostTable;
  deals: Deal[];
  packages: Package[];
  currentUserId: string;
  /**
   * האם המשתמש רואה את כל הלידים בארגון.
   *
   * ⚠️ זה **לא** מנגנון ההרשאה — ההגבלה נאכפת בשליפה ב-`page.tsx`,
   * ולידים של אחרים לא מגיעים לכאן מלכתחילה. הדגל הזה משמש רק
   * להסתרת פקדים שאין להם משמעות בחתך אישי.
   */
  canSeeAll: boolean;
  /**
   * האם המשתמש רשאי לערוך את עלויות רכישת הלידים.
   *
   * ⚠️ נוחות תצוגה בלבד, בדיוק כמו `canSeeAll`. מה שבאמת חוסם הוא
   * `canManageSettings` בתוך `saveLeadCostsAction` — Server Action היא
   * נקודת קצה HTTP, והסתרת הכפתור לא מונעת קריאה ישירה אליה.
   */
  canEditCosts: boolean;
  /**
   * בורר התקופה, מרונדר בשרת ומוזרק כ-slot.
   *
   * ⚠️ slot ולא רכיב שנבנה כאן: הטווח נקבע ב-`page.tsx` **לפני**
   * השליפה — הוא חותך גם את `leads` וגם את `counts`. אילו הבורר היה
   * יושב בלקוח, הוא היה מסנן מחדש נתונים שכבר הגיעו חתוכים, והמספר
   * שבריבוע היה מפסיק להתאים לטבלה.
   */
  periodPicker?: React.ReactNode;
}) {
  // המסך נפתח על הלידים החדשים בלבד — ראה `INITIAL_FILTERS`
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  // ברירת המחדל היא תור העבודה — מה שדחוף היום צף למעלה בלי
  // שהמשתמש יבחר מיון. הכיוון לא משפיע על "queue" (הסדר קבוע).
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "queue",
    dir: "desc",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[2]);

  /** נקרא מחנות חיצונית — ראה columns.ts. */
  const visibleColumns = useVisibleColumns();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // מכווצים כברירת מחדל — שני הפאנלים האלה תפסו כל כך הרבה גובה
  // שהטבלה עצמה נדחקה מתחת לגלילה הראשונה
  const [statsOpen, setStatsOpen] = useState(false);
  /** גיליון "כל הסטטוסים" — קיים רק במסך צר, ראה StatusTiles */
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  /** גיליון ה-`⋯` — ייבוא/ייצוא/פיננסי/בחירה, ראה LeadsMoreSheet */
  const [moreOpen, setMoreOpen] = useState(false);
  /**
   * מצב בחירה מרובה בתצוגת הכרטיסים. יושב כאן ולא ב-`LeadCardList`
   * כי מי שמדליק אותו הוא גיליון ה-`⋯`, שהוא אח שלה ולא ילד.
   */
  const [selecting, setSelecting] = useState(false);
  /**
   * לידים שממתינים לאישור מחיקה קבוצתית; null = אין בקשה פתוחה.
   * מחיקה בודדת מהמגירה לא עוברת כאן — יש לה אישור דו-שלבי משלה.
   */
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);

  /** מסך צר = תצוגת כרטיסים במקום טבלה */
  const narrow = useIsNarrow();
  const [statusTarget, setStatusTarget] = useState<{
    leadIds: string[];
    to: LeadStatus;
  } | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const toastId = useRef(0);
  const notify = useCallback((message: string, tone: Toast["tone"] = "good") => {
    toastId.current += 1;
    setToasts((t) => [...t, { id: toastId.current, message, tone }]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  /* ── עטיפות מוטציה: שגיאות ועסוק-פר-ליד ──────────────────────────── */

  /**
   * הלידים שמוטציה רצה עליהם כרגע. פעולה על שורה אחת מנטרלת רק את
   * השורה הזו — לא את כל הטבלה — כך שאפשר להמשיך לעבוד על לידים
   * אחרים בזמן שהשמירה באוויר. פעולות קבוצתיות (FilterBar, מחיקה
   * מרובה) ממשיכות להשתמש ב-`pending` הגלובלי.
   */
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  /**
   * ה-server actions זורקים — לא מחזירים `{ok:false}` — כשהסשן פג
   * או שה-DB לא זמין. בלי ה-catch הזה השגיאה הייתה נבלעת בשקט בתוך
   * ה-transition והמשתמש היה בטוח שהשינוי נשמר.
   */
  async function guarded(fn: () => Promise<void>) {
    try {
      await fn();
    } catch {
      notify("השמירה נכשלה — בדוק את החיבור ונסה שוב", "bad");
    }
  }

  /** מסמן את הלידים כעסוקים למשך המוטציה, ומשחרר תמיד — גם על שגיאה. */
  async function withBusy(ids: string[], fn: () => Promise<void>) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    try {
      await guarded(fn);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  /**
   * שכבה אופטימית (React 19): השינוי נצבע מיד על המסך, לפני שהשרת
   * ענה. כשה-transition מסתיים השכבה מתאפסת — אם השרת הצליח,
   * `leads` המרוענן כבר מכיל את השינוי; אם נכשל, התצוגה חוזרת לבד
   * לערך האמיתי והטוסט של `guarded` מסביר מה קרה.
   * חובה לקרוא ל-`applyOptimistic` בתוך transition (וכך אנחנו עושים).
   */
  const [optimisticLeads, applyOptimistic] = useOptimistic(
    leads,
    (state, p: { ids: string[]; patch: Partial<Lead> }) =>
      state.map((l) => (p.ids.includes(l.id) ? { ...l, ...p.patch } : l)),
  );

  /* ── רענון אוטומטי ───────────────────────────────────────────────── */

  /**
   * לידים נכנסים מבחוץ (`POST /api/leads`) בלי שהדפדפן יודע על כך,
   * ובלי רענון המסך היה נשאר תקוע עד שמישהו מרענן ידנית.
   *
   * `router.refresh()` מושך מחדש רק את רכיב השרת — מצב הלקוח (מסננים,
   * בחירה, מיון, מודלים פתוחים) שורד. לכן אין כאן חסימה בזמן עריכה.
   */
  const router = useRouter();
  const knownLeadIds = useRef<Set<string> | null>(null);
  const awaitingPoll = useRef(false);
  /** מתי רועננו לאחרונה — מרסן את רענון-החזרה-ללשונית שלמטה. */
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    function pull() {
      awaitingPoll.current = true;
      lastRefreshAt.current = Date.now();
      router.refresh();
    }

    const timer = setInterval(() => {
      // לשונית ברקע לא צריכה נתונים טריים — וגם לא קריאות DB
      if (!document.hidden) pull();
    }, AUTO_REFRESH_MS);

    // חזרה ללשונית מרעננת מיד ולא מחכה לטיק הבא: מסך שהיה מוסתר
    // חצי שעה מציג נתונים בני חצי שעה, וזו בדיוק הנקודה שבה מסתכלים.
    //
    // אבל לא על כל חזרה: המעבר הנפוץ ביותר הוא יציאה לשיחת `tel:`
    // וחזרה אחרי שניות — רענון בכל חזרה כזו היה יורה קריאת DB מיותרת
    // (ומהבהב את המסך) עשרות פעמים ביום. אם רועננו ב-30 השניות
    // האחרונות, מדלגים.
    function onVisible() {
      if (document.hidden) return;
      if (Date.now() - lastRefreshAt.current < 30_000) return;
      pull();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    const previous = knownLeadIds.current;
    knownLeadIds.current = new Set(leads.map((l) => l.id));

    // ההשוואה הראשונה היא רק לבניית הבסיס. `awaitingPoll` מבדיל בין
    // ליד שנכנס מבחוץ לבין ליד שהמשתמש עצמו יצר — על יצירה ידנית יש
    // כבר טוסט משלה, וטוסט שני היה כפילות.
    if (!previous || !awaitingPoll.current) return;
    awaitingPoll.current = false;

    const added = leads.filter((l) => !previous.has(l.id)).length;
    if (added > 0) {
      notify(added === 1 ? "נכנס ליד חדש" : `נכנסו ${added} לידים חדשים`);
    }
  }, [leads, notify]);

  /* ── קיצורי מקלדת ────────────────────────────────────────────────── */

  /**
   * כשמשהו פתוח מעל המסך, הקיצורים כבויים: `n` בזמן מגירה פתוחה היה
   * פותח מודל מעל מודל, ו-`/` היה ממקד חיפוש שמוסתר מאחורי המגירה.
   */
  const overlayOpen =
    addOpen ||
    editOpen ||
    importOpen ||
    costsOpen ||
    statusSheetOpen ||
    moreOpen ||
    statusTarget !== null ||
    openLeadId !== null ||
    deleteTarget !== null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overlayOpen) return;
      // קיצור עם modifier הוא של הדפדפן (Ctrl+N = חלון חדש) — לא שלנו
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
        return;
      if (el.isContentEditable) return;

      // `e.code` ולא `e.key` — בפריסת מקלדת עברית המקש הזה פולט "מ",
      // ו-`e.key === "n"` פשוט לא היה יורה אף פעם
      if (e.code === "KeyN") {
        e.preventDefault();
        setAddOpen(true);
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlayOpen]);

  /* ── נגזרות ──────────────────────────────────────────────────────── */

  // סוף היום הנוכחי. null עד שהלקוח נרשם — לכן הסינון לפי תאריך
  // חזרה מתחיל לפעול רק בלקוח, ולא יוצר אי-התאמת הידרציה.
  const now = useNow();
  const endOfToday = useMemo(() => {
    if (now === null) return null;
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, [now]);

  // ⚠️ מעל `matched` ולא ליד שאר המפות: החיפוש קורא ממנו את שם העובד
  // המשויך, ו-`const` שמוצהר אחרי השימוש נופל ב-TDZ בזמן הרינדור
  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  // התצוגה כולה נגזרת מהשכבה האופטימית — כך שינוי סטטוס/עדיפות/כוכב
  // נראה מיד, עוד לפני שהשרת אישר
  const matched = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    /*
      ⚠️ חיפוש מבטל את **ברירת הפתיחה** של הסטטוס, לא בחירה מפורשת.

      המסך נפתח מסונן ל"חדשים". בלי השורה הזו, חיפוש שם של לקוח או של
      עובד היה מחזיר אפס תוצאות בכל ליד שכבר טופל — כלומר כמעט תמיד,
      ובלי שום רמז למה. לחיצה על אריח סטטוס לעומת זאת היא כן בחירה,
      והיא נשמרת גם תוך כדי חיפוש.
    */
    const status = q && isOpeningStatus(filters.status) ? [] : filters.status;

    return optimisticLeads.filter((lead) => {
      if (filters.dueToday) {
        if (endOfToday === null) return false;
        if (!lead.followUpAt) return false;
        if (Date.parse(lead.followUpAt) > endOfToday) return false;
      }

      if (status.length && !status.includes(lead.status)) return false;
      if (filters.kind.length && !filters.kind.includes(lead.kind)) return false;
      if (filters.priority.length && !filters.priority.includes(lead.priority))
        return false;
      if (
        filters.category.length &&
        (!lead.category || !filters.category.includes(lead.category))
      )
        return false;

      if (filters.assignee.length) {
        const key = lead.assigneeId ?? "unassigned";
        if (!filters.assignee.includes(key)) return false;
      }

      if (filters.starred && !lead.isStarred) return false;

      if (q) {
        /*
          החיפוש מכסה גם את מה שכתוב על הכרטיס עצמו: חבילה, ספק, מקור
          והערות. קודם הוא היה שם/טלפון/מייל/עיר בלבד — כלומר חיפוש
          "ULTIMATE" או "פלאפון" החזיר אפס תוצאות בזמן שהמילה הזו
          מוצגת על המסך.
        */
        const provider = lead.currentProvider
          ? PROVIDER_CONFIG[lead.currentProvider].label
          : "";

        /*
          ⚠️ שם העובד המשויך הוא חלק מהחיפוש.

          "תראה לי את הלידים של ניב" היא שאלה יומיומית, והדרך היחידה
          לענות עליה הייתה מסנן השיוך — שלוש לחיצות בתפריט. הקלדת שם
          בתיבת החיפוש היא מה שכולם מנסים קודם.

          זה מרחיב את החיפוש ולא מצר אותו: ליד עם אותה מילה בשם או
          בהערות ימשיך להימצא בדיוק כמו קודם.
        */
        const assignee = lead.assigneeId
          ? (userById.get(lead.assigneeId)?.name ?? "")
          : "";

        const haystack = [
          lead.name,
          lead.phone,
          lead.email ?? "",
          lead.city ?? "",
          lead.packageName ?? "",
          provider,
          lead.sourceDetail ?? "",
          assignee,
          lead.notes.map((n) => n.body).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [optimisticLeads, filters, endOfToday, userById]);

  /**
   * `matched` + שער הסטטוסים הסגורים.
   *
   * ⚠️ נגזרת נפרדת ולא שורה בתוך `matched`, כי **הפאנל הפיננסי חייב
   * לראות את הסגורים.** "נסגר בהצלחה" הוא סטטוס סופי, ולכן שער שחל על
   * כל השרשרת היה מאפס את העמלות בכל טעינת מסך — מספר שגוי שנראה
   * לגמרי תקין. העלויות והעמלות נחשבות על `matched`, הטבלה על `filtered`.
   *
   * ⚠️ שני פתחים מכבים את השער לגמרי:
   *   • **בחירת סטטוס מפורשת** — לחיצה על אריח "הפסד" חייבת להראות
   *     הפסדים, אחרת האריח מחזיר מסך ריק.
   *   • **חיפוש חופשי** — מי שמחפש לקוח בשם מחפש אותו, לא את הסטטוס
   *     שלו. ליד סגור שלא נמצא בחיפוש הוא ליד שנמחק, מבחינת המשתמש.
   */
  const filtered = useMemo(() => {
    if (!filters.openOnly) return matched;
    if (filters.status.length || filters.query.trim()) return matched;
    return matched.filter((lead) => !STATUS_CONFIG[lead.status].terminal);
  }, [matched, filters.openOnly, filters.status, filters.query]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;

    /**
     * דירוג "תור העבודה": 0 — תאריך החזרה הגיע (באיחור או היום),
     * 1 — ליד חדש שטרם טופל, 2 — כל השאר. לפני ההרכבה אין "היום"
     * (`endOfToday === null`) ולכן אין קבוצה 0 — ראה מקרה "queue".
     */
    const queueRank = (l: Lead): number => {
      if (
        endOfToday !== null &&
        l.followUpAt &&
        Date.parse(l.followUpAt) <= endOfToday
      )
        return 0;
      if (l.status === "new") return 1;
      return 2;
    };

    return [...filtered].sort((a, b) => {
      switch (sort.field) {
        case "queue": {
          // בשרת ולפני ההרכבה אין שעון — נופלים למיון "עודכן לאחרונה"
          // בלבד, זהה בשני הצדדים, בלי אי-התאמת הידרציה
          if (endOfToday === null)
            return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

          const ra = queueRank(a);
          const rb = queueRank(b);
          if (ra !== rb) return ra - rb;
          // בתוך קבוצה 0: החזרה המוקדמת ביותר קודם (הכי באיחור למעלה)
          if (ra === 0)
            return Date.parse(a.followUpAt!) - Date.parse(b.followUpAt!);
          // בתוך קבוצה 1: החדש ביותר קודם
          if (ra === 1)
            return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          // קבוצה 2: העדכני ביותר קודם. הכיוון (dir) לא חל על התור —
          // "תור הפוך" הוא לא סדר שמישהו מתכוון אליו
          return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        }
        case "name":
          return a.name.localeCompare(b.name, "he") * dir;
        case "priority":
          return (
            (PRIORITY_CONFIG[a.priority].weight - PRIORITY_CONFIG[b.priority].weight) * dir
          );
        case "status":
          return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir;
        case "followUpAt": {
          // לידים בלי תאריך חזרה תמיד בסוף, בשני הכיוונים — אחרת מיון
          // "מה הכי דחוף" היה מתחיל ברשימת הלידים שאין להם תאריך בכלל
          const av = a.followUpAt ? Date.parse(a.followUpAt) : null;
          const bv = b.followUpAt ? Date.parse(b.followUpAt) : null;
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (av - bv) * dir;
        }
        default:
          return (Date.parse(a[sort.field]) - Date.parse(b[sort.field])) * dir;
      }
    });
  }, [filtered, sort, endOfToday]);

  /**
   * העמוד מוגבל בזמן הרינדור ולא מאופס באפקט. אם התוצאה התכווצה
   * מתחת לעמוד הנוכחי, מציגים את האחרון הקיים במקום עמוד ריק.
   */
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);

  /**
   * העמוד הנוכחי בלבד. `sorted` נשאר מקור האמת לכל השאר — ייצוא,
   * ספירות, ובחירה — כדי שמעבר עמוד לא ישנה את משמעות אף פעולה.
   */
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  /** נבדק לפי תוכן ולא לפי זהות אובייקט — מסנן שנוקה חייב להיקרא "ריק". */
  const hasActiveFilters = useMemo(
    () =>
      filters.query.trim() !== "" ||
      // ⚠️ שונה מברירת המחדל, לא "דלוק". `openOnly` דולק מלכתחילה,
      // ולכן בדיקה נאיבית הייתה מכריזה שכל מסך הוא "מסונן" — כולל
      // מסך פתיחה נקי, שאז היה מציג מצב ריק שגוי במקום "אין לידים".
      filters.openOnly !== EMPTY_FILTERS.openOnly ||
      filters.dueToday ||
      filters.starred ||
      filters.status.length > 0 ||
      filters.kind.length > 0 ||
      filters.priority.length > 0 ||
      filters.category.length > 0 ||
      filters.assignee.length > 0,
    [filters],
  );

  // גם המגירה קוראת מהשכבה האופטימית — אחרת שינוי מתוכה היה נראה
  // בטבלה אבל לא במגירה עצמה
  const openLead = useMemo(
    () => optimisticLeads.find((l) => l.id === openLeadId) ?? null,
    [optimisticLeads, openLeadId],
  );


  /* ── כספים על החתך המוצג ─────────────────────────────────────────── */

  const catalog = useMemo(
    () => new Map(packages.map((p) => [p.id, p])),
    [packages],
  );

  /**
   * רק העסקאות שנסגרו מלידים שנמצאים בחתך הנוכחי.
   *
   * ⚠️ `matched` ולא `sorted` — ראה ההערה על `filtered`. עסקה נסגרת
   * מליד שסטטוסו "נסגר בהצלחה", כלומר סטטוס סופי; אילו זה היה נגזר
   * מהרשימה המוצגת, ההכנסות היו נעלמות מהמסך ברגע שהסגורים ירדו ממנו.
   */
  const dealsForLeads = useMemo(() => {
    const ids = new Set(matched.map((l) => l.id));
    return deals.filter((d) => ids.has(d.leadId));
  }, [deals, matched]);

  const finance = useMemo(
    () => ({
      cost: totalLeadCostForLeads(matched, leadCosts),
      commission: dealsForLeads.reduce(
        (sum, d) => sum + payableCommission(d.packageIds, catalog),
        0,
      ),
    }),
    [matched, leadCosts, dealsForLeads, catalog],
  );

  const performance = useMemo(
    () => performanceByAgent(dealsForLeads, catalog, leadCosts),
    [dealsForLeads, catalog, leadCosts],
  );

  // בחירות שנעלמו מהסינון לא צריכות להישאר "נבחרות" בשקט
  const visibleSelected = useMemo(() => {
    const visible = new Set(sorted.map((l) => l.id));
    return [...selected].filter((id) => visible.has(id));
  }, [selected, sorted]);

  /* ── פעולות ──────────────────────────────────────────────────────── */

  // כל דבר שמשנה אילו שורות מוצגות מחזיר לעמוד הראשון. באירוע ולא
  // באפקט — אחרת זה רינדור נוסף בכל שינוי סינון.
  function applyFilters(next: Filters) {
    setFilters(next);
    setPage(1);
  }

  function applySort(next: { field: SortField; dir: "asc" | "desc" }) {
    setSort(next);
    setPage(1);
  }

  function applyPageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  /**
   * פותח דיאלוג פירוט אם הסטטוס דורש אחד, אחרת מחיל ישירות.
   *
   * `skipDialog` מדלג על הדיאלוג גם כשיש שאלה — אבל **רק** אם היא
   * לא חובה. זה מה שהופך "אין מענה" מהכרטיס ללחיצה אופטימית אחת,
   * בלי לפתוח פרצה בסטטוסים שהפירוט בהם הוא חובה.
   */
  function requestStatus(
    leadIds: string[],
    to: LeadStatus,
    opts?: { skipDialog?: boolean },
  ) {
    const prompt = STATUS_CONFIG[to].prompt;
    if (prompt && !(opts?.skipDialog && !prompt.required)) {
      setStatusTarget({ leadIds, to });
      return;
    }
    applyStatus(leadIds, to);
  }

  function applyStatus(
    leadIds: string[],
    to: LeadStatus,
    detail?: string,
    followUpDate?: string,
  ) {
    startTransition(async () => {
      // לפני ה-await — הסטטוס החדש נצבע מיד; אם השרת ייכשל השכבה
      // האופטימית תתאפס לבד בסוף ה-transition
      applyOptimistic({ ids: leadIds, patch: { status: to } });

      await withBusy(leadIds, async () => {
        const res = await changeStatusManyAction(leadIds, to, detail, followUpDate);
        if (!res.ok) return notify(res.error, "bad");

        setStatusTarget(null);

        const { updated, failed } = res.data!;
        const label = STATUS_CONFIG[to].label;

        // הצלחה חלקית היא תוצאה אמיתית ולא שגיאה — הדיווח אומר בדיוק
        // מה קרה, כדי שהמשתמש לא ינסה שוב ויכפיל את מה שכבר הצליח
        if (failed > 0) {
          notify(`${updated} עודכנו ל"${label}", ${failed} נכשלו`, "warn");
        } else {
          notify(
            updated === 1
              ? `הסטטוס עודכן ל"${label}"`
              : `${updated} לידים עודכנו ל"${label}"`,
          );
        }
      });
    });
  }

  function assign(leadIds: string[], assigneeId: string | null) {
    startTransition(async () => {
      applyOptimistic({
        ids: leadIds,
        patch: { assigneeId: assigneeId ?? undefined },
      });

      await withBusy(leadIds, async () => {
        const res = await assignAction(leadIds, assigneeId);
        if (!res.ok) return notify(res.error, "bad");

        const name = assigneeId ? userById.get(assigneeId)?.name : null;
        notify(name ? `שויך ל${name}` : "השיוך הוסר");
        // מנקים רק את הלידים שפעלנו עליהם — שיוך בודד מהמגירה לא
        // צריך למחוק בחירה מרובה שנבנתה בטבלה
        setSelected((prev) => {
          const next = new Set(prev);
          leadIds.forEach((id) => next.delete(id));
          return next;
        });
      });
    });
  }

  function setCost(leadId: string, cost: number | null) {
    startTransition(async () => {
      await withBusy([leadId], async () => {
        const res = await setLeadCostAction(leadId, cost);
        if (!res.ok) return notify(res.error, "bad");
        notify(cost === null ? "העלות אופסה לברירת המחדל" : "העלות עודכנה");
      });
    });
  }

  /**
   * עריכה מהירה של שדה בודד מתוך השורה.
   *
   * בלי טוסט הצלחה בכוונה: השינוי נראה מיד בתא עצמו, וטוסט על כל
   * שינוי עדיפות היה מציף את המסך. שגיאה כן מדווחת — אותה אי אפשר
   * לראות בתא.
   */
  function patchLead(leadId: string, patch: LeadPatch) {
    startTransition(async () => {
      // תרגום `LeadPatch` (צורת ה-action) לשדות `Lead` (צורת התצוגה):
      // `null` פירושו "נקה את השדה", וב-`Lead` שדה נקי הוא `undefined`
      const optimistic: Partial<Lead> = {};
      if (patch.priority !== undefined) optimistic.priority = patch.priority;
      if (patch.kind !== undefined) optimistic.kind = patch.kind;
      if (patch.category !== undefined)
        optimistic.category = patch.category ?? undefined;
      if (patch.assigneeId !== undefined)
        optimistic.assigneeId = patch.assigneeId ?? undefined;
      if (patch.followUpDate !== undefined)
        optimistic.followUpAt = patch.followUpDate ?? undefined;
      applyOptimistic({ ids: [leadId], patch: optimistic });

      await withBusy([leadId], async () => {
        const res = await patchLeadAction(leadId, patch);
        if (!res.ok) notify(res.error, "bad");
      });
    });
  }

  function toggleStar(leadId: string, next: boolean) {
    startTransition(async () => {
      applyOptimistic({ ids: [leadId], patch: { isStarred: next } });

      await withBusy([leadId], async () => {
        const res = await toggleStarAction(leadId, next);
        if (!res.ok) notify(res.error, "bad");
      });
    });
  }

  /** מייצא את כל מה שתואם לסינון, לא רק את מה שנראה על המסך. */
  function exportCsv() {
    downloadCsv(
      leadsCsvFilename(),
      toCsv(leadsToCsvRows(sorted, userById, leadCosts, canSeeAll)),
    );
    notify(`${sorted.length} לידים יוצאו`);
  }

  // בכוונה בלי שכבה אופטימית: מחיקה שנעלמת ואז "קופצת חזרה" על כישלון
  // מבלבלת יותר מספינר קצר
  function remove(leadIds: string[]) {
    startTransition(async () => {
      await withBusy(leadIds, async () => {
        const res = await deleteLeadsAction(leadIds);
        if (!res.ok) return notify(res.error, "bad");

        notify(leadIds.length === 1 ? "הליד נמחק" : `${leadIds.length} לידים נמחקו`);
        setSelected(new Set());
        setOpenLeadId(null);
      });
    });
  }

  /* ── תצוגה ───────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
      {periodPicker}

      <QueueHeader
        counts={counts}
        total={leads.length}
        showing={sorted.length}
        onAdd={() => setAddOpen(true)}
        onExport={exportCsv}
        onImport={() => setImportOpen(true)}
        onToggleStats={() => setStatsOpen((v) => !v)}
        statsOpen={statsOpen}
        filters={filters}
        onFiltersChange={applyFilters}
        currentUserId={currentUserId}
        canSeeAll={canSeeAll}
        compact={narrow}
        onExpandStatuses={() => setStatusSheetOpen(true)}
      />

      {statsOpen && (
        <div className="mb-3">
          <LeadsFinancePanel
            cost={finance.cost}
            commission={finance.commission}
            onEditCosts={canEditCosts ? () => setCostsOpen(true) : undefined}
          />
          <LeadsPerformancePanel rows={performance} userById={userById} />
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={applyFilters}
        users={users}
        searchRef={searchRef}
        selectedCount={narrow ? 0 : visibleSelected.length}
        onBulkAssign={(id) => assign(visibleSelected, id)}
        onBulkStatus={(to) => requestStatus(visibleSelected, to)}
        onBulkDelete={() => setDeleteTarget(visibleSelected)}
        onClearSelection={() => setSelected(new Set())}
        columnPicker={
          // בורר העמודות הוא כלי של הטבלה בלבד — לכרטיס אין עמודות
          narrow ? undefined : (
            <ColumnPicker
              visible={visibleColumns}
              onChange={setVisibleColumns}
              canSeeAll={canSeeAll}
            />
          )
        }
        overflow={
          narrow ? (
            <div className="flex shrink-0 items-center gap-2">
              {/*
                בטלפון אין כותרות עמודה ללחוץ עליהן — זה פקד המיון
                היחיד. "תור עבודה" הוא ברירת המחדל; הכיוון קבוע לכל
                אפשרות (שם עולה, תאריך חזרה עולה, השאר יורד) כי בורר
                כיוון נפרד היה מכפיל את הפקד בשביל מקרה שאיש לא צריך.
              */}
              <select
                value={sort.field}
                onChange={(e) => {
                  const field = e.target.value as SortField;
                  applySort({
                    field,
                    dir: field === "name" || field === "followUpAt" ? "asc" : "desc",
                  });
                }}
                aria-label="מיון"
                className={`${inputClass} min-h-11 w-auto`}
              >
                <option value="queue">תור עבודה</option>
                <option value="updatedAt">עודכן לאחרונה</option>
                <option value="createdAt">חדשים קודם</option>
                <option value="followUpAt">תאריך חזרה</option>
                <option value="name">שם</option>
              </select>
              <Button
                variant="secondary"
                onClick={() => setMoreOpen(true)}
                aria-label="פעולות נוספות"
                className="size-11 shrink-0 px-0"
              >
                <span aria-hidden className="text-lg leading-none">
                  ⋯
                </span>
              </Button>
            </div>
          ) : undefined
        }
        busy={pending}
      />

      {/*
        טבלה או כרטיסים — אחד מהם, לא שניהם עם `hidden`. רינדור כפול
        היה מכפיל 50 שורות × 11 תאים ואת כל ה-`<select>`-ים שבתוכן,
        דווקא על המכשיר החלש ביותר. ראה `useIsNarrow`.
      */}
      {narrow ? (
        <LeadCardList
          leads={paged}
          users={users}
          selected={selected}
          onSelectedChange={setSelected}
          busyIds={busyIds}
          onOpen={setOpenLeadId}
          onStatus={(id, to) => requestStatus([id], to)}
          onQuickStatus={(id, to) => requestStatus([id], to, { skipDialog: true })}
          onStar={toggleStar}
          onPatch={patchLead}
          onAdd={() => setAddOpen(true)}
          hasFilters={hasActiveFilters}
          onClearFilters={() => applyFilters(EMPTY_FILTERS)}
          canSeeAll={canSeeAll}
          /* דווקא visibleSelected ולא selected — פעולה קבוצתית חייבת
             לפגוע רק בלידים שהמשתמש רואה כרגע בחתך המסונן */
          onBulkAssign={(id) => assign(visibleSelected, id)}
          onBulkStatus={(to) => requestStatus(visibleSelected, to)}
          onBulkDelete={() => setDeleteTarget(visibleSelected)}
          selecting={selecting}
          onSelectingChange={setSelecting}
        />
      ) : (
        <LeadsTable
          leads={paged}
          userById={userById}
          leadCosts={leadCosts}
          visibleColumns={visibleColumns}
          selected={selected}
          onSelectedChange={setSelected}
          sort={sort}
          onSortChange={applySort}
          onOpen={setOpenLeadId}
          onStatus={(id, to) => requestStatus([id], to)}
          onCost={setCost}
          onStar={toggleStar}
          onPatch={patchLead}
          users={users}
          onAdd={() => setAddOpen(true)}
          hasFilters={hasActiveFilters}
          canSeeAll={canSeeAll}
          busyIds={busyIds}
        />
      )}

      {/*
        ⚠️ עימוד בטלפון הוחלף ב"טען עוד".

        פקדי העימוד היו הפקדים הקטנים ביותר באפליקציה — חצים של 26×26
        עם 4px ביניהם, ובורר גודל עמוד שדרס את הגופן חזרה ל-12px
        וגרם לספארי לזיים את העמוד בכל מיקוד. במסך שגוללים בו ממילא,
        "טען עוד" הוא גם הפקד הנכון וגם מוחק את שלושת הפגמים האלה.

        בשולחן העימוד נשאר כפי שהוא — שם הטבלה בגובה קבוע ודילוג
        לעמוד 7 הוא פעולה אמיתית.
      */}
      {sorted.length > 0 &&
        (narrow ? (
          paged.length < sorted.length && (
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={() => applyPageSize(pageSize + 20)}
                className="w-full"
              >
                טען עוד ({sorted.length - paged.length} נותרו)
              </Button>
            </div>
          )
        ) : (
          <Pagination
            page={safePage}
            pageSize={pageSize}
            total={sorted.length}
            onPageChange={setPage}
            onPageSizeChange={applyPageSize}
          />
        ))}

      {/*
        "ליד חדש" כ-FAB — בטלפון בלבד.

        זו הפעולה היחידה מבין הארבע שהיו בכותרת שנעשית תוך כדי שיחה,
        ולכן היא היחידה שנשארה על המסך.

        ה-bottom חייב לפנות את ה-BottomNav: הניווט הוא `fixed bottom-0`
        בגובה 3.5rem + safe-area, באותו z-40, ומרונדר אחרי ה-FAB ב-DOM —
        כלומר בלי המרווח הזה הוא פשוט נצבע מעליו. לכן 3.5rem (הניווט)
        + safe-area + 0.75rem רווח. ה-FAB גם נעלם בזמן בחירה כדי לא
        להתנגש בסרגל הפעולות הקבוצתיות.
      */}
      {narrow && !selecting && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="ליד חדש"
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] end-4 z-40 grid size-14 place-items-center rounded-full bg-brand text-on-brand shadow-pop transition-transform active:scale-95"
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      <LeadsMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onImport={() => setImportOpen(true)}
        onExport={exportCsv}
        onToggleStats={() => setStatsOpen((v) => !v)}
        statsOpen={statsOpen}
        onStartSelection={() => setSelecting(true)}
        canExport={sorted.length > 0}
      />

      {/* ה-key מאפס את מצב המגירה (הערה, אישור מחיקה) בכל ליד חדש */}
      <LeadDrawer
        key={`drawer:${openLead?.id ?? "none"}`}
        lead={openLead}
        users={users}
        userById={userById}
        onClose={() => setOpenLeadId(null)}
        onStatus={(to) => openLead && requestStatus([openLead.id], to)}
        onAssign={(uid) => openLead && assign([openLead.id], uid)}
        onPatchFollowUp={(date) =>
          openLead && patchLead(openLead.id, { followUpDate: date })
        }
        onCost={(cost) => openLead && setCost(openLead.id, cost)}
        effectiveCost={openLead ? leadCost(openLead, leadCosts) : undefined}
        onEdit={() => setEditOpen(true)}
        onDelete={() => openLead && remove([openLead.id])}
        onNotify={notify}
        busy={pending}
        canSeeAll={canSeeAll}
      />

      <AddLeadModal
        open={addOpen}
        users={users}
        onClose={() => setAddOpen(false)}
        onNotify={notify}
      />

      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onNotify={notify}
      />

      {/*
        ה-key טוען מחדש את ערכי ברירת המחדל של הטופס לכל ליד.
        ⚠️ בכוונה בלי `updatedAt` — הרענון האוטומטי (כל דקה) משנה את
        updatedAt, וכשהוא היה חלק מה-key המודל היה מתרנדר מחדש ומוחק
        טופס שמולא חלקית. אל תחזיר אותו לכאן.
      */}
      <EditLeadModal
        key={`edit:${openLead?.id ?? "none"}`}
        open={editOpen}
        lead={openLead}
        users={users}
        onClose={() => setEditOpen(false)}
        onNotify={notify}
      />

      {/* ה-key מרענן את הטיוטה כשהעלויות משתנות מבחוץ */}
      <LeadCostsModal
        key={`costs:${JSON.stringify(leadCosts)}`}
        open={costsOpen && canEditCosts}
        costs={leadCosts}
        onClose={() => setCostsOpen(false)}
        onNotify={notify}
      />

      {/*
        כל 15 הסטטוסים, בגיליון. קיים רק במסך צר: שם הכותרת מציגה רק
        את הסטטוסים שיש בהם עבודה, וזה הפתח להגיע לשאר בלי לוותר על
        הכלל שאסור להסתיר סטטוס מאחורי גלילה.
      */}
      <Modal
        open={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        title="סינון לפי סטטוס"
      >
        <StatusTiles
          counts={counts}
          active={filters.status}
          onToggle={(status) => {
            const on = filters.status.includes(status);
            applyFilters({
              ...filters,
              status: on
                ? filters.status.filter((s) => s !== status)
                : [...filters.status, status],
            });
          }}
          onClear={() => applyFilters({ ...filters, status: [] })}
        />
      </Modal>

      {/* ה-key מנקה את שדה הפירוט בין פתיחות */}
      <StatusDialog
        key={
          statusTarget
            ? `status:${statusTarget.to}:${statusTarget.leadIds.join(",")}`
            : "status:none"
        }
        target={statusTarget}
        onCancel={() => setStatusTarget(null)}
        onConfirm={(detail, followUpDate) =>
          statusTarget &&
          applyStatus(statusTarget.leadIds, statusTarget.to, detail, followUpDate)
        }
        busy={pending}
      />

      {/*
        אישור מחיקה קבוצתית. מחיקה בודדת מהמגירה כבר עטופה באישור
        דו-שלבי משלה — כאן סוגרים את הפער עבור המחיקה הקבוצתית,
        שעד עכשיו מחקה עשרות לידים בלחיצה אחת בלי שאלה.
      */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="מחיקת לידים"
      >
        <p className="text-sm text-ink-2">
          {deleteTarget?.length === 1
            ? "למחוק ליד אחד? הפעולה אינה הפיכה."
            : `למחוק ${deleteTarget?.length ?? 0} לידים? הפעולה אינה הפיכה.`}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            ביטול
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (deleteTarget) remove(deleteTarget);
              setDeleteTarget(null);
            }}
          >
            מחיקה
          </Button>
        </div>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
