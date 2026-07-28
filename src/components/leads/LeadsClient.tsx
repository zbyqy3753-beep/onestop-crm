"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  changeStatusAction,
  deleteLeadsAction,
  setLeadCostAction,
  toggleStarAction,
} from "@/app/(app)/leads/actions";
import { useNow } from "@/lib/clock";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  payableCommission,
  performanceByAgent,
  totalLeadCostForLeads,
} from "@/server/services/economics";
import { ToastStack, type Toast } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { LeadCostsModal } from "@/components/settings/LeadCostsModal";
import { LeadsFinancePanel } from "./LeadsFinancePanel";
import { LeadsPerformancePanel } from "./LeadsPerformancePanel";
import { leadsCsvFilename, leadsToCsvRows } from "./leadsCsv";
import { QueueHeader } from "./QueueHeader";
import { FilterBar, type Filters, EMPTY_FILTERS } from "./FilterBar";
import { LeadsTable } from "./LeadsTable";
import { Pagination, PAGE_SIZES } from "./Pagination";
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

export type SortField = "updatedAt" | "createdAt" | "name" | "priority" | "status";

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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // מכווצים כברירת מחדל — שני הפאנלים האלה תפסו כל כך הרבה גובה
  // שהטבלה עצמה נדחקה מתחת לגלילה הראשונה
  const [statsOpen, setStatsOpen] = useState(false);
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
      for (const id of leadIds) {
        const res = await changeStatusAction(id, to, detail, followUpDate);
        if (!res.ok) {
          notify(res.error, "bad");
          return;
        }
      }
      setStatusTarget(null);
      notify(
        leadIds.length === 1
          ? `הסטטוס עודכן ל"${STATUS_CONFIG[to].label}"`
          : `${leadIds.length} לידים עודכנו ל"${STATUS_CONFIG[to].label}"`,
      );
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
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <QueueHeader
        counts={counts}
        total={leads.length}
        showing={sorted.length}
        onAdd={() => setAddOpen(true)}
        onExport={exportCsv}
        onImport={() => setImportOpen(true)}
        filters={filters}
        onFiltersChange={applyFilters}
        currentUserId={currentUserId}
      />

      <div className="mb-4 rounded-card border border-line bg-surface">
        <button
          onClick={() => setStatsOpen((v) => !v)}
          aria-expanded={statsOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink-1"
        >
          נתונים פיננסיים וביצועים
          <Icon
            name="chevronDown"
            size={15}
            className={statsOpen ? "rotate-180" : ""}
          />
        </button>

        {statsOpen && (
          <div className="border-t border-line px-4 pb-4 pt-3">
            <LeadsFinancePanel
              cost={finance.cost}
              commission={finance.commission}
              onEditCosts={() => setCostsOpen(true)}
            />
            <LeadsPerformancePanel rows={performance} userById={userById} />
          </div>
        )}
      </div>

      <FilterBar
        filters={filters}
        onChange={applyFilters}
        users={users}
        searchRef={searchRef}
        selectedCount={visibleSelected.length}
        onBulkAssign={(id) => assign(visibleSelected, id)}
        onBulkStatus={(to) => requestStatus(visibleSelected, to)}
        onBulkDelete={() => remove(visibleSelected)}
        onClearSelection={() => setSelected(new Set())}
        busy={pending}
      />

      <LeadsTable
        leads={paged}
        userById={userById}
        leadCosts={leadCosts}
        selected={selected}
        onSelectedChange={setSelected}
        sort={sort}
        onSortChange={applySort}
        onOpen={setOpenLeadId}
        onStatus={(id, to) => requestStatus([id], to)}
        onCost={setCost}
        onStar={toggleStar}
        onAdd={() => setAddOpen(true)}
        hasFilters={hasActiveFilters}
        busy={pending}
      />

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
