"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Lead, LeadStatus, User } from "@/lib/domain/types";
import { PRIORITY_CONFIG, STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
import {
  assignAction,
  changeStatusAction,
  deleteLeadsAction,
} from "@/app/(app)/leads/actions";
import { CURRENT_USER_ID } from "@/lib/domain/seed";
import { useNow } from "@/lib/clock";
import { ToastStack, type Toast } from "@/components/ui/primitives";
import { QueueHeader } from "./QueueHeader";
import { FilterBar, type Filters, EMPTY_FILTERS } from "./FilterBar";
import { LeadsTable } from "./LeadsTable";
import { LeadDrawer } from "./LeadDrawer";
import { AddLeadModal } from "./AddLeadModal";
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
}: {
  leads: Lead[];
  users: User[];
  counts: Record<LeadStatus, number>;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "updatedAt",
    dir: "desc",
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
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

  // בחירות שנעלמו מהסינון לא צריכות להישאר "נבחרות" בשקט
  const visibleSelected = useMemo(() => {
    const visible = new Set(sorted.map((l) => l.id));
    return [...selected].filter((id) => visible.has(id));
  }, [selected, sorted]);

  /* ── פעולות ──────────────────────────────────────────────────────── */

  /** פותח דיאלוג פירוט אם הסטטוס דורש אחד, אחרת מחיל ישירות. */
  function requestStatus(leadIds: string[], to: LeadStatus) {
    if (STATUS_CONFIG[to].prompt) {
      setStatusTarget({ leadIds, to });
      return;
    }
    applyStatus(leadIds, to);
  }

  function applyStatus(leadIds: string[], to: LeadStatus, detail?: string) {
    startTransition(async () => {
      for (const id of leadIds) {
        const res = await changeStatusAction(id, to, detail);
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
        filters={filters}
        onFiltersChange={setFilters}
        currentUserId={CURRENT_USER_ID}
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
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
        leads={sorted}
        userById={userById}
        selected={selected}
        onSelectedChange={setSelected}
        sort={sort}
        onSortChange={setSort}
        onOpen={setOpenLeadId}
        onStatus={(id, to) => requestStatus([id], to)}
        onAdd={() => setAddOpen(true)}
        hasFilters={hasActiveFilters}
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

      {/* ה-key מנקה את שדה הפירוט בין פתיחות */}
      <StatusDialog
        key={
          statusTarget
            ? `status:${statusTarget.to}:${statusTarget.leadIds.join(",")}`
            : "status:none"
        }
        target={statusTarget}
        onCancel={() => setStatusTarget(null)}
        onConfirm={(detail) =>
          statusTarget && applyStatus(statusTarget.leadIds, statusTarget.to, detail)
        }
        busy={pending}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
