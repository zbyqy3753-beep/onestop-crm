"use client";

import type { CategoryKey, ProviderKey, User } from "@/lib/domain/types";
import {
  CATEGORY_CONFIG,
  DEAL_STAGE_CONFIG,
  DEAL_STAGE_ORDER,
  PROVIDER_CONFIG,
} from "@/lib/domain/types";
import { Button, MultiSelect, inputClass } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { DEFAULT_DEAL_FILTERS, type DealFilters } from "./filters";

export function DealsFilterBar({
  filters,
  onChange,
  users,
  providerOptions,
  categoryOptions,
}: {
  filters: DealFilters;
  onChange: (f: DealFilters) => void;
  users: User[];
  providerOptions: ProviderKey[];
  categoryOptions: CategoryKey[];
}) {
  const activeCount =
    filters.agent.length +
    filters.provider.length +
    filters.category.length +
    filters.stage.length +
    (filters.query ? 1 : 0);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* `min-w-[140px]` בצר — ראה ההערה ב-`leads/FilterBar.tsx` */}
      <div className="relative min-w-[140px] flex-1 sm:min-w-[200px] sm:max-w-xs">
        <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ink-4">
          <Icon name="search" size={16} />
        </span>
        <input
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="חיפוש לפי לקוח, סוכן או חבילה…"
          className={`${inputClass} ps-8`}
          aria-label="חיפוש עסקאות"
        />
      </div>

      <MultiSelect
        label="סוכן"
        options={users.map((u) => ({ value: u.id, label: u.name }))}
        selected={filters.agent}
        onChange={(v) => onChange({ ...filters, agent: v })}
      />

      <MultiSelect
        label="חברה"
        options={providerOptions.map((p) => ({
          value: p,
          label: PROVIDER_CONFIG[p].label,
        }))}
        selected={filters.provider}
        onChange={(v) => onChange({ ...filters, provider: v as ProviderKey[] })}
      />

      <MultiSelect
        label="קטגוריה"
        options={categoryOptions.map((c) => ({
          value: c,
          label: CATEGORY_CONFIG[c].label,
        }))}
        selected={filters.category}
        onChange={(v) => onChange({ ...filters, category: v as CategoryKey[] })}
      />

      <MultiSelect
        label="שלב"
        options={DEAL_STAGE_ORDER.map((s) => ({
          value: s,
          label: DEAL_STAGE_CONFIG[s].label,
        }))}
        selected={filters.stage}
        onChange={(v) => onChange({ ...filters, stage: v as typeof filters.stage })}
      />

      {activeCount > 0 && (
        <Button
          variant="ghost"
          onClick={() =>
            onChange({ ...DEFAULT_DEAL_FILTERS, range: filters.range })
          }
        >
          ניקוי ({activeCount})
        </Button>
      )}
    </div>
  );
}
