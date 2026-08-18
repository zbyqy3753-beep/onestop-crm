"use client";

import { useMemo, useState } from "react";
import type { Lead, User } from "@/lib/domain/types";
import { Button, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { AdminSummaryTiles } from "./AdminSummaryTiles";
import { BotStatus, type BotHealth } from "./BotStatus";
import { UsersTable } from "./UsersTable";
import { AddUserModal } from "./AddUserModal";
import { EditUserModal } from "./EditUserModal";
import { PasswordResetPanel } from "./PasswordResetPanel";

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
  botPaused,
  botFailureCount,
  botQueuedCount,
}: {
  users: User[];
  leads: Lead[];
  /** בעלים בלבד — נקבע בשרת ב-page.tsx */
  canImpersonate: boolean;
  currentUserId: string;
  /** `null` = הבוט מעולם לא דיווח דופק */
  botHealth: BotHealth | null;
  botPaused: boolean;
  botFailureCount: number;
  botQueuedCount: number;
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

      {/* הרצועה בלבד. השליטה עברה למסך `/bots` — היא גדלה מעבר למה
          שמסך המשתמשים אמור להחזיק, ופיצול הוא לא רק סדר: מנהל שמחפש
          "למה X לא קיבל תזכורת" לא אמור לגלול טבלת משתמשים כדי להגיע. */}
      <BotStatus
        health={botHealth}
        failureCount={botFailureCount}
        paused={botPaused}
        queuedCount={botQueuedCount}
      />

      <AdminSummaryTiles users={users} />

      {/* ⚠️ בעלים בלבד — `canImpersonate` הוא בדיוק אותו תנאי, ונקבע
          בשרת. זו הסתרה של פקד, לא הרשאה: `resetPasswordsAction`
          בודקת את התפקיד בעצמה. */}
      {canImpersonate && (
        <div className="mt-4">
          <PasswordResetPanel users={users} currentUserId={currentUserId} />
        </div>
      )}

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
