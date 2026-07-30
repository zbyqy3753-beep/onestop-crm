"use client";

import type { Registration, RegistrationStatus } from "@/lib/domain/types";
import { REGISTRATION_STATUS_CONFIG, REGISTRATION_STATUS_ORDER } from "@/lib/domain/types";
import { TONE_VAR, date, phone } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export function RegistrationsTable({
  registrations,
  onStatus,
  hasFilters,
  busy,
}: {
  registrations: Registration[];
  onStatus: (id: string, to: RegistrationStatus) => void;
  hasFilters: boolean;
  busy: boolean;
}) {
  if (registrations.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          icon="registrations"
          title={hasFilters ? "אין פניות שתואמות לסינון" : "אין פניות עדיין"}
          body={
            hasFilters
              ? "נסה להסיר חלק מהמסננים."
              : "פניות שיגיעו מהטופס הציבורי יופיעו כאן."
          }
        />
      </div>
    );
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="sticky top-[60px] z-10 bg-surface-2">
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-3 py-2.5 text-start font-medium">עסק</th>
            <th className="px-3 py-2.5 text-start font-medium">איש קשר</th>
            <th className="px-3 py-2.5 text-start font-medium">טלפון</th>
            <th className="px-3 py-2.5 text-start font-medium">אימייל</th>
            <th className="px-3 py-2.5 text-start font-medium">שוייך ל</th>
            <th className="px-3 py-2.5 text-start font-medium">סטטוס</th>
            <th className="px-3 py-2.5 text-start font-medium">נוצר</th>
          </tr>
        </thead>

        <tbody>
          {registrations.map((reg) => (
            <Row key={reg.id} reg={reg} onStatus={onStatus} busy={busy} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  reg,
  onStatus,
  busy,
}: {
  reg: Registration;
  onStatus: (id: string, to: RegistrationStatus) => void;
  busy: boolean;
}) {
  const status = REGISTRATION_STATUS_CONFIG[reg.status];

  return (
    <tr
      className="border-b border-line last:border-0 hover:bg-surface-2"
      style={{ "--spine-c": TONE_VAR[status.tone], "--spine-w": "3px" } as React.CSSProperties}
    >
      {/* `spine-cell` ולא `spine` על ה-`<tr>` — ראה globals.css */}
      <td className="spine-cell px-3 py-3">
        <span className="block max-w-[220px] truncate text-[15px] font-semibold text-ink-1">
          {reg.businessName}
        </span>
      </td>

      <td className="px-3 py-3 text-ink-2">{reg.contactName}</td>

      <td className="px-3 py-3">
        <a
          href={`tel:${reg.phone}`}
          className="ltr-num text-ink-2 hover:text-brand"
        >
          {phone(reg.phone)}
        </a>
      </td>

      <td className="px-3 py-3 text-ink-3">
        {reg.email ? (
          <a href={`mailto:${reg.email}`} className="hover:text-brand">
            {reg.email}
          </a>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </td>

      <td className="px-3 py-3 text-ink-2">{reg.referralSource}</td>

      <td className="px-3 py-2.5">
        <StatusPicker current={reg.status} onPick={(to) => onStatus(reg.id, to)} busy={busy} />
      </td>

      <td className="px-3 py-3 text-xs text-ink-3">{date(reg.createdAt)}</td>
    </tr>
  );
}

/** בורר סטטוס מוטבע בשורה — `<select>` מקורי, תואם ל-`StatusPicker` של הלידים. */
function StatusPicker({
  current,
  onPick,
  busy,
}: {
  current: RegistrationStatus;
  onPick: (to: RegistrationStatus) => void;
  busy: boolean;
}) {
  const meta = REGISTRATION_STATUS_CONFIG[current];

  return (
    <span className="relative inline-flex">
      <Badge tone={meta.tone} className="pe-4">
        {meta.label}
      </Badge>
      <Icon
        name="chevronDown"
        size={11}
        className="pointer-events-none absolute inset-y-0 end-1 my-auto opacity-50"
      />
      <select
        value={current}
        onChange={(e) => onPick(e.target.value as RegistrationStatus)}
        disabled={busy}
        aria-label="שינוי סטטוס פנייה"
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        {REGISTRATION_STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {REGISTRATION_STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>
    </span>
  );
}
