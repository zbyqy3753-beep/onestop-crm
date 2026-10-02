"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { PackageCard } from "./PackageCard";
import { CompareTray, MAX_COMPARE } from "./CompareTray";
import { shekels } from "../catalog/format";
import { afterPrice } from "../catalog/catalog";
import type { Package } from "../catalog/types";

type SortKey = "price-asc" | "price-desc" | "after-asc" | "recommended";

/*
 * ⚠️ בחשמל אין מחיר — `priceOf` ממפה מסלול חשמל ל-`-discountPercent`,
 * ולכן `price-asc` הוא בפועל "ההנחה הגדולה תחילה". התוויות
 * ה"מחיריות" הן שקר מול כרטיס שמדפיס אחוז ותו לא: הגולש שבחר
 * "מהיקר לזול" קיבל בראש הרשימה את ההנחות הקטנות ביותר. הדף כבר
 * מכיר בזה בשני מקומות אחרים — מחוון המחיר מוסתר בחשמל, וטבלת
 * ההשוואה מחליפה את תווית השורה — רק תפריט המיון נשאר מאחור.
 */
const SORTS: { key: SortKey; label: string; electricLabel?: string }[] = [
  { key: "recommended", label: "מומלצים תחילה" },
  { key: "price-asc", label: "מחיר: מהזול ליקר", electricLabel: "הנחה: מהגבוהה לנמוכה" },
  { key: "price-desc", label: "מחיר: מהיקר לזול", electricLabel: "הנחה: מהנמוכה לגבוהה" },
  // No competitor offers this, and it is the honest way to rank a promo market.
  { key: "after-asc", label: "מחיר אחרי ההטבה: מהזול ליקר" },
];

function priceOf(p: Package): number {
  return p.category === "electricity" ? -(p.discountPercent ?? 0) : (p.price ?? Infinity);
}


