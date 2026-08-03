"use client";

import type {
  Lead,
  LeadCategoryKey,
  LeadStatus,
  Priority,
  User,
} from "@/lib/domain/types";
import {
  LEAD_CATEGORY_CONFIG,
  LEAD_CATEGORY_ORDER,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  PROVIDER_CONFIG,
  SOURCE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import type { LeadPatch } from "@/app/(app)/leads/actions";
import { TONE_VAR, date, phone, relative, until } from "@/lib/format";
import { calendarDaysBetween, dayKey } from "@/lib/tz";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import {
  CostCell,
  FollowUpCell,
  InlinePicker,
  RowActions,
  StarToggle,
  StatusPicker,
} from "./cells";
import { buildTimeline } from "./ActivityFeed";
import type { ColumnDef, ColumnKey } from "./columns";

/** ISO → `YYYY-MM-DD` בשעון ישראל, כפי ש-`<input type="date">` מצפה. */
function isoToDateInput(iso: string): string {
  return dayKey(Date.parse(iso));
}

/** מחלקות התא לכל עמודה — נשמר כאן ולא ב-columns.ts כדי ש-columns.ts יישאר נטול JSX. */
const CELL_CLASS: Record<ColumnKey, string> = {
  name: "px-3 py-3",
  status: "px-3 py-2.5",
  priority: "px-3 py-2.5",
  updatedAt: "whitespace-nowrap px-3 py-2.5 text-xs text-ink-3",
  followUpAt: "whitespace-nowrap px-3 py-2.5 text-xs",
  category: "px-3 py-2.5 text-xs text-ink-2",
  cost: "px-3 py-2.5",
  assignee: "px-3 py-2.5",
  activity: "px-3 py-2.5",
  packageName: "px-3 py-2.5 text-xs text-ink-2",
  source: "px-3 py-2.5 text-xs text-ink-2",
  provider: "whitespace-nowrap px-3 py-2.5 text-xs text-ink-2",
  city: "whitespace-nowrap px-3 py-2.5 text-xs text-ink-2",
  email: "px-3 py-2.5 text-xs",
  createdAt: "whitespace-nowrap px-3 py-2.5 text-xs text-ink-3",
  lastContactAt: "whitespace-nowrap px-3 py-2.5 text-xs text-ink-3",
};

/** שורה אחת בטבלת הלידים. */
export function LeadRow({
  lead,
  now,
  assignee,
  userById,
  columns,
  cost,
  checked,
  busy,
  onToggle,
  onOpen,
  onStatus,
  onCost,
  onStar,
  onPatch,
  users,
}: {
  lead: Lead;
  now: number | null;
  assignee?: User;
  /** למי שם הפעולות בציר הזמן שייך */
  userById: Map<string, User>;
  /** העמודות המוצגות, בסדר שנקבע ב-columns.ts */
  columns: ColumnDef[];
  /** העלות האפקטיבית — פרטנית אם הוגדרה, אחרת של הקטגוריה */
  cost: number;
  checked: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (to: LeadStatus) => void;
  onCost: (cost: number | null) => void;
  onStar: (next: boolean) => void;
  /** עריכה מהירה של שדה בודד מתוך השורה */
  onPatch: (patch: LeadPatch) => void;
  /** העובדים שאפשר לשייך אליהם — פעילים בלבד */
  users: User[];
}) {
  const status = STATUS_CONFIG[lead.status];
  const priority = PRIORITY_CONFIG[lead.priority];

  /** הפירוט האחרון שהסוכן הזין — מה שהוא באמת צריך לראות לפני חיוג. */
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;

  /**
   * שתי שורות הפעילות שמוצגות בטבלה.
   *
   * שני תיקונים מול הצגת הציר הגולמי:
   *  - סימון/ביטול כוכב מסוננים החוצה. הם פעולה בת-לחיצה-אחת ולכן
   *    תכופה, והם היו תופסים את שתי המשבצות ודוחקים החוצה את שינוי
   *    הסטטוס — בדיוק מה שהסוכן צריך לראות.
   *  - הכותרת והפירוט מוצגים יחד. פירוט לבדו נתן שורות חסרות הקשר
   *    כמו "25 ₪" בלי לומר שהעלות עודכנה.
   */
  const preview = buildTimeline(lead, userById)
    .filter((e) => e.activityType !== "starred" && e.activityType !== "unstarred")
    .slice(0, 2)
    .map((e) => ({
      id: e.id,
      full: e.detail?.trim() ? `${e.title} — ${e.detail.trim()}` : e.title,
    }));

  /** ריק עד ההרכבה — "עכשיו" לא קיים בשרת, ונוצרת אי-התאמת הידרציה. */
  const skeleton = (w: string) => <span className={`inline-block h-3.5 ${w}`} />;
  const dash = <span className="text-xs text-ink-4">—</span>;

  function renderCell(key: ColumnKey) {
    switch (key) {
      case "name":
        return (
          <span className="flex items-center gap-1.5">
            <StarToggle lead={lead} onToggle={onStar} busy={busy} />
            <button
              onClick={onOpen}
              title={lead.name}
              className="block max-w-[260px] text-start"
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-semibold text-ink-1 group-hover:text-brand">
                  {lead.name}
                </span>
                {lead.kind === "hot" && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-bad"
                    title="ליד חם"
                    aria-label="ליד חם"
                  />
                )}
              </span>
              <span className="ltr-num mt-0.5 block text-[13px] text-ink-3">
                {phone(lead.phone)}
              </span>
            </button>
          </span>
        );

      case "status":
        return (
          <>
            <StatusPicker current={lead.status} onPick={onStatus} busy={busy} />
            {lastDetail && (
              // ink-3 ולא ink-4: זה הטקסט שהסוכן קורא לפני חיוג
              <p
                className="mt-1 max-w-[320px] truncate text-xs text-ink-3"
                title={lastDetail}
              >
                {lastDetail}
              </p>
            )}
          </>
        );

      case "priority":
        return (
          <InlinePicker
            value={lead.priority}
            label="שינוי עדיפות"
            busy={busy}
            onPick={(v) => onPatch({ priority: v as Priority })}
            options={PRIORITY_ORDER.map((p) => ({
              value: p,
              label: PRIORITY_CONFIG[p].label,
            }))}
          >
            {lead.priority === "normal" ? (
              dash
            ) : (
              <Badge tone={priority.tone}>{priority.label}</Badge>
            )}
          </InlinePicker>
        );

      case "updatedAt":
        return now === null ? skeleton("w-16") : relative(lead.updatedAt, now);

      case "followUpAt": {
        if (now === null) return skeleton("w-14");
        // באיחור — אדום ומודגש. חזרה שעברה היא לא "תזכורת", היא חוב.
        // `until()` כבר אומר "באיחור X ימים"; היום/עתיד נשארים בצהוב.
        const followUpOverdue =
          lead.followUpAt !== undefined &&
          calendarDaysBetween(now, Date.parse(lead.followUpAt)) < 0;
        return (
          <FollowUpCell
            // `<input type="date">` מצפה ל-YYYY-MM-DD בשעון המקומי,
            // ו-toISOString היה מחזיר UTC ומזיז יום סביב חצות
            value={lead.followUpAt ? isoToDateInput(lead.followUpAt) : ""}
            busy={busy}
            onPick={(v) => onPatch({ followUpDate: v || null })}
          >
            {lead.followUpAt ? (
              <span
                className={`flex items-center gap-1 ${
                  followUpOverdue ? "font-semibold text-bad" : "text-warn"
                }`}
              >
                <Icon name="clock" size={12} />
                {until(lead.followUpAt, now)}
              </span>
            ) : (
              dash
            )}
          </FollowUpCell>
        );
      }

      // סוג הליד (חם/דאטה) לא חוזר כאן — הוא כבר מסומן בנקודה שליד השם
      case "category":
        return (
          <InlinePicker
            value={lead.category ?? ""}
            label="שינוי קטגוריה"
            busy={busy}
            onPick={(v) =>
              onPatch({ category: (v as LeadCategoryKey) || null })
            }
            options={[
              { value: "", label: "ללא קטגוריה" },
              ...LEAD_CATEGORY_ORDER.map((c) => ({
                value: c,
                label: LEAD_CATEGORY_CONFIG[c].label,
              })),
            ]}
          >
            {lead.category ? LEAD_CATEGORY_CONFIG[lead.category].label : dash}
          </InlinePicker>
        );

      case "cost":
        return <CostCell lead={lead} effective={cost} onSave={onCost} busy={busy} />;

      case "assignee":
        return (
          <InlinePicker
            value={lead.assigneeId ?? ""}
            label="שיוך לעובד"
            busy={busy}
            onPick={(v) => onPatch({ assigneeId: v || null })}
            options={[
              { value: "", label: "ללא שיוך" },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
          >
            {assignee ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[9px] font-bold text-ink-2">
                  {assignee.name.slice(0, 2)}
                </span>
                {/* truncate: שם ארוך היה נשבר לשתי שורות ומגביה את השורה */}
                <span className="max-w-[110px] truncate" title={assignee.name}>
                  {assignee.name}
                </span>
              </span>
            ) : (
              <span className="text-xs text-ink-4">ללא שיוך</span>
            )}
          </InlinePicker>
        );

      case "activity":
        return (
          <>
            {preview.length === 0 ? (
              dash
            ) : (
              <ul className="space-y-0.5">
                {preview.map((entry) => (
                  <li
                    key={entry.id}
                    className="max-w-[190px] truncate text-xs text-ink-3"
                    title={entry.full}
                  >
                    {entry.full}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={onOpen}
              className="mt-0.5 text-xs text-brand hover:underline"
            >
              + הערה
            </button>
          </>
        );

      case "packageName": {
        const pkg = lead.packageName?.trim();
        if (!pkg) return dash;

        // ⚠️ הספק נכלל בתווית. השותפים שולחים "ULTIMATE – YES" כמחרוזת
        // אחת, ואנחנו מפרקים אותה לשתי עמודות — נכון לסינון, אבל החבילה
        // לבדה נראית חתוכה: "ULTIMATE" בלי "YES" הוא לא שם חבילה.
        // עמודת "ספק נוכחי" כבויה כברירת מחדל, ולכן בלי האיחוד כאן
        // המידע פשוט לא מופיע במסך.
        const label = lead.currentProvider
          ? `${PROVIDER_CONFIG[lead.currentProvider].label} ${pkg}`
          : pkg;
        return (
          <span className="block max-w-[180px] truncate" title={label}>
            {label}
          </span>
        );
      }

      case "source": {
        // הטקסט החופשי הוא מה שמעניין ("פלאפון – 300GB Perfect");
        // ה-enum הוא רק אופן הקליטה ולכן משני
        const detail = lead.sourceDetail?.trim();
        return (
          <span className="block max-w-[180px] truncate" title={detail ?? undefined}>
            {detail || <span className="text-ink-4">{SOURCE_CONFIG[lead.source].label}</span>}
          </span>
        );
      }

      case "provider":
        return lead.currentProvider
          ? PROVIDER_CONFIG[lead.currentProvider].label
          : dash;

      case "city":
        return lead.city || dash;

      case "email":
        return lead.email ? (
          <a
            href={`mailto:${lead.email}`}
            onClick={(e) => e.stopPropagation()}
            className="ltr-num block max-w-[190px] truncate text-info hover:underline"
            title={lead.email}
          >
            {lead.email}
          </a>
        ) : (
          dash
        );

      case "createdAt":
        return date(lead.createdAt);

      case "lastContactAt":
        return lead.lastContactAt ? date(lead.lastContactAt) : dash;
    }
  }

  return (
    <tr
      className="group border-b border-line last:border-0 hover:bg-surface-2"
      style={
        {
          "--spine-c": TONE_VAR[status.tone],
          "--spine-w": lead.priority === "urgent" ? "5px" : "3px",
        } as React.CSSProperties
      }
    >
      {/* הפס יושב על התא ולא על השורה — `::before` על `table-row` היה
          מייצר תא אנונימי ומזיז את כל העמודות. ראה globals.css. */}
      <td className="spine-cell ps-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`בחירת ${lead.name}`}
          className="accent-[var(--c-brand)]"
        />
      </td>

      {columns.map((col) => (
        <td key={col.key} className={CELL_CLASS[col.key]}>
          {renderCell(col.key)}
        </td>
      ))}

      {/* פעולות יצירת קשר. גלויות תמיד, לא מוסתרות מאחורי hover. */}
      <td className="pe-3">
        <RowActions lead={lead} onOpen={onOpen} />
      </td>
    </tr>
  );
}
