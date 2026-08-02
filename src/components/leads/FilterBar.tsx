"use client";

import type { RefObject } from "react";
import type {
  LeadCategoryKey,
  LeadKind,
  LeadStatus,
  Priority,
  User,
} from "@/lib/domain/types";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
import { Button, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export interface Filters {
  query: string;
  status: LeadStatus[];
  kind: LeadKind[];
  priority: Priority[];
  category: LeadCategoryKey[];
  /** מזהה עובד, או "unassigned" ללידים ללא שיוך */
  assignee: string[];
  openOnly: boolean;
  /** רק לידים שתאריך החזרה שלהם היום או עבר */
  dueToday: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  status: [],
  kind: [],
  priority: [],
  category: [],
  assignee: [],
  openOnly: false,
  dueToday: false,
};

export function FilterBar({
  filters,
  onChange,
  users,
  searchRef,
  selectedCount,
  onBulkAssign,
  onBulkStatus,
  onBulkDelete,
  onClearSelection,
  columnPicker,
  overflow,
  busy,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  users: User[];
  /** בורר העמודות, מוזרק מבחוץ כדי ש-FilterBar יישאר על סינון בלבד */
  columnPicker?: React.ReactNode;
  /**
   * כפתור ה-`⋯` של הטלפון. יושב בשורת החיפוש ולא בשורה משלו — שורה
   * נוספת היא 44px מתוך המסך, ושורת החיפוש ממילא לא מנוצלת עד הסוף.
   */
  overflow?: React.ReactNode;
  searchRef: RefObject<HTMLInputElement | null>;
  selectedCount: number;
  onBulkAssign: (assigneeId: string | null) => void;
  onBulkStatus: (to: LeadStatus) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  busy: boolean;
}) {
  const activeCount =
    filters.status.length +
    filters.kind.length +
    filters.priority.length +
    filters.category.length +
    filters.assignee.length +
    (filters.openOnly ? 1 : 0) +
    (filters.dueToday ? 1 : 0) +
    (filters.query ? 1 : 0);

  // סרגל הפעולות מחליף את המסננים כשיש בחירה — שני מצבים, לא שני סרגלים
  if (selectedCount > 0) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-brand/30 bg-brand-soft px-3 py-2">
        <span className="text-sm font-semibold text-brand">
          {selectedCount} נבחרו
        </span>

        <select
          className={`${inputClass} w-auto`}
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onBulkAssign(v === "unassigned" ? null : v);
            e.target.value = "";
          }}
        >
          <option value="">שיוך לעובד…</option>
          <option value="unassigned">הסרת שיוך</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          className={`${inputClass} w-auto`}
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value as LeadStatus;
            if (v) onBulkStatus(v);
            e.target.value = "";
          }}
        >
          <option value="">שינוי סטטוס…</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>

        <Button variant="ghost" icon="trash" onClick={onBulkDelete} disabled={busy}>
          מחיקה
        </Button>

        <Button variant="ghost" onClick={onClearSelection} className="ms-auto">
          ביטול הבחירה
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ink-4">
          <Icon name="search" size={16} />
        </span>
        <input
          ref={searchRef}
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="חיפוש לפי שם, טלפון או עיר…"
          className={`${inputClass} ps-8`}
          aria-label="חיפוש לידים"
        />
        {/* `lg:` ולא `sm:` — קיצור המקלדת קיים רק במסך עם מקלדת, וזה
            אותו סף שבו `useIsNarrow` מחליף לתצוגת כרטיסים (1024px).
            ב-`sm:` הרמז הופיע גם בטאבלט ובטלפון גדול בנוף. */}
        <kbd className="pointer-events-none absolute inset-y-0 end-2.5 my-auto hidden h-4 items-center rounded border border-line px-1 text-[10px] text-ink-4 lg:flex">
          /
        </kbd>
      </div>

      {/*
        אין כאן יותר MultiSelect-ים לסוג/עדיפות/קטגוריה/עובד.
        קוביות הסטטוס (`StatusTiles`) מסננות לפי הדבר שבאמת מסננים
        לפיו, והתצוגות המהירות ב-`QueueHeader` מכסות את השאר — "שלי",
        "דחוף", "ללא שיוך", "לידים חמים". ארבעה תפריטים שצריך לפתוח
        כדי לגלות אם יש בהם משהו היו עלות בלי תמורה.

        השדות עצמם נשארו ב-`Filters` ובשרת: התצוגות המהירות משתמשות
        בהם, והם יחזרו כשיהיה צורך אמיתי בסינון עדין יותר.
      */}

      {activeCount > 0 && (
        <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
          ניקוי ({activeCount})
        </Button>
      )}

      {/* בורר העמודות בקצה השורה — הוא שולט בתצוגה, לא מסנן */}
      <div className="ms-auto flex items-center gap-2">
        {columnPicker}
        {overflow}
      </div>
    </div>
  );
}
