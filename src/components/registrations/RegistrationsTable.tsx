"use client";

import type { Registration, RegistrationStatus } from "@/lib/domain/types";
import { REGISTRATION_STATUS_CONFIG, REGISTRATION_STATUS_ORDER } from "@/lib/domain/types";
import { TONE_VAR, date, phone } from "@/lib/format";
import { useIsNarrow } from "@/lib/media";
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
  const narrow = useIsNarrow();

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

  /*
   * ⚠️ בטלפון כרטיסים, לא טבלה. הטבלה שמתחת היא `min-w-[860px]` בתוך
   * מסך של 360 — כלומר פחות מ-40% ממנה נראה, ו-`StatusPicker`, שהוא
   * **הפקד היחיד במסך הזה שמשנה משהו**, יושב בעמודה השישית מתוך שבע,
   * כ-600px מחוץ למסך. פנייה שנכנסה מהטופס הציבורי לא הייתה ניתנת
   * לטיפול מהטלפון בכלל.
   *
   * אותו דפוס בדיוק כמו `admin/UsersTable` — רינדור אחד או השני, לעולם
   * לא שניהם, כדי לא לשלם על DOM כפול ולא לבלבל קוראי מסך.
   */
  if (narrow) {
    return (
      <ul className="flex flex-col gap-2">
        {registrations.map((reg) => (
          <RegistrationCard
            key={reg.id}
            reg={reg}
            onStatus={onStatus}
            busy={busy}
          />
        ))}
      </ul>
    );
  }

  return (
    /* ראה ההערה ב-`DealsTable` — אותה בעיית scrollport בדיוק */
    <div className="scroll-thin max-h-[calc(100dvh-var(--chrome-h,60px)-180px)] min-h-[240px] overflow-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
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

/**
 * כרטיס פנייה — התצוגה בטלפון.
 *
 * הסדר מכוון ותואם לשאר המערכת: קודם מי זה, אחר כך איך יוצרים קשר,
 * ובסוף המנהלה. הסטטוס עולה לשורת הכותרת — הוא הדבר שנוגעים בו, ולכן
 * הוא לא נקבר בתחתית הכרטיס.
 */
function RegistrationCard({
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
    <li
      className="spine relative overflow-hidden rounded-card border border-line bg-surface p-3 ps-4 shadow-card"
      style={
        {
          "--spine-c": TONE_VAR[status.tone],
          "--spine-w": "3px",
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink-1">
            {reg.businessName}
          </p>
          <p className="truncate text-sm text-ink-2">{reg.contactName}</p>
        </div>
        {/* הפקד היחיד שמשנה משהו — בפינה, בגובה האגודל, ולא בעמודה 6 */}
        <StatusPicker
          current={reg.status}
          onPick={(to) => onStatus(reg.id, to)}
          busy={busy}
        />
      </div>

      {/*
        טלפון ומייל כקישורים ולא כטקסט: בטלפון זו הפעולה עצמה — הקשה
        אחת מחייגת. `min-h-11` כי אלה שתי מטרות מגע צמודות.
      */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <a
          href={`tel:${reg.phone}`}
          className="ltr-num inline-flex min-h-11 items-center gap-1.5 text-ink-2 active:text-brand"
        >
          <Icon name="phone" size={14} />
          {phone(reg.phone)}
        </a>
        {reg.email && (
          <a
            href={`mailto:${reg.email}`}
            className="inline-flex min-h-11 min-w-0 items-center gap-1.5 text-ink-3 active:text-brand"
          >
            <Icon name="mail" size={14} />
            <span className="truncate">{reg.email}</span>
          </a>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
        <span className="truncate">שוייך ל{reg.referralSource}</span>
        <span className="ms-auto shrink-0">{date(reg.createdAt)}</span>
      </div>
    </li>
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
    // ⚠️ `min-h-11 min-w-11` מתחת ל-lg — בלעדיו ה-`<select>` השקוף יורש
    // את גודל ה-`Badge` ונותן אזור לחיצה של ~43×20, פחות ממחצית מ-44px
    // הנדרש. זה הפקד **היחיד** לשינוי סטטוס של פנייה. אותה שמירה כבר
    // הייתה ב-`leads/cells.tsx` ולא הועתקה לכאן.
    <span className="relative inline-flex min-h-11 min-w-11 items-center lg:min-h-0 lg:min-w-0">
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
