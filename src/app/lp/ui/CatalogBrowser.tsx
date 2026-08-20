"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { PackageCard } from "./PackageCard";
import { CompareTray } from "./CompareTray";
import { shekels } from "../catalog/format";
import { afterPrice } from "../catalog/catalog";
import type { Package } from "../catalog/types";

type SortKey = "price-asc" | "price-desc" | "after-asc" | "recommended";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "מומלצים תחילה" },
  { key: "price-asc", label: "מחיר: מהזול ליקר" },
  { key: "price-desc", label: "מחיר: מהיקר לזול" },
  // No competitor offers this, and it is the honest way to rank a promo market.
  { key: "after-asc", label: "מחיר אחרי ההטבה: מהזול ליקר" },
];

const MAX_COMPARE = 4;

function priceOf(p: Package): number {
  return p.category === "electricity" ? -(p.discountPercent ?? 0) : (p.price ?? Infinity);
}


export function CatalogBrowser({ packages, category }: { packages: Package[]; category: string }) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [compare, setCompare] = useState<Package[]>([]);

  const isElectric = category === "electricity";

  const priceBounds = useMemo(() => {
    const values = packages.map(priceOf).filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
  }, [packages]);

  /**
   * Counts are computed against the *other* active filters, so each option
   * shows how many results it would actually add — the SmartCut pattern.
   */
  const passesExceptProvider = (p: Package) =>
    (selectedTypes.length === 0 || (p.type != null && selectedTypes.includes(p.type))) &&
    (maxPrice == null || priceOf(p) <= maxPrice);

  const providerOptions = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>();
    for (const p of packages) {
      if (!passesExceptProvider(p)) continue;
      const entry = map.get(p.provider.slug) ?? { slug: p.provider.slug, name: p.provider.name, count: 0 };
      entry.count++;
      map.set(p.provider.slug, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, selectedTypes, maxPrice]);

  const typeOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of packages) {
      if (!p.type) continue;
      if (selectedProviders.length && !selectedProviders.includes(p.provider.slug)) continue;
      if (maxPrice != null && priceOf(p) > maxPrice) continue;
      map.set(p.type, (map.get(p.type) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [packages, selectedProviders, maxPrice]);

  const results = useMemo(() => {
    const filtered = packages.filter(
      (p) =>
        (selectedProviders.length === 0 || selectedProviders.includes(p.provider.slug)) &&
        (selectedTypes.length === 0 || (p.type != null && selectedTypes.includes(p.type))) &&
        (maxPrice == null || priceOf(p) <= maxPrice),
    );
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sort === "price-desc") sorted.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "after-asc") sorted.sort((a, b) => afterPrice(a) - afterPrice(b));
    else sorted.sort((a, b) => Number(b.recommended) - Number(a.recommended) || priceOf(a) - priceOf(b));
    return sorted;
  }, [packages, selectedProviders, selectedTypes, maxPrice, sort]);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const toggleCompare = (pkg: Package) =>
    setCompare((prev) =>
      prev.some((p) => p.id === pkg.id)
        ? prev.filter((p) => p.id !== pkg.id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, pkg],
    );

  const hasFilters = selectedProviders.length > 0 || selectedTypes.length > 0 || maxPrice != null;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lp-ink">סינון</h2>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProviders([]);
                  setSelectedTypes([]);
                  setMaxPrice(null);
                }}
                className="text-xs text-lp-brand hover:underline"
              >
                נקה הכל
              </button>
            )}
          </div>

          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-medium text-lp-ink-2">חברה</legend>
            <div className="space-y-1.5">
              {providerOptions.map((o) => (
                <label key={o.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProviders.includes(o.slug)}
                    onChange={() => toggle(selectedProviders, o.slug, setSelectedProviders)}
                    className="h-4 w-4 accent-lp-brand"
                  />
                  <span className="flex-1 text-lp-ink">{o.name}</span>
                  <span className="nums text-xs text-lp-ink-3">{o.count}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {typeOptions.length > 1 && (
            <fieldset className="mb-4">
              <legend className="mb-2 text-xs font-medium text-lp-ink-2">סוג</legend>
              <div className="flex flex-wrap gap-1.5">
                {typeOptions.map(([type, count]) => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(selectedTypes, type, setSelectedTypes)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-lp-brand bg-lp-brand text-lp-ink-invert"
                          : "border-lp-line bg-lp-surface text-lp-ink-2 hover:border-lp-brand"
                      }`}
                    >
                      {type} <span className="nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {priceBounds && !isElectric && (
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-lp-ink-2">
                מחיר עד{" "}
                <span className="nums font-semibold text-lp-ink">
                  {shekels(maxPrice ?? priceBounds.max)}
                </span>
              </legend>
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={1}
                value={maxPrice ?? priceBounds.max}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxPrice(v >= priceBounds.max ? null : v);
                }}
                className="w-full accent-lp-brand"
                aria-label="מחיר מקסימלי"
              />
              <div className="nums mt-1 flex justify-between text-lp-2xs text-lp-ink-3">
                <span>{shekels(priceBounds.min)}</span>
                <span>{shekels(priceBounds.max)}</span>
              </div>
            </fieldset>
          )}
        </Card>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-lp-ink-2">
            <span className="nums font-semibold text-lp-ink">{results.length}</span> חבילות
            {hasFilters && <span className="text-lp-ink-3"> מתוך {packages.length}</span>}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-lp-ink-2">מיון</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-lp-line bg-lp-surface px-2 py-1.5 text-sm transition focus:border-lp-brand"
            >
              {SORTS.filter((s) => !(isElectric && s.key === "after-asc")).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {results.length === 0 ? (
          <p className="rounded-lp-card border border-lp-line bg-lp-surface p-8 text-center text-sm text-lp-ink-2">
            אין חבילות שמתאימות לסינון. נסו להסיר חלק מהמסננים.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                compareChecked={compare.some((p) => p.id === pkg.id)}
                onCompareToggle={toggleCompare}
              />
            ))}
          </div>
        )}
      </div>

      <CompareTray items={compare} onRemove={toggleCompare} onClear={() => setCompare([])} max={MAX_COMPARE} />
    </div>
  );
}
