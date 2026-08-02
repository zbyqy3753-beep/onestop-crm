"use client";

import { useTransition } from "react";
import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";
import { number, phone as formatPhone } from "@/lib/format";
import { impersonateAction } from "@/app/(app)/admin/impersonation";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";

/** טבלת משתמשים: עריכה, וכניסה בתור משתמש (לבעלים בלבד). */
export function UsersTable({
  users,
  leadCountByUser,
  hasFilters,
  onEdit,
  canImpersonate,
  currentUserId,
}: {
  users: User[];
  leadCountByUser: Map<string, number>;
  hasFilters: boolean;
  onEdit: (user: User) => void;
  /** רק בעלים — נקבע בשרת ומועבר כ-prop, הכפתור מוסתר לכל השאר */
  canImpersonate: boolean;
  currentUserId: string;
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          icon="admin"
          title={hasFilters ? "אין משתמשים שתואמים לחיפוש" : "אין משתמשים במערכת"}
          body={hasFilters ? "נסה מילת חיפוש אחרת." : undefined}
        />
      </div>
    );
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-surface-2">
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-3 py-2.5 text-start font-medium">משתמש</th>
            <th className="px-3 py-2.5 text-start font-medium">יצירת קשר</th>
            <th className="px-3 py-2.5 text-start font-medium">סטטוס</th>
            <th className="px-3 py-2.5 text-start font-medium">לידים</th>
            <th className="w-48">
              <span className="sr-only">פעולות</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <Row
              key={user.id}
              user={user}
              leadCount={leadCountByUser.get(user.id) ?? 0}
              onEdit={() => onEdit(user)}
              canImpersonate={canImpersonate}
              isSelf={user.id === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  user,
  leadCount,
  onEdit,
  canImpersonate,
  isSelf,
}: {
  user: User;
  leadCount: number;
  onEdit: () => void;
  canImpersonate: boolean;
  isSelf: boolean;
}) {
  const role = ROLE_CONFIG[user.role];
  const [entering, startEnter] = useTransition();

  /*
   * הכפתור מוצג רק כשהכניסה באמת אפשרית: לא לעצמך, לא לבעלים אחר,
   * ולא למשתמש מושבת. השרת אוכף את אותם כללים בדיוק — ההסתרה כאן
   * היא כדי לא להציג כפתור שנכשל בלחיצה.
   */
  const impersonatable =
    canImpersonate && !isSelf && user.role !== "owner" && user.active;

  return (
    <tr className="border-b border-line last:border-0 hover:bg-surface-2">
      {/* משתמש */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
            {user.name.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink-1">
              {user.name}
            </p>
            <p className="truncate text-xs text-ink-3">
              {role.label}
              {user.store && <> · {user.store}</>}
            </p>
          </div>
        </div>
      </td>

      {/* יצירת קשר */}
      <td className="px-3 py-2.5 text-xs text-ink-2">
        {user.phone && <p className="ltr-num">{formatPhone(user.phone)}</p>}
        <p className="mt-0.5 truncate text-ink-3">{user.email}</p>
      </td>

      {/* סטטוס */}
      <td className="px-3 py-2.5">
        <Badge tone={user.active ? "good" : "neutral"}>
          {user.active ? "פעיל" : "לא פעיל"}
        </Badge>
      </td>

      {/* לידים */}
      <td className="nums px-3 py-2.5 text-ink-1">{number(leadCount)}</td>

      {/* פעולות */}
      <td className="pe-3">
        <div className="flex justify-end gap-1.5">
          {impersonatable && (
            <Button
              variant="secondary"
              disabled={entering}
              onClick={() =>
                startEnter(async () => {
                  await impersonateAction(user.id);
                })
              }
              title={`כניסה למערכת בתור ${user.name}`}
            >
              {entering ? "נכנס…" : "כניסה בתור"}
            </Button>
          )}
          <Button onClick={onEdit}>עריכה</Button>
        </div>
      </td>
    </tr>
  );
}
