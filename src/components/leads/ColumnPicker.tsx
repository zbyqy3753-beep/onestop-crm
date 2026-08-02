"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useDetailsAutoClose } from "@/lib/overlay";
import {
  DEFAULT_VISIBLE,
  TOGGLEABLE,
  type ColumnKey,
} from "./columns";

/**
 * בורר העמודות של הטבלה.
 *
 * בנוי על `<details>` כמו `MultiSelect` שבשאר המסך, כדי שההתנהגות
 * תהיה זהה — כולל הסגירה בלחיצה בחוץ, שאינה מובנית ב-`<details>`
 * ומגיעה מ-`useDetailsAutoClose`.
 */
export function ColumnPicker({
  visible,
  onChange,
}: {
  visible: ColumnKey[];
  onChange: (keys: ColumnKey[]) => void;
}) {
  const extras = TOGGLEABLE.filter((c) => !c.defaultOn && visible.includes(c.key));

  function toggle(key: ColumnKey) {
    onChange(
      visible.includes(key)
        ? visible.filter((k) => k !== key)
        : [...visible, key],
    );
  }

  const ref = useRef<HTMLDetailsElement>(null);
  useDetailsAutoClose(ref);

  return (
    <details ref={ref} className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-line px-2.5 text-sm text-ink-2 hover:bg-surface-2 active:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <Icon name="filter" size={15} />
        עמודות
        {extras.length > 0 && (
          <span className="nums rounded-full bg-brand px-1.5 text-[11px] font-semibold text-on-brand">
            {extras.length}
          </span>
        )}
        <Icon name="chevronDown" size={13} className="group-open:rotate-180" />
      </summary>

      <div className="scroll-thin absolute end-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-card border border-line bg-surface p-1.5 shadow-pop">
        {TOGGLEABLE.map((col) => (
          <label
            key={col.key}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={visible.includes(col.key)}
              onChange={() => toggle(col.key)}
              className="accent-[var(--c-brand)]"
            />
            {col.label}
          </label>
        ))}

        <button
          onClick={() => onChange(DEFAULT_VISIBLE)}
          className="mt-1 w-full rounded-md px-2 py-1.5 text-start text-xs text-ink-3 hover:bg-surface-2 hover:text-ink-1"
        >
          איפוס לברירת המחדל
        </button>
      </div>
    </details>
  );
}
