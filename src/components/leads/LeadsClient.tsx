"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Deal,
  Lead,
  LeadCostTable,
  LeadStatus,
  Package,
  User,
} from "@/lib/domain/types";
import { PRIORITY_CONFIG, STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
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
  payableCommission,
  performanceByAgent,
  totalLeadCostForLeads,
} from "@/server/services/economics";
import { Modal, ToastStack, type Toast } from "@/components/ui/primitives";
import { LeadCostsModal } from "@/components/settings/LeadCostsModal";
import { LeadsFinancePanel } from "./LeadsFinancePanel";
import { LeadsPerformancePanel } from "./LeadsPerformancePanel";
import { leadsCsvFilename, leadsToCsvRows } from "./leadsCsv";
import { QueueHeader } from "./QueueHeader";
import { FilterBar, type Filters, EMPTY_FILTERS } from "./FilterBar";
import { LeadsTable } from "./LeadsTable";
import { LeadCardList } from "./LeadCardList";
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
}: {
  leads: Lead[];
  users: User[];
  counts: Record<LeadStatus, number>;
  leadCosts: LeadCostTable;
  deals: Deal[];
  packages: Package[];
  currentUserId: string;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "updatedAt",
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

  useEffect(() => {
    function pull() {
      awaitingPoll.current = true;
      router.refresh();
    }

    const timer = setInterval(() => {
      // לשונית ברקע לא צריכה נתונים טריים — וגם לא קריאות DB
      if (!document.hidden) pull();
    }, AUTO_REFRESH_MS);

    // חזרה ללשונית מרעננת מיד ולא מחכה לטיק הבא: מסך שהיה מוסתר
    // חצי שעה מציג נתונים בני חצי שעה, וזו בדיוק הנקודה שבה מסתכלים.
    function onVisible() {
      if (!document.hidden) pull();
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
        return;

      if (e.key === "n") {
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
  }, []);

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

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    return leads.filter((lead) => {
      if (filters.openOnly && STATUS_CONFIG[lead.status].terminal) return false;

      if (filters.dueToday) {
        if (endOfToday === null) return false;
        if (!lead.followUpAt) return false;
        if (Date.parse(lead.followUpAt) > endOfToday) return false;
      }

      if (filters.status.length && !filters.status.includes(lead.status)) return false;
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

      if (q) {
        const haystack =
          `${lead.name} ${lead.phone} ${lead.email ?? ""} ${lead.city ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [leads, filters, endOfToday]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (sort.field) {
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
  }, [filtered, sort]);

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
      filters.openOnly ||
      filters.dueToday ||
      filters.status.length > 0 ||
      filters.kind.length > 0 ||
      filters.priority.length > 0 ||
      filters.category.length > 0 ||
      filters.assignee.length > 0,
    [filters],
  );

  const openLead = useMemo(
    () => leads.find((l) => l.id === openLeadId) ?? null,
    [leads, openLeadId],
  );

  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  /* ── כספים על החתך המוצג ─────────────────────────────────────────── */

  const catalog = useMemo(
    () => new Map(packages.map((p) => [p.id, p])),
    [packages],
  );

  /** רק העסקאות שנסגרו מלידים שנמצאים בחתך הנוכחי. */
  const dealsForLeads = useMemo(() => {
    const ids = new Set(sorted.map((l) => l.id));
    return deals.filter((d) => ids.has(d.leadId));
  }, [deals, sorted]);

  const finance = useMemo(
    () => ({
      cost: totalLeadCostForLeads(sorted, leadCosts),
      commission: dealsForLeads.reduce(
        (sum, d) => sum + payableCommission(d.packageIds, catalog),
        0,
      ),
    }),
    [sorted, leadCosts, dealsForLeads, catalog],
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

  /** פותח דיאלוג פירוט אם הסטטוס דורש אחד, אחרת מחיל ישירות. */
  function requestStatus(leadIds: string[], to: LeadStatus) {
    if (STATUS_CONFIG[to].prompt) {
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
  }

  function assign(leadIds: string[], assigneeId: string | null) {
    startTransition(async () => {
      const res = await assignAction(leadIds, assigneeId);
      if (!res.ok) return notify(res.error, "bad");

      const name = assigneeId ? userById.get(assigneeId)?.name : null;
      notify(name ? `שויך ל${name}` : "השיוך הוסר");
      setSelected(new Set());
    });
  }

  function setCost(leadId: string, cost: number | null) {
    startTransition(async () => {
      const res = await setLeadCostAction(leadId, cost);
      if (!res.ok) return notify(res.error, "bad");
      notify(cost === null ? "העלות אופסה לברירת המחדל" : "העלות עודכנה");
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
      const res = await patchLeadAction(leadId, patch);
      if (!res.ok) notify(res.error, "bad");
    });
  }

  function toggleStar(leadId: string, next: boolean) {
    startTransition(async () => {
      const res = await toggleStarAction(leadId, next);
      if (!res.ok) notify(res.error, "bad");
    });
  }

  /** מייצא את כל מה שתואם לסינון, לא רק את מה שנראה על המסך. */
  function exportCsv() {
    downloadCsv(
      leadsCsvFilename(),
      toCsv(leadsToCsvRows(sorted, userById, leadCosts)),
    );
    notify(`${sorted.length} לידים יוצאו`);
  }

  function remove(leadIds: string[]) {
    startTransition(async () => {
      const res = await deleteLeadsAction(leadIds);
      if (!res.ok) return notify(res.error, "bad");

      notify(leadIds.length === 1 ? "הליד נמחק" : `${leadIds.length} לידים נמחקו`);
      setSelected(new Set());
      setOpenLeadId(null);
    });
  }

  /* ── תצוגה ───────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
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
        compact={narrow}
        onExpandStatuses={() => setStatusSheetOpen(true)}
      />

      {statsOpen && (
        <div className="mb-3">
          <LeadsFinancePanel
            cost={finance.cost}
            commission={finance.commission}
            onEditCosts={() => setCostsOpen(true)}
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
        onBulkDelete={() => remove(visibleSelected)}
        onClearSelection={() => setSelected(new Set())}
        columnPicker={
          // בורר העמודות הוא כלי של הטבלה בלבד — לכרטיס אין עמודות
          narrow ? undefined : (
            <ColumnPicker visible={visibleColumns} onChange={setVisibleColumns} />
          )
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
          busy={pending}
          onOpen={setOpenLeadId}
          onStatus={(id, to) => requestStatus([id], to)}
          onStar={toggleStar}
          onPatch={patchLead}
          onAdd={() => setAddOpen(true)}
          hasFilters={hasActiveFilters}
          onBulkAssign={(id) => assign([...selected], id)}
          onBulkStatus={(to) => requestStatus([...selected], to)}
          onBulkDelete={() => remove([...selected])}
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
          busy={pending}
        />
      )}

      {sorted.length > 0 && (
        <Pagination
          page={safePage}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={applyPageSize}
        />
      )}

      {/* ה-key מאפס את מצב המגירה (הערה, אישור מחיקה) בכל ליד חדש */}
      <LeadDrawer
        key={`drawer:${openLead?.id ?? "none"}`}
        lead={openLead}
        users={users}
        userById={userById}
        onClose={() => setOpenLeadId(null)}
        onStatus={(to) => openLead && requestStatus([openLead.id], to)}
        onAssign={(uid) => openLead && assign([openLead.id], uid)}
        onEdit={() => setEditOpen(true)}
        onDelete={() => openLead && remove([openLead.id])}
        onNotify={notify}
        busy={pending}
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

      {/* ה-key טוען מחדש את ערכי ברירת המחדל של הטופס לכל ליד */}
      <EditLeadModal
        key={`edit:${openLead?.id ?? "none"}:${openLead?.updatedAt ?? ""}`}
        open={editOpen}
        lead={openLead}
        users={users}
        onClose={() => setEditOpen(false)}
        onNotify={notify}
      />

      {/* ה-key מרענן את הטיוטה כשהעלויות משתנות מבחוץ */}
      <LeadCostsModal
        key={`costs:${JSON.stringify(leadCosts)}`}
        open={costsOpen}
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

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
