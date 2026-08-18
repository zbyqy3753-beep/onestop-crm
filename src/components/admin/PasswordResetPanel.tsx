"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";
import type { User } from "@/lib/domain/types";
import {
  resetPasswordsAction,
  type ResetLinkView,
} from "@/app/(app)/admin/actions";

/**
 * איפוס סיסמאות והצגת הקישורים להעברה ידנית.
 *
 * ⚠️ **הקישורים מוצגים פעם אחת ואי אפשר לשחזר אותם.** במסד יושב רק
 * ה-hash שלהם, כמו בסשן. לכן המסך צועק את זה לפני הלחיצה ולא אחריה,
 * ומשאיר את הרשימה פתוחה עד שסוגרים אותה במפורש — רענון בטעות שווה
 * לאיבוד כל הקישורים, והנפקה חוזרת לכל עובד בנפרד.
 */
export function PasswordResetPanel({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [links, setLinks] = useState<ResetLinkView[] | null>(null);
  const [failures, setFailures] = useState<
    { name: string; email: string; error: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const active = users.filter((u) => u.active);

  function run(ids: string[], confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordsAction(ids);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // ⚠️ מצטבר ולא דורס: הנפקה חוזרת לעובד בודד אחרי איפוס כללי לא
      // אמורה למחוק מהמסך את שאר הקישורים שעוד לא הועברו.
      setLinks((prev) => [
        ...(result.data?.links ?? []),
        ...(prev ?? []).filter(
          (old) => !(result.data?.links ?? []).some((n) => n.userId === old.userId),
        ),
      ]);
      setFailures(result.data?.failures ?? []);
    });
  }

  async function copy(link: ResetLinkView) {
    await navigator.clipboard.writeText(
      `היי ${link.name}, הסיסמה שלך ל-CRM אופסה. קבע סיסמה חדשה כאן (הקישור חד-פעמי ותקף ל-3 ימים):\n${link.url}`,
    );
    setCopied(link.userId);
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">סיסמאות</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-3">
            איפוס הורג את הסיסמה הקיימת מיד ושולח לעובד הודעה בוואטסאפ. הוא
            נכנס דרך ״שכחת סיסמה?״, מקבל קוד, ובוחר סיסמה בעצמו — אף אחד, גם
            לא אתה, לא רואה אותה.
          </p>
        </div>

        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            run(
              active.map((u) => u.id),
              `לאפס סיסמה ל-${active.length} משתמשים פעילים?\n\nכולם ינותקו מיד. מי שיש לו טלפון במערכת יקבל הודעה בוואטסאפ ויסתדר לבד; השאר יוצגו לך לטיפול ידני.`,
            )
          }
        >
          {pending ? "מאפס…" : "אפס לכולם"}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {failures.length > 0 && (
        <div className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          <p className="font-medium">לא אופסו:</p>
          <ul className="mt-1 space-y-0.5">
            {failures.map((f) => (
              <li key={f.email}>
                {f.name} — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {links && links.filter((l) => l.notified).length > 0 && (
        <p className="mt-4 rounded-lg bg-save/10 px-3 py-2 text-sm text-save">
          {links.filter((l) => l.notified).length} עובדים קיבלו הודעה בוואטסאפ.
          הם ייכנסו דרך ״שכחת סיסמה?״ ויקבלו קוד — אין מה לשלוח להם.
        </p>
      )}

      {/* ⚠️ רק מי שלא קיבל התראה. השאר מסתדרים לבד, ורשימה שמציגה את
          כולם הייתה מטביעה את המקרים שבאמת דורשים טיפול. */}
      {links && links.filter((l) => !l.notified).length > 0 && (
        <div className="mt-5 rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-semibold text-ink">
            ⚠️ אלה לא קיבלו הודעה — אין להם טלפון במערכת
          </p>
          <p className="mt-1 text-sm text-ink-3">
            הם אופסו ואינם יודעים על כך. העבר להם את הקישור ידנית. הקישורים
            מוצגים פעם אחת בלבד — דף שנסגר לפני שהעתקת אותם משאיר אותם נעולים
            בחוץ, ואז צריך להנפיק מחדש.
          </p>

          <ul className="mt-4 space-y-2">
            {links.filter((l) => !l.notified).map((link) => (
              <li
                key={link.userId}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2"
              >
                <span className="min-w-24 font-medium text-ink">{link.name}</span>
                <span dir="ltr" className="truncate text-xs text-ink-4">
                  {link.email}
                </span>
                <div className="ms-auto flex gap-2">
                  <Button onClick={() => copy(link)}>
                    {copied === link.userId ? "הועתק" : "העתק הודעה"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setLinks(null)}
            className="mt-4 text-sm text-ink-4 hover:text-ink-2 hover:underline"
          >
            טיפלתי בכולם — סגור את הרשימה
          </button>
        </div>
      )}

      <details className="mt-5">
        <summary className="cursor-pointer text-sm text-ink-3 hover:text-ink">
          איפוס לעובד בודד (או הנפקת קישור מחדש)
        </summary>
        <ul className="mt-3 space-y-1">
          {active.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
            >
              <span className="font-medium text-ink">{u.name}</span>
              {u.id === currentUserId && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-4">
                  אתה
                </span>
              )}
              <span dir="ltr" className="truncate text-xs text-ink-4">
                {u.email}
              </span>
              <Button
                className="ms-auto"
                disabled={pending}
                onClick={() =>
                  run(
                    [u.id],
                    `לאפס את הסיסמה של ${u.name}?\n\nהסיסמה הנוכחית שלו תפסיק לעבוד מיד.`,
                  )
                }
              >
                אפס
              </Button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
