"use client";

import { useState } from "react";
import { CatalogBrowser } from "./CatalogBrowser";
import { CATEGORY_META, CATEGORY_ORDER } from "../catalog/catalog";
import type { Category, Package } from "../catalog/types";

/**
 * מעבר בין שלוש הקטגוריות של הקטלוג.
 *
 * ⚠️ הכול בצד הלקוח ולא נתיב לכל קטגוריה, בניגוד לאתר הציבורי (שם
 * `/cellular`, `/home` ו-`/electricity` הם עמודים נפרדים לצורכי SEO).
 * כאן הדף אינו מאונדקס ממילא, ומעבר בין קטגוריות בלי טעינה מחדש שומר
 * על הסינון והשוואת החבילות שהמבקר כבר בנה.
 */
export function CatalogTabs({ packages }: { packages: Package[] }) {
  const [category, setCategory] = useState<Category>("cellular");

  const shown = packages.filter((p) => p.category === category);

  return (
    <>
      <div
        role="tablist"
        aria-label="קטגוריות"
        className="mb-6 flex flex-wrap gap-2 border-b border-lp-line pb-4"
      >
        {CATEGORY_ORDER.map((key) => {
          const active = key === category;
          const count = packages.filter((p) => p.category === key).length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(key)}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-lp-brand text-lp-ink-invert"
                  : "border border-lp-line bg-lp-surface text-lp-ink-2 hover:border-lp-brand hover:text-lp-brand"
              }`}
            >
              {CATEGORY_META[key].he}
              <span className="nums ms-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-5 text-sm text-lp-ink-2">{CATEGORY_META[category].blurb}</p>

      {/*
        ⚠️ `key` על הקטגוריה, ובכוונה: `CatalogBrowser` מחזיק סינון,
        מיון והשוואה במצב פנימי. בלי המפתח, מעבר מסלולר לחשמל היה משאיר
        מסנן "מהירות" פעיל על רשימה שאין בה מהירות — ומציג אפס תוצאות
        בלי שום הסבר.
      */}
      <CatalogBrowser key={category} packages={shown} category={category} />
    </>
  );
}
