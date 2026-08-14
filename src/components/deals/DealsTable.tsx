"use client";

import type { Deal, Lead, Package, User } from "@/lib/domain/types";
import { DEAL_STAGE_CONFIG, PROVIDER_CONFIG } from "@/lib/domain/types";
import { date, money, phone } from "@/lib/format";
import { useIsNarrow } from "@/lib/media";
import { Badge, EmptyState, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export interface DealRow {
  deal: Deal;
  lead?: Lead;
  agent?: User;
  packages: Package[];
  commission: number;
  profit: number;
}

export type DealSortField = "closedAt" | "revenue" | "commission" | "profit" | "agent";

export interface DealSort {
  field: DealSortField;
  direction: "asc" | "desc";
}

const COLUMNS: { field: DealSortField; label: string }[] = [
  { field: "closedAt", label: "נסגר" },
  { field: "agent", label: "סוכן" },
  { field: "revenue", label: "הכנסה" },
  { field: "commission", label: "עמלה" },
  { field: "profit", label: "רווח" },
];

export function DealsTable({
  rows,
  sort,
  onSortChange,
  hasFilters,
}: {
  rows: DealRow[];
  sort: DealSort;
  onSortChange: (s: DealSort) => void;
  hasFilters: boolean;
}) {
  const narrow = useIsNarrow();

  function sortBy(field: DealSortField) {
    onSortChange(
      sort.field === field
        ? { field, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface">
        <EmptyState
          icon="deals"
          title={hasFilters ? "אין עסקאות שתואמות לסינון" : "אין עסקאות בטווח הזה"}
          body={
            hasFilters
              ? "נסה להסיר חלק מהמסננים או להרחיב את טווח התאריכים."
              : "נסה טווח תאריכים רחב יותר."
          }
        />
      </div>
    );
  }

  /*
   * ⚠️ בטלפון כרטיסים, לא טבלה. שמונה עמודות ב-`min-w-[760px]` בתוך
   * 360px פירושן ששורה אחת לא ניתנת לקריאה מקצה לקצה — ו"רווח", העמודה
   * האחרונה, היא כל הסיבה שהמסך הזה קיים.
   *
   * וחשוב לא פחות: **כל** המיון חי בכפתורים שבתוך ה-`<th>`, כלומר גם
   * הוא היה מחוץ למסך. לכן הכרטיסים מגיעים עם בורר מיון משלהם — בלעדיו
   * "מי הרוויח הכי הרבה החודש" לא הייתה שאלה שאפשר לשאול מהטלפון.
   */
  if (narrow) {
    return (
      <div className="flex flex-col gap-2">
        <MobileSort sort={sort} onSortChange={onSortChange} />
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <DealCard key={row.deal.id} row={row} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    /*
      גובה מוגבל = scrollport אמיתי. `overflow-x-auto` לבדו כבר הפך את
      העוטף ל-scrollport בשני הצירים, אבל בלי תקרת גובה הוא מעולם לא
      גלל אנכית — ולכן ה-thead ה"נדבק" פשוט נעלם עם גלילת העמוד. אותו
      תיקון שכבר קיים ב-`LeadsTable`, שלא הועתק לכאן.
    */
    <div className="scroll-thin max-h-[calc(100dvh-var(--chrome-h,60px)-180px)] min-h-[240px] overflow-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        {/* נדבקת לראש מיכל הגלילה, לא לסרגל העליון של הדף */}
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-3 py-2.5 text-start font-medium">לקוח</th>
            <th className="px-3 py-2.5 text-start font-medium">חבילות</th>
            <th className="px-3 py-2.5 text-start font-medium">שלב</th>
            {COLUMNS.map((col) => (
              <th
                key={col.field}
                className={`px-3 py-2.5 font-medium ${col.field === "agent" ? "text-start" : "text-end"}`}
              >
                <button
                  onClick={() => sortBy(col.field)}
                  className={`inline-flex items-center gap-1 hover:text-ink-1 ${
                    col.field === "agent" ? "" : "flex-row-reverse"
                  }`}
                >
                  {col.label}
                  {sort.field === col.field && (
                    <Icon
                      name="chevronDown"
                      size={13}
                      className={sort.direction === "asc" ? "rotate-180" : ""}
                    />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <Row key={row.deal.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * בורר המיון של הטלפון.
 *
 * ⚠️ שני פקדים ולא אחד: שדה **וכיוון**. בורר שדה לבדו היה משחזר את
 * הבאג של מסך הלידים, שם הכיוון מקובע לכל שדה ואי אפשר לשאול "מי
 * הרוויח הכי מעט" או "מה נסגר הכי מזמן". הכיוון הוא חצי מהשאלה.
 */
function MobileSort({
  sort,
  onSortChange,
}: {
  sort: DealSort;
  onSortChange: (s: DealSort) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="deals-sort-field">
        מיון לפי
      </label>
      <select
        id="deals-sort-field"
        value={sort.field}
        onChange={(e) =>
          onSortChange({
            field: e.target.value as DealSortField,
            direction: sort.direction,
          })
        }
        className={`${inputClass} w-auto min-w-0 flex-1`}
      >
        {COLUMNS.map((col) => (
          <option key={col.field} value={col.field}>
            מיון: {col.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() =>
          onSortChange({
            field: sort.field,
            direction: sort.direction === "asc" ? "desc" : "asc",
          })
        }
        aria-label={
          sort.direction === "asc"
            ? "מיון עולה — לחץ למיון יורד"
            : "מיון יורד — לחץ למיון עולה"
        }
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors active:bg-surface-3"
      >
        <Icon
          name="chevronDown"
          size={16}
          className={sort.direction === "asc" ? "rotate-180" : ""}
        />
      </button>
    </div>
  );
}

/**
 * כרטיס עסקה — התצוגה בטלפון.
 *
 * הרווח בשורה משלו ובגופן בולט: הוא המספר שבגללו פותחים את המסך, ובטבלה
 * הוא היה בעמודה השמינית — כלומר בפועל בלתי נראה בטלפון.
 */
function DealCard({ row }: { row: DealRow }) {
  const { deal, lead, agent, packages, commission, profit } = row;
  const primaryProvider = packages[0]?.provider;
  const stage = DEAL_STAGE_CONFIG[deal.currentStage];

  return (
    <li
      className="spine relative overflow-hidden rounded-card border border-line bg-surface p-3 ps-4 shadow-card"
      style={
        {
          "--spine-c": primaryProvider
            ? PROVIDER_CONFIG[primaryProvider].accent
            : "transparent",
          "--spine-w": "3px",
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-1">
            {lead?.name ?? "לקוח לא ידוע"}
          </p>
          {lead && (
            <a
              href={`tel:${lead.phone}`}
              className="ltr-num mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-3 active:text-brand"
            >
              <Icon name="phone" size={13} />
              {phone(lead.phone)}
            </a>
          )}
        </div>
        <Badge tone={stage.tone}>{stage.label}</Badge>
      </div>

      <p className="mt-1 truncate text-sm text-ink-2">
        {packages.map((p) => p.name).join(" + ") || "—"}
      </p>

      {/*
        שלושת המספרים בשורה אחת — הם נקראים ביחד ("הכנסה מול רווח") ולא
        לחוד. `min-w-0` על כל אחד כדי שסכום ארוך יקטין את שכנו ולא ידחף
        את הכרטיס מחוץ למסך.
      */}
      <dl className="mt-2 flex items-end justify-between gap-2 border-t border-line pt-2">
        <Figure label="הכנסה" value={money(deal.revenue)} />
        <Figure label="עמלה" value={money(commission)} muted />
        <Figure
          label="רווח"
          value={money(profit)}
          tone={profit >= 0 ? "good" : "bad"}
        />
      </dl>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="truncate">{agent?.name ?? "—"}</span>
        <span className="shrink-0">{date(deal.closedAt)}</span>
      </div>
    </li>
  );
}

function Figure({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-ink-4">{label}</dt>
      <dd
        className={`nums truncate text-sm font-bold ${
          tone === "good"
            ? "text-good"
            : tone === "bad"
              ? "text-bad"
              : muted
                ? "font-medium text-ink-2"
                : "text-ink-1"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Row({ row }: { row: DealRow }) {
  const { deal, lead, agent, packages, commission, profit } = row;
  const primaryProvider = packages[0]?.provider;

  return (
    <tr
      className="border-b border-line last:border-0 hover:bg-surface-2"
      style={
        {
          "--spine-c": primaryProvider
            ? PROVIDER_CONFIG[primaryProvider].accent
            : "transparent",
        } as React.CSSProperties
      }
    >
      {/* `spine-cell` ולא `spine` על ה-`<tr>` — ראה globals.css */}
      <td className="spine-cell px-3 py-2.5">
        <p className="max-w-[200px] truncate font-semibold text-ink-1">
          {lead?.name ?? "לקוח לא ידוע"}
        </p>
        {lead && <p className="ltr-num mt-0.5 text-xs text-ink-3">{phone(lead.phone)}</p>}
      </td>

      <td className="px-3 py-2.5">
        <p className="max-w-[220px] truncate text-ink-2">
          {packages.map((p) => p.name).join(" + ") || "—"}
        </p>
      </td>

      <td className="px-3 py-2.5">
        <Badge tone={DEAL_STAGE_CONFIG[deal.currentStage].tone}>
          {DEAL_STAGE_CONFIG[deal.currentStage].label}
        </Badge>
      </td>

      <td className="px-3 py-2.5 text-end text-xs text-ink-3">{date(deal.closedAt)}</td>

      <td className="px-3 py-2.5 text-ink-2">{agent?.name ?? "—"}</td>

      <td className="nums px-3 py-2.5 text-end font-medium">{money(deal.revenue)}</td>

      <td className="nums px-3 py-2.5 text-end text-ink-2">{money(commission)}</td>

      <td
        className={`nums px-3 py-2.5 text-end font-bold ${
          profit >= 0 ? "text-good" : "text-bad"
        }`}
      >
        {money(profit)}
      </td>
    </tr>
  );
}
