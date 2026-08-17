"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { Registration, RegistrationStatus, UserRef } from "@/lib/domain/types";
import { REGISTRATION_STATUS_CONFIG, REGISTRATION_STATUS_ORDER } from "@/lib/domain/types";
import { updateRegistrationStatusAction } from "@/app/(app)/registrations/actions";
import { Button, ToastStack, type Toast } from "@/components/ui/primitives";
import { StatusBreakdownStrip, type StatusSegment } from "@/components/ui/StatusBreakdownStrip";
import { number } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { CopyReferralLink } from "./CopyReferralLink";
import { RegistrationsTable } from "./RegistrationsTable";

/**
 * מחזיק את כל המצב של מסך טפסי הרישום.
 *
 * זהו תיבת דואר הפניית שותפים (בעלי חנויות טלפונים חיצוניים) —
 * לא קשור ללידי מכירה. הסינון לפי סטטוס ו"שוייך ל" נעשה בצד הלקוח
 * על מלוא רשימת הפניות שהתקבלה מהשרת, באותה רוח כמו `LeadsClient`.
 */
export function RegistrationsClient({
  registrations,
  currentUserId,
}: {
  registrations: Registration[];
  /** לא בשימוש כרגע — נשמר בחתימה כי מסך זה עשוי להזדקק לה בעתיד (למשל תצוגת "טופל ע״י"). */
  users: UserRef[];
  currentUserId: string;
}) {
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus[]>([]);
  const [referralFilter, setReferralFilter] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, startTransition] = useTransition();

  const toastId = useRef(0);
  const notify = useCallback((message: string, tone: Toast["tone"] = "good") => {
    toastId.current += 1;
    setToasts((t) => [...t, { id: toastId.current, message, tone }]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  /* ── ספירות ──────────────────────────────────────────────────────── */

  const statusSegments: StatusSegment[] = useMemo(
    () =>
      REGISTRATION_STATUS_ORDER.map((s) => ({
        key: s,
        label: REGISTRATION_STATUS_CONFIG[s].label,
        count: registrations.filter((r) => r.status === s).length,
        tone: REGISTRATION_STATUS_CONFIG[s].tone,
      })),
    [registrations],
  );

  const referralSegments: StatusSegment[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of registrations) {
      counts.set(r.referralSource, (counts.get(r.referralSource) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ key: source, label: source, count, tone: "neutral" as const }));
  }, [registrations]);

  /* ── סינון ───────────────────────────────────────────────────────── */

  const filtered = useMemo(
    () =>
      registrations.filter((r) => {
        if (statusFilter.length && !statusFilter.includes(r.status)) return false;
        if (referralFilter.length && !referralFilter.includes(r.referralSource)) return false;
        return true;
      }),
    [registrations, statusFilter, referralFilter],
  );

  const hasActiveFilters = statusFilter.length > 0 || referralFilter.length > 0;

  /* ── פעולות ──────────────────────────────────────────────────────── */

  function changeStatus(id: string, to: RegistrationStatus) {
    startTransition(async () => {
      const res = await updateRegistrationStatusAction(id, to);
      if (!res.ok) return notify(res.error, "bad");
      notify(`הסטטוס עודכן ל"${REGISTRATION_STATUS_CONFIG[to].label}"`);
    });
  }

  function exportCsv() {
    const header = ["שם עסק", "איש קשר", "טלפון", "אימייל", "שוייך ל", "סטטוס", "נוצר"];
    const rows = filtered.map((r) => [
      r.businessName,
      r.contactName,
      r.phone,
      r.email ?? "",
      r.referralSource,
      REGISTRATION_STATUS_CONFIG[r.status].label,
      new Date(r.createdAt).toLocaleDateString("he-IL"),
    ]);

    downloadCsv(
      `registrations-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...rows]),
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
            טפסי רישום
          </h1>
          <p className="mt-2 text-sm text-ink-3">
            <span className="nums font-semibold text-ink-1">
              {number(filtered.length)}
            </span>{" "}
            {hasActiveFilters ? <>מתוך {number(registrations.length)} פניות</> : <>פניות שותפים</>}
          </p>
        </div>

        <Button variant="secondary" icon="download" onClick={exportCsv}>
          ייצוא לאקסל
        </Button>
      </header>

      <div className="mb-4">
        <CopyReferralLink userId={currentUserId} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatusBreakdownStrip
          segments={statusSegments}
          activeKeys={statusFilter}
          onToggle={(key) => {
            const s = key as RegistrationStatus;
            setStatusFilter((prev) =>
              prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
            );
          }}
        />
        {referralSegments.length > 0 && (
          <StatusBreakdownStrip
            segments={referralSegments}
            activeKeys={referralFilter}
            onToggle={(key) =>
              setReferralFilter((prev) =>
                prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
              )
            }
          />
        )}
      </div>

      {hasActiveFilters && (
        <div className="mb-3">
          <Button
            variant="ghost"
            onClick={() => {
              setStatusFilter([]);
              setReferralFilter([]);
            }}
          >
            ניקוי סינון
          </Button>
        </div>
      )}

      <RegistrationsTable
        registrations={filtered}
        onStatus={changeStatus}
        hasFilters={hasActiveFilters}
        busy={pending}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
