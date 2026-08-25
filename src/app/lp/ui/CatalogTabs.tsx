"use client";

import { useCallback, useEffect, useState } from "react";
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

/** `#cellular` וכדומה → קטגוריה. כל עוגן אחר אינו שלנו ומוחזר `null`. */
function categoryFromHash(hash: string): Category | null {
  const key = hash.replace(/^#/, "");
  return CATEGORY_ORDER.find((c) => c === key) ?? null;
}

export function CatalogTabs({ packages }: { packages: Package[] }) {
  const [category, setCategory] = useState<Category>("cellular");

  /*
   * ⚠️ העוגן הוא הגשר בין הסקשנים שמעל לקטלוג.
   *
   * בעמוד הבית של האתר הציבורי כל כרטיס שירות וכל "לכל החבילות" מוביל
   * לעמוד קטגוריה. כאן אין עמודים כאלה, ולכן הקישורים האלה הם עוגנים
   * והקטלוג הוא שמקשיב להם. הגלילה נעשית מכאן ולא בידי הדפדפן: אין
   * אלמנט עם `id="cellular"` בדף — הקטגוריה היא מצב של רכיב, לא מקום.
   */
  const applyHash = useCallback(() => {
    const next = categoryFromHash(window.location.hash);
    if (!next) return;

    /*
     * ⚠️ מנקים את העוגן **לפני** הגלילה, ושני חצאי המשפט חשובים.
     *
     * מנקים, כי לחיצה על עוגן שכבר נמצא בכתובת אינה מפיקה
     * `hashchange` — בלי זה, מבקר שלחץ "סלולר", גלל למטה ולחץ שוב לא
     * היה זז. לפני הגלילה, כי עדכון היסטוריה באותו מסמך מבטל גלילה
     * חלקה שכבר יצאה לדרך: בסדר ההפוך הקטגוריה התחלפה והדף נשאר
     * במקומו.
     */
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setCategory(next);
    /*
     * ⚠️ `instant` ולא `smooth`, ולא מטעמי טעם.
     *
     * גלילה חלקה תלויה בכך שהדפדפן באמת מנפיש אותה; בסביבה שאינה
     * מציירת פריימים (תצוגה מוטמעת, כרטיסייה ברקע) הקריאה חוזרת מיד
     * ולא זזה כלום — הקטגוריה מתחלפת והמבקר נשאר בראש הדף בלי לדעת
     * שמשהו קרה. קפיצה מיידית היא גם בדיוק מה שעוגן רגיל עושה.
     */
    document.getElementById("catalog")?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", applyHash);
    /*
     * ⚠️ הקריאה הראשונה נדחית לפריים הבא, ולא נעשית כאן בגוף האפקט.
     *
     * שתי סיבות שמצביעות לאותו כיוון: `scrollIntoView` לפני הציור
     * הראשון גולל אל פריסה שעוד לא נמדדה, ו-`setState` סינכרוני בתוך
     * אפקט הוא בדיוק מה ש-`react-hooks/set-state-in-effect` פוסל.
     * הקריאה מטפלת רק במי שנחת ישירות על `/lp#electricity` — כל שאר
     * המקרים מגיעים דרך `hashchange`.
     */
    const frame = requestAnimationFrame(applyHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", applyHash);
    };
  }, [applyHash]);

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
