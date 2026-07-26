"use client";

import { useMemo, useState } from "react";
import type { Lead, User } from "@/lib/domain/types";
import { Button, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { AdminSummaryTiles } from "./AdminSummaryTiles";
import { UsersTable } from "./UsersTable";

/**
 * מחזיק את מצב מסך ניהול המערכת ומעביר נתונים לילדים פרזנטציוניים.
 *
 * מסך קריאה בלבד: אין עדיין מערכת הרשאות כתיבה, ולכן אין כאן שום
 * מוטציה — רק חיפוש תצוגתי על טבלת המשתמשים. אריחי הסיכום תמיד
 * משקפים את כלל המשתמשים, לא את תוצאת החיפוש.
 */
export function AdminClient({ users, leads }: { users: User[]; leads: Lead[] }) {
  const [query, setQuery] = useState("");

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

        <Button
          variant="primary"
          icon="plus"
          disabled
          title="מערכת ההרשאות עדיין לא נבנתה"
        >
          משתמש חדש
        </Button>
      </header>

      <AdminSummaryTiles users={users} />

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

      <UsersTable users={filteredUsers} leadCountByUser={leadCountByUser} hasFilters={query.trim() !== ""} />
    </div>
  );
}
