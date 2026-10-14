"use client";

import { KIND_CONFIG, STATUS_CONFIG, whatsappGreeting } from "@/lib/domain/types";
import { TONE_VAR, phone, waLink } from "@/lib/format";
import { Badge, Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import {
  leadAge,
  overdueFor,
  safeDate,
  stuckFor,
  type MissedLeadRow,
  type StuckInfo,
} from "./groups";

/**
 * ליד אחד ב"לידים שפוספסו" — כרטיס לבן ואוורירי בסדר של DC, בצבעי המקור.
 *
 * מלמעלה למטה: מי (שם וגיל), איך משיגים אותו (טלפון כחול, וואטסאפ ירוק),
 * למה הוא כאן (תגית סטטוס אחת — בסגורים הסטטוס **הוא** הסיבה), מה הנציג
 * כתב, ושורת מטא אפורה עם "החזר לתור" בקצה — באותו מקום בכל כרטיס, כדי
 * שהאגודל ימצא אותו בלי לחפש.
 *
 * הפס בקצה המוביל בצבע הסטטוס (`.spine` + `TONE_VAR`), כמו בכרטיס הליד.
 */
export function MissedLeadCard({
  row,
  stuck,
  today,
  busy,
  onReturn,
}: {
  row: MissedLeadRow;
  /** קיים רק בלשונית "תקועים בתור" */
  stuck?: StuckInfo;
  /** `israelDay(now)` — `null` לפני ההרכבה, ואז הגיל פשוט לא מוצג */
  today: number | null;
  busy: boolean;
  onReturn: () => void;
}) {
  const status = STATUS_CONFIG[row.status];
  const name = row.name.trim() || "ללא שם";
  const age = today === null ? "" : leadAge(row.createdAt, today);

  /*
   * ליד תקוע בלי מטפל פעיל — זו לרוב התשובה ל"למה הוא תקוע", ולכן היא
   * מקבלת צבע. בליד סגור אותו נתון הוא היסטוריה, ונשאר אפור.
   */
  const unattended =
    stuck !== undefined &&
    (row.assigneeName === null || row.assigneeInactive === true);

  return (
    <li
      className="spine flex min-w-0 flex-col gap-3 overflow-hidden rounded-card border border-line bg-surface p-4 lg:p-5"
      style={{ "--spine-c": TONE_VAR[status.tone] } as React.CSSProperties}
    >
      {/* שורה 1: שם · גיל · חם, והסטטוס בקצה */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="min-w-0 max-w-full truncate text-base font-semibold text-ink-1">
            {name}
          </h3>
          {age && <span className="text-xs text-ink-4">{age}</span>}
          {row.kind === "hot" && (
            <span className="text-xs font-semibold text-bad">{KIND_CONFIG.hot.short}</span>
          )}
        </div>
        <Badge tone={status.tone} className="shrink-0">
          {status.label}
        </Badge>
      </div>

      {/* שורה 2: טלפון כחול ווואטסאפ ירוק, ובאפור במה הוא התעניין */}
      <div className="-my-1.5 flex min-w-0 flex-wrap items-center gap-x-1 lg:my-0">
        <a
          href={`tel:${row.phone}`}
          title="חיוג"
          className="-ms-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-brand underline-offset-4 transition-colors hover:underline active:opacity-70 lg:min-h-0"
        >
          <Icon name="phone" size={15} className="shrink-0" />
          <span className="ltr-num">{phone(row.phone)}</span>
        </a>
        <a
          href={waLink(row.phone, whatsappGreeting(row.name))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`וואטסאפ ל${name}`}
          title="וואטסאפ"
          className="relative inline-grid size-9 shrink-0 place-items-center rounded-md text-good transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-good-soft active:bg-good-soft lg:after:inset-0"
        >
          <Icon name="whatsapp" size={18} />
        </a>
        {row.category && (
          <span className="ms-1 min-w-0 truncate text-xs text-ink-3">{row.category}</span>
        )}
      </div>

      {/* שורה 3: מה הנציג כתב כשהעביר לסטטוס הנוכחי */}
      {row.lastDetail && (
        <p
          title={row.lastDetail}
          className="line-clamp-2 break-words text-sm text-ink-3"
        >
          {row.lastDetail}
        </p>
      )}

      {/* שורה 4: מטא אפור, ו"החזר לתור" בקצה */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-3">
          {row.assigneeName !== undefined && (
            <>
              <span className={unattended ? "font-medium text-warn" : ""}>
                {row.assigneeName ?? "ללא שיוך"}
                {row.assigneeInactive && " · לא פעיל"}
              </span>
              <Dot />
            </>
          )}
          {stuck ? (
            <span>{stuckFor(stuck.days)}</span>
          ) : (
            <span title={`נכנס ${safeDate(row.createdAt)}`}>
              נסגר <span className="nums">{safeDate(row.lastChangeAt)}</span>
            </span>
          )}
          {stuck?.overdueDays !== undefined && stuck.overdueDays > 0 && (
            <>
              <Dot />
              <span className="font-medium text-bad">{overdueFor(stuck.overdueDays)}</span>
            </>
          )}
        </p>

        <Button
          type="button"
          variant="secondary"
          onClick={onReturn}
          disabled={busy}
          className="ms-auto shrink-0"
        >
          {busy ? "מחזיר…" : "החזר לתור"}
        </Button>
      </div>
    </li>
  );
}

/** שלד כרטיס — ללשונית "תקועים בתור" לפני ההרכבה (אין עדיין שעון). */
export function MissedLeadCardSkeleton() {
  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 lg:p-5">
      <div className="flex animate-pulse items-center justify-between gap-3">
        <div className="h-4 w-32 rounded bg-surface-3" />
        <div className="h-5 w-16 rounded-full bg-surface-3" />
      </div>
      <div className="h-4 w-36 animate-pulse rounded bg-surface-3" />
      <div className="flex animate-pulse items-center justify-between border-t border-line pt-3">
        <div className="h-3 w-40 rounded bg-surface-3" />
        <div className="h-9 w-28 rounded-md bg-surface-2" />
      </div>
    </li>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-ink-4">
      ·
    </span>
  );
}
