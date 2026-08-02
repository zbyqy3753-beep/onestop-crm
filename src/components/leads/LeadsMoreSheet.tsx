"use client";

import { Modal } from "@/components/ui/primitives";
import { Icon, type IconKey } from "@/components/ui/Icon";

/**
 * פעולות המסך שאינן חלק מהחיוג — בטלפון בלבד.
 *
 * ⚠️ קיים כדי לפנות מקום, לא כדי להסתיר. ייבוא, ייצוא ונתונים
 * פיננסיים הן פעולות של עבודה ממחשב שתפסו 111px בראש **כל** מסך
 * לידים בטלפון, לצד "בחירה" שתפסה עוד 36. יחד הם דחפו את הליד הראשון
 * ל-49% מגובה המסך.
 *
 * "ליד חדש" **לא** כאן: היא הפעולה היחידה בקבוצה שנעשית תוך כדי
 * שיחה, ולכן היא FAB בגובה האגודל.
 */
export function LeadsMoreSheet({
  open,
  onClose,
  onImport,
  onExport,
  onToggleStats,
  statsOpen,
  onStartSelection,
  canExport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: () => void;
  onExport: () => void;
  onToggleStats: () => void;
  statsOpen: boolean;
  onStartSelection: () => void;
  canExport: boolean;
}) {
  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="פעולות">
      <div className="flex flex-col">
        <Row
          icon="check"
          label="בחירה מרובה"
          hint="שיוך, שינוי סטטוס או מחיקה לכמה לידים"
          onClick={() => run(onStartSelection)}
        />
        <Row
          icon="upload"
          label="ייבוא מקובץ"
          hint="CSV או Excel"
          onClick={() => run(onImport)}
        />
        <Row
          icon="download"
          label="ייצוא"
          hint={canExport ? "הלידים המוצגים כרגע" : "אין לידים לייצוא"}
          disabled={!canExport}
          onClick={() => run(onExport)}
        />
        <Row
          icon="dashboard"
          label="נתונים פיננסיים"
          hint={statsOpen ? "מוצג כרגע" : "עלויות, החזר וביצועים"}
          onClick={() => run(onToggleStats)}
        />
      </div>
    </Modal>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
  disabled = false,
}: {
  icon: IconKey;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 text-start transition-colors active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-2">
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-1">{label}</span>
        <span className="block truncate text-xs text-ink-3">{hint}</span>
      </span>
    </button>
  );
}
