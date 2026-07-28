"use client";

import type { Lead, LeadKind } from "@/lib/domain/types";
import { KIND_CONFIG } from "@/lib/domain/types";
import { number } from "@/lib/format";
import { Icon, type IconKey } from "@/components/ui/Icon";
import type { Filters } from "./FilterBar";

/**
 * שלושת האריחים הגדולים מעל הטבלה: הכל / חם / מדאטה.
 *
 * כל אריח נוגע רק ב-`filters.kind`, ולכן הוא מצטרף לשאר הסינונים
 * במקום לאפס אותם — אפשר להיות ב"לידים חמים" וגם לסנן לפי סטטוס.
 * המצב הפעיל נקרא בחזרה מהמסנן עצמו ולא ממצב מקומי, כדי שלא ייווצר
 * מצב שבו אריח נראה פעיל אבל הסינון אומר אחרת.
 */

type Scope = "all" | LeadKind;

const TILES: { scope: Scope; label: string; icon: IconKey }[] = [
  { scope: "all", label: "כל הלידים", icon: "leads" },
  { scope: "hot", label: KIND_CONFIG.hot.plural, icon: "clock" },
  { scope: "data", label: KIND_CONFIG.data.plural, icon: "dashboard" },
];

export function ScopeTiles({
  leads,
  filters,
  onChange,
}: {
  leads: Lead[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const counts: Record<Scope, number> = {
    all: leads.length,
    hot: leads.filter((l) => l.kind === "hot").length,
    data: leads.filter((l) => l.kind === "data").length,
  };

  const active: Scope =
    filters.kind.length === 1 ? filters.kind[0] : "all";

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      {TILES.map((tile) => {
        const isActive = active === tile.scope;
        return (
          <button
            key={tile.scope}
            onClick={() =>
              onChange({
                ...filters,
                kind: tile.scope === "all" ? [] : [tile.scope],
              })
            }
            aria-pressed={isActive}
            className={`flex items-center gap-3 rounded-card border px-4 py-3 text-start transition-colors ${
              isActive
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${
                isActive ? "bg-brand text-on-brand" : "bg-surface-3 text-ink-3"
              }`}
            >
              <Icon name={tile.icon} size={17} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-ink-3">
                {tile.label}
              </span>
              <span
                className={`nums block text-xl font-bold leading-tight ${
                  isActive ? "text-brand" : "text-ink-1"
                }`}
              >
                {number(counts[tile.scope])}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