export function CatalogBrowser({ packages, category }: { packages: Package[]; category: string }) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [compare, setCompare] = useState<Package[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  /*
    ⚠️ חברה **מסומנת** נשארת ברשימה גם כשהמונה שלה 0. הרשימה
    מחושבת אחרי מסנני הסוג והמחיר, ולכן חברה שאין לה תוצאה בצירוף
    הנוכחי נעלמה מהמסך — אבל ה-slug שלה נשאר ב-`selectedProviders`
    והמשיך לסנן. הגולש קיבל "0 חבילות", תג סינון שמראה 2,
    ושום תיבת סימון לבטל — המוצא היחיד היה "נקה הכל", שמוחק
    גם את מסנן הסוג. מסנן פעיל חייב להיות ניתן לביטול.
  */
  const providerOptions = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>();
    for (const p of packages) {
      const selected = selectedProviders.includes(p.provider.slug);
      if (!selected && !passesExceptProvider(p)) continue;
      const entry = map.get(p.provider.slug) ?? { slug: p.provider.slug, name: p.provider.name, count: 0 };
      if (passesExceptProvider(p)) entry.count++;
      map.set(p.provider.slug, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, selectedProviders, selectedTypes, maxPrice]);

  /* אותו דבר לשבבי הסוג: סוג מסומן נשאר ברשימה כדי שאפשר לבטל אותו. */
  const typeOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of packages) {
      if (!p.type) continue;
      const passes =
        (selectedProviders.length === 0 || selectedProviders.includes(p.provider.slug)) &&
        (maxPrice == null || priceOf(p) <= maxPrice);
      if (!passes && !selectedTypes.includes(p.type)) continue;
      map.set(p.type, (map.get(p.type) ?? 0) + (passes ? 1 : 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [packages, selectedProviders, selectedTypes, maxPrice]);

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

  const activeFilters =
    selectedProviders.length + selectedTypes.length + (maxPrice != null ? 1 : 0);
  const hasFilters = activeFilters > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 lg:mb-3">
            {/*
              ⚠️ מקופל בנייד, פרוש בדסקטופ.

              בדסקטופ זו עמודה צדדית ליד התוצאות, אבל בנייד ה-grid קורס
              לעמודה אחת והפאנל נפרס כבלוק מלא **מעל** הקטלוג: רשימת כל
              החברות, שבבי הסוג ומחוון המחיר: מסך שלם של פקדים לפני שרואים
              חבילה אחת.

              ⚠️ `useState(false)` ולא `useIsNarrow()`. הספק ש-`useIsNarrow`
              קורא (`InitialNarrowProvider`) יושב ב-layout של `(app)`, והדף
              הזה מחוץ לקבוצה: הערך בשרת היה תמיד `false`, כלומר הפאנל היה
              נפרס בטלפון ונסגר בהידרציה. כאן הסגירה היא מצב התחלתי אמיתי
              והדסקטופ נפתח דרך CSS בלבד (`max-lg:hidden`), ולכן אין פער
              בין השרת ללקוח ואין הבהוב.
            */}
            {/*
              ⚠️ `lg:hidden` על הכפתור וכותרת נפרדת לדסקטופ, ולא
              `lg:pointer-events-none` על אותו כפתור. `pointer-events` מנטרל
              את העכבר בלבד: בדסקטופ הכפתור נשאר בסדר ה-Tab, הכריז על עצמו
              `aria-expanded="false"` בזמן שהפאנל פרוש ונראה במלואו, ולחיצה
              ממקלדת הפכה אותו ל-"true" בלי שדבר על המסך ישתנה. פקד שמצהיר
              על מצב שאינו נכון ואינו עושה דבר גרוע מפקד שאינו קיים.
            */}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="lp-filters"
              className="-my-2 flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-lp-ink lg:hidden"
            >
              סינון
              {hasFilters && (
                <span className="nums rounded-full bg-lp-brand px-2 py-0.5 text-lp-2xs font-bold text-lp-ink-invert">
                  {activeFilters}
                </span>
              )}
              <span
                aria-hidden
                className={`text-lp-ink-3 transition ${filtersOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
            <span className="hidden items-center gap-2 text-sm font-semibold text-lp-ink lg:flex">
              סינון
              {hasFilters && (
                <span className="nums rounded-full bg-lp-brand px-2 py-0.5 text-lp-2xs font-bold text-lp-ink-invert">
                  {activeFilters}
                </span>
              )}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProviders([]);
                  setSelectedTypes([]);
                  setMaxPrice(null);
                }}
                className="-my-2 flex min-h-11 items-center py-2 text-xs text-lp-brand hover:underline lg:my-0 lg:min-h-0 lg:py-0"
              >
                נקה הכל
              </button>
            )}
          </div>

          <div id="lp-filters" className={filtersOpen ? "mt-3" : "max-lg:hidden"}>
            <fieldset className="mb-4">
              <legend className="mb-2 text-xs font-medium text-lp-ink-2">חברה</legend>
              <div className="space-y-1.5">
                {providerOptions.map((o) => (
                  <label key={o.slug} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
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

            {/*
              ⚠️ התנאי בודק גם `selectedTypes` ולא רק את מספר האפשרויות.
              ה-memo למעלה כבר משאיר סוג מסומן ברשימה גם כשהמונה שלו 0,
              אבל שער של `> 1` בלבד זרק את העבודה הזו: ברגע שמסנן אחר
              צמצם את התוצאות לסוג יחיד, כל ה-fieldset נעלם מה-DOM יחד
              עם השבב הפעיל. הגולש ראה תג סינון שמראה 2, תוצאות מסוננות,
              ושום שבב לבטל — בדיוק התקלה שהערה על מסנן החברה מתארת.
              מסנן פעיל חייב להיות ניתן לביטול.
            */}
            {(typeOptions.length > 1 || selectedTypes.length > 0) && (
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
                        className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-xs transition ${
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
          </div>
        </Card>
      </aside>

      {/*
        הריפוד שמפנה מקום למגש ההשוואה עבר לשורש הדף (`lp-tray-open`
        ב-`lp.css`, מסומן ע"י `CompareTray`). כאן הוא כיסה את עמודת
        התוצאות בלבד והשאיר את הפוטר מתחת לסרגל.
      */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-lp-ink-2">
            <span className="nums font-semibold text-lp-ink">{results.length}</span> חבילות
            {hasFilters && <span className="text-lp-ink-3"> מתוך {packages.length}</span>}
          </p>
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-lp-ink-2">מיון</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="max-w-full min-w-0 rounded-lg border border-lp-line bg-lp-surface px-2 py-1.5 text-sm transition focus:border-lp-brand"
            >
              {SORTS.filter((s) => !(isElectric && s.key === "after-asc")).map((s) => (
                <option key={s.key} value={s.key}>
                  {isElectric ? (s.electricLabel ?? s.label) : s.label}
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
                compareFull={compare.length >= MAX_COMPARE}
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
