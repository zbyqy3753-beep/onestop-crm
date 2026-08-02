"use client";

import { useTransition } from "react";
import type { User } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";
import { number, phone as formatPhone } from "@/lib/format";
import { impersonateAction } from "@/app/(app)/admin/impersonation";
import { useIsNarrow } from "@/lib/media";
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
  const narrow = useIsNarrow();

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

  /*
   * ⚠️ המסך הזה היה הפגם החמור ביותר שנמדד בטלפון: `documentElement
   * .scrollWidth` היה 681 ב-viewport של 375 — כלומר **הדף כולו** נגלל
   * לצדדים, לא רק הטבלה, ו-55% מהעמודות היו מחוץ למסך. גלילה אופקית
   * של ה-body הופכת כל החלקה אנכית למקרית.
   */
  if (narrow) {
    return (
      <ul className="flex flex-col gap-2">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            leadCount={leadCountByUser.get(user.id) ?? 0}
            onEdit={() => onEdit(user)}
            canImpersonate={canImpersonate}
            isSelf={user.id === currentUserId}
          />
        ))}
      </ul>
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

/**
 * הכפתור מוצג רק כשהכניסה באמת אפשרית: לא לעצמך, לא לבעלים אחר,
 * ולא למשתמש מושבת. השרת אוכף את אותם כללים בדיוק — ההסתרה כאן היא
 * כדי לא להציג כפתור שנכשל בלחיצה.
 */
function canEnterAs(user: User, canImpersonate: boolean, isSelf: boolean) {
  return canImpersonate && !isSelf && user.role !== "owner" && user.active;
}

/** אותן שתי פעולות בשתי התצוגות — מקור אחד, בלי שכפול התנאי. */
function UserActions({
  user,
  onEdit,
  impersonatable,
  full = false,
}: {
  user: User;
  onEdit: () => void;
  impersonatable: boolean;
  /** בכרטיס הכפתורים נמתחים לרוחב מלא; בטבלה הם צמודים לקצה */
  full?: boolean;
}) {
  const [entering, startEnter] = useTransition();

  return (
    <div className={`flex gap-1.5 ${full ? "" : "justify-end"}`}>
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
          className={full ? "flex-1" : ""}
        >
          {entering ? "נכנס…" : "כניסה בתור"}
        </Button>
      )}
      <Button onClick={onEdit} className={full ? "flex-1" : ""}>
        עריכה
      </Button>
    </div>
  );
}

function UserCard({
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

  return (
    <li className="rounded-card border border-line bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
          {user.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink-1">
            {user.name}
          </p>
          <p className="truncate text-xs text-ink-3">
            {role.label}
            {user.store && <> · {user.store}</>}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-4">{user.email}</p>
          {user.phone && (
            <p className="ltr-num truncate text-xs text-ink-4">
              {formatPhone(user.phone)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={user.active ? "good" : "neutral"}>
            {user.active ? "פעיל" : "לא פעיל"}
          </Badge>
          <span className="nums text-xs text-ink-3">
            {number(leadCount)} לידים
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <UserActions
          user={user}
          onEdit={onEdit}
          impersonatable={canEnterAs(user, canImpersonate, isSelf)}
          full
        />
      </div>
    </li>
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
        <UserActions
          user={user}
          onEdit={onEdit}
          impersonatable={canEnterAs(user, canImpersonate, isSelf)}
        />
      </td>
    </tr>
  );
}
