"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ROLE_CONFIG, type User } from "@/lib/domain/types";
import { useBodyScrollLock } from "@/lib/overlay";
import { endSession } from "@/app/login/actions";
import { visibleFor } from "./nav";

/**
 * גיליון "עוד" — כל היעדים, הזהות והיציאה.
 *
 * ⚠️ זה מה שהחליף את הסרגל החוץ-קנבס בטלפון. גיליון תחתון ולא מגירה
 * צדדית מסיבה אחת: הוא נפתח מהמקום שבו האגודל כבר נמצא, ליד הכפתור
 * שפתח אותו. מגירה שנפתחת מהפינה העליונה דורשת שינוי אחיזה.
 *
 * הרשימה כוללת גם את היעדים שכבר בסרגל התחתון — לא בכוונה לחסוך,
 * אלא כי "עוד" שמסתיר חלק מהיעדים הוא בדיוק סוג הדבר שמכריח לזכור
 * איפה כל דבר נמצא.
 */
export function MoreSheet({
  open,
  onClose,
  user,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  pathname: string;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  const groups = visibleFor(user.role);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        className="absolute inset-0 bg-ink-1/50"
        onClick={onClose}
        aria-label="סגירה"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="תפריט"
        // ה-inset האופקי לצד התחתון — במצב נוף המגרעת חותכת את קצות
        // הגיליון, וזה הגיליון שמחזיק את היעדים שלא נכנסו לסרגל התחתון
        className="animate-rise absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] ps-[env(safe-area-inset-right)] pe-[env(safe-area-inset-left)]"
      >
        {/* ידית — הסימן המוסכם ל"אפשר לסגור את זה" */}
        <div className="sticky top-0 flex justify-center bg-surface pb-1 pt-2">
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>

        <div className="flex items-center gap-3 px-4 pb-3 pt-2">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand">
            {user.name.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-3">
              {ROLE_CONFIG[user.role].label}
            </p>
          </div>
          <form action={endSession}>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink-2 active:bg-surface-2"
            >
              <Icon name="logout" size={16} />
              יציאה
            </button>
          </form>
        </div>

        {groups.map((group) => (
          <div key={group.title} className="border-t border-line py-1.5">
            <h2 className="px-4 py-1 text-[11px] font-semibold tracking-wide text-ink-4">
              {group.title}
            </h2>
            <ul>
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-14 items-center gap-3 px-4 transition-colors active:bg-surface-2 ${
                        active ? "font-semibold text-brand" : "text-ink-1"
                      }`}
                    >
                      <Icon name={item.icon} size={19} />
                      <span className="min-w-0">
                        <span className="block text-sm">{item.label}</span>
                        {/* ⚠️ ההסבר כטקסט ולא כ-title: tooltip לא קיים במגע */}
                        <span className="block truncate text-xs text-ink-4">
                          {item.hint}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
