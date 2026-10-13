"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Role } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/types";
import { TEAM_MEMBER_ROLES } from "@/lib/domain/permissions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { number, phone as formatPhone } from "@/lib/format";
import {
  createTeamMemberAction,
  detachTeamMemberAction,
} from "@/app/(app)/team/actions";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  TeamBadge,
  inputClass,
} from "@/components/ui/primitives";

/** מה שהמסך צריך לדעת על עובד — ראה `team/page.tsx`. */
export interface TeamMemberRow {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone?: string;
  active: boolean;
  leads: number;
  openLeads: number;
}

export function TeamClient({
  ownerName,
  members,
}: {
  ownerName: string;
  members: TeamMemberRow[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function detach(id: string) {
    startTransition(async () => {
      const res = await detachTeamMemberAction(id);
      setConfirmId(null);
      setError(res.ok ? null : res.error);
    });
  }

  const openTotal = members.reduce((sum, m) => sum + m.openLeads, 0);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
            ניהול הצוות
          </h1>
          <p className="mt-2 text-sm text-ink-3">
            <span className="nums font-semibold text-ink-1">{members.length}</span>{" "}
            עובדים משויכים ·{" "}
            <span className="nums font-semibold text-ink-1">{number(openTotal)}</span>{" "}
            לידים פתוחים בצוות
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/leads"
            className="inline-flex items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-1 hover:bg-surface-2 active:scale-95"
          >
            ללידים של הצוות
          </Link>
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
            עובד חדש
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          {error}
        </p>
      )}

      {members.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon="user"
            title="עדיין אין עובדים בצוות"
            body="צרף עובד — הוא יקבל שם משתמש וסיסמה, ואתה תראה ותשייך לו לידים מתוך מסך הלידים."
            action={
              <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
                עובד חדש
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="rounded-card border border-line bg-surface p-3 shadow-card"
            >
              <div className="flex items-start gap-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
                  {m.name.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-1">
                    {m.name}
                  </p>
                  <p className="truncate text-xs text-ink-3">
                    {ROLE_CONFIG[m.role].label}
                  </p>
                  <span className="mt-1 flex">
                    <TeamBadge ownerName={ownerName} showOwner />
                  </span>
                  <p className="mt-1 truncate text-start text-xs text-ink-4" dir="ltr">
                    {m.email}
                  </p>
                  {m.phone && (
                    <p className="ltr-num truncate text-xs text-ink-4">
                      {formatPhone(m.phone)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={m.active ? "good" : "neutral"}>
                    {m.active ? "פעיל" : "לא פעיל"}
                  </Badge>
                  <span className="nums text-xs text-ink-3">
                    {number(m.openLeads)} פתוחים / {number(m.leads)}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
                {confirmId === m.id ? (
                  <>
                    <span className="me-auto text-xs text-ink-3">
                      לנתק את {m.name} מהצוות? הלידים שלו ייעלמו מהמסך שלך.
                    </span>
                    <Button onClick={() => setConfirmId(null)} disabled={pending}>
                      ביטול
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => detach(m.id)}
                      disabled={pending}
                    >
                      {pending ? "מנתק…" : "ניתוק"}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmId(m.id)}>
                    ניתוק מהצוות
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen && <AddMemberModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  function submit(formData: FormData) {
    startSubmit(async () => {
      const result = await createTeamMemberAction(null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title="עובד חדש לצוות" wide>
      <form action={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="שם מלא">
          <input
            name="name"
            required
            autoFocus
            placeholder="ישראל ישראלי"
            className={inputClass}
          />
        </Field>

        <Field label="תפקיד">
          <select name="role" defaultValue="employee" className={inputClass}>
            {TEAM_MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </Field>

        {/* `type="text"` — ראה ההערה ב-LoginForm */}
        <Field label="שם משתמש" hint="ישמש להתחברות — מילה אחת באנגלית">
          <input
            name="email"
            type="text"
            required
            dir="ltr"
            placeholder="idan"
            className={`${inputClass} text-start`}
          />
        </Field>

        <Field label="טלפון" hint="נדרש לקבלת תזכורות חזרה בוואטסאפ">
          <input
            name="phone"
            inputMode="tel"
            placeholder="0501234567"
            className={`${inputClass} ltr-num text-start`}
          />
        </Field>

        <Field label="סיסמה ראשונית" hint={`לפחות ${MIN_PASSWORD_LENGTH} תווים`}>
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className={inputClass}
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad sm:col-span-2"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "שומר…" : "צירוף לצוות"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
