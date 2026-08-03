"use client";

import { useMemo, useState } from "react";
import type { Lead, User } from "@/lib/domain/types";
import { Button, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { AdminSummaryTiles } from "./AdminSummaryTiles";
import { BotStatus, type BotFailure, type BotHealth } from "./BotStatus";
import {
  BotControls,
  type BotSettings,
  type QueuedMessage,
} from "./BotControls";
import { UsersTable } from "./UsersTable";
import { AddUserModal } from "./AddUserModal";
import { EditUserModal } from "./EditUserModal";

/**
 * מחזיק את מצב מסך ניהול המערכת ומעביר נתונים לילדים פרזנטציוניים.
 *
 * שתי מוטציות: יצירת משתמש ועריכת משתמש (admin/actions.ts). בנוסף,
 * בעלים יכול להיכנס למערכת בתור משתמש אחר — ראה admin/impersonation.ts.
 * אריחי הסיכום תמיד משקפים את כלל המשתמשים, לא את תוצאת החיפוש.
 */
export function AdminClient({
  users,
  leads,
  canImpersonate,
  currentUserId,
  botHealth,
  botFailures,
  botSettings,
  botQueue,
  botSentToday,
}: {
  users: User[];
  leads: Lead[];
  /** בעלים בלבד — נקבע בשרת ב-page.tsx */
  canImpersonate: boolean;
  currentUserId: string;
  /** `null` = הבוט מעולם לא דיווח דופק */
  botHealth: BotHealth | null;
  botFailures: BotFailure[];
  botSettings: BotSettings;
  botQueue: QueuedMessage[];
  botSentToday: number;
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  /** ספירת לידים לכל משתמש, נגזרת מ-assigneeId — בלי repository ייעודי. */
  const leadCountByUser = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      if (!lead.assigneeId) continue;
      counts.set(lead.assigneeId, (counts.get(lead.assigneeId) ?? 0) + 1);
    }
    return counts;
  }, [leads]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack =
        `${u.name} ${u.email} ${u.phone ?? ""} ${u.store ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
            ניהול מערכת
          </h1>
          <p className="mt-2 text-sm text-ink-3">
            <span className="nums font-semibold text-ink-1">{users.length}</span>{" "}
            משתמשים במערכת
          </p>
        </div>

        <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
          משתמש חדש
        </Button>
      </header>

      <BotStatus
        health={botHealth}
        failures={botFailures}
        paused={botSettings.paused}
      />

      <BotControls
        settings={botSettings}
        queued={botQueue}
        sentToday={botSentToday}
      />

      <AdminSummaryTiles users={users} />

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />

      {/* ה-key מרענן את ערכי ברירת המחדל של הטופס בין משתמשים */}
      <EditUserModal
        key={editUser?.id ?? "none"}
        user={editUser}
        onClose={() => setEditUser(null)}
      />

      <div className="mb-3 mt-6">
        <div className="relative max-w-xs">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute inset-y-0 start-2.5 my-auto text-ink-4"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון, מייל או חנות..."
            className={`${inputClass} ps-8`}
            aria-label="חיפוש משתמשים"
          />
        </div>
      </div>

      <UsersTable
        users={filteredUsers}
        leadCountByUser={leadCountByUser}
        hasFilters={query.trim() !== ""}
        onEdit={setEditUser}
        canImpersonate={canImpersonate}
        currentUserId={currentUserId}
      />
    </div>
  );
}
