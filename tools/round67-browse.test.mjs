import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף — ראה `lpBrowse.test.mjs` לנימוק
 * המלא (מודול `"use server"` עם `await` ברמת המודול, ש-tsx אינו יכול
 * לקמפל ל-CJS; שרשרת הייבוא היא `CatalogBrowser → PackageCard →
 * LeadForm → ../actions`).
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { basePackages, byCategory, listable, providerSlug } = await import(
  "../src/app/lp/catalog/catalog.ts"
);
const { facetOptions, matchesFilters, priceBoundsOf, resolveMaxPrice } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);

const ALL = listable(basePackages());
const NO_FILTERS = { providers: [], types: [], maxPrice: null };

/** הרשימה שמרונדרת במצב `f`, בתקרה המיושבת שלה. */
function shownFor(pkgs, f) {
  const eff = resolveMaxPrice(
    priceBoundsOf(pkgs.filter((p) => matchesFilters(p, f, "maxPrice"))),
    f.maxPrice,
  );
  return pkgs.filter((p) => matchesFilters(p, { ...f, maxPrice: eff }));
}

/*
 * סבב 67, `CatalogBrowser.tsx`. ההצמדה כלפי מעלה שב-`resolveMaxPrice`
 * נמדדה בשני המשטחים מול שתי רשימות שונות — התוצאות מול הרשימה
 * המסוננת, והמונה על השבב מול הרשימה המורחבת — ולכן השבב הדלוק הכריז
 * 0 מעל כרטיס שמרונדר מתחתיו. ראה `facetMaxPrice`.
 */
test("שבב סוג דלוק אינו מכריז 0 מעל כרטיס שמרונדר (id 121, ₪34)", () => {
  const cellular = byCategory(ALL, "cellular");
  const f = { providers: [], types: ["5G"], maxPrice: 22 };
  const shown = shownFor(cellular, f);
  // התקרה הגולמית ₪22 נפלה מתחת ל-min של רשימת ה-5G, ולכן ההצמדה
  // מעלה אותה ל-₪34 ו-id 121 מרונדרת.
  assert.deepEqual(
    shown.map((p) => String(p.id)),
    ["121"],
  );
  const count = facetOptions(cellular, f).types.find(([t]) => t === "5G")?.[1];
  assert.equal(count, 1, "המונה על השבב הדלוק נספר באותה מדרגה שהתוצאות נחתכות בה");
});

/*
 * האינווריאנט עצמו, על כל מצב סינון נגיש: מונה של שבב **דלוק** אינו
 * נמוך ממספר הכרטיסים שמרונדרים ונושאים אותו ערך. (הכיוון ההפוך —
 * מונה גבוה מהמרונדר — הוא ה-SmartCut המתועד ב-`providerFacets`,
 * שסופר עם הציר מנוטרל, ולכן אינו נבדק כאן.)
 */
test("מונה של שבב דלוק אינו נמוך מהכרטיסים שמרונדרים תחתיו", () => {
  let states = 0;
  for (const category of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, category);
    const provs = [...new Set(pkgs.map((p) => providerSlug(p)).filter(Boolean))];
    const types = facetOptions(pkgs, NO_FILTERS).types.map(([t]) => t);
    const b = priceBoundsOf(pkgs);
    const prices = b
      ? [null, b.min, Math.round((b.min + b.max) / 2), b.max, b.min - 3, b.min - 12]
      : [null];
    const provSets = [
      [],
      ...provs.map((p) => [p]),
      ...provs.slice(0, 4).flatMap((a) => provs.slice(0, 4).filter((x) => x !== a).map((x) => [a, x])),
    ];
    const typeSets = [
      [],
      ...types.map((t) => [t]),
      ...types.slice(0, 3).flatMap((a) => types.slice(0, 3).filter((x) => x !== a).map((x) => [a, x])),
    ];
    for (const providers of provSets) {
      for (const typeSel of typeSets) {
        for (const maxPrice of prices) {
          const f = { providers, types: typeSel, maxPrice };
          const shown = shownFor(pkgs, f);
          const facets = facetOptions(pkgs, f);
          states++;
          for (const [type, count] of facets.types) {
            if (!typeSel.includes(type)) continue;
            const rendered = shown.filter((p) =>
              matchesFilters(p, { providers: [], types: [type], maxPrice: null }),
            ).length;
            assert.ok(
              count >= rendered,
              `${category} ${JSON.stringify(f)}: שבב סוג "${type}" מכריז ${count} מעל ${rendered} כרטיסים`,
            );
          }
          for (const { slug, count } of facets.providers) {
            if (!providers.includes(slug)) continue;
            const rendered = shown.filter((p) => providerSlug(p) === slug).length;
            assert.ok(
              count >= rendered,
              `${category} ${JSON.stringify(f)}: שבב חברה "${slug}" מכריז ${count} מעל ${rendered} כרטיסים`,
            );
          }
        }
      }
    }
  }
  assert.ok(states > 1000, `נסרקו ${states} מצבים`);
});

/*
 * והצד השני של אותו אינווריאנט, שסבב 65 לא מדד: שבב שאינו ברשימה
 * כלל מצהיר "אין כאן כלום מהסוג הזה", ולכן הלחיצה עליו חייבת להחזיר
 * אפס מהסוג שלו. זה הצד שההצמדה הפרה בכיוון ההפוך — `סיבים` נעלם
 * מהרשימה בתקרה ₪59 בזמן שהלחיצה עליו מצמידה את התקרה ל-₪99 ומציגה
 * חבילת סיבים אחת.
 */
test("שבב שנעלם מהרשימה אכן מחזיר אפס מהסוג שלו בלחיצה", () => {
  let checked = 0;
  for (const category of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, category);
    const types = facetOptions(pkgs, NO_FILTERS).types.map(([t]) => t);
    const b = priceBoundsOf(pkgs);
    if (!b) continue;
    for (let raw = b.min - 12; raw <= b.max; raw++) {
      const f = { providers: [], types: [], maxPrice: raw };
      const listed = new Set(facetOptions(pkgs, f).types.map(([t]) => t));
      for (const type of types) {
        if (listed.has(type)) continue;
        const after = shownFor(pkgs, { ...f, types: [type] });
        const visible = after.filter((p) =>
          matchesFilters(p, { providers: [], types: [type], maxPrice: null }),
        ).length;
        assert.equal(
          visible,
          0,
          `${category} maxPrice=${raw}: שבב "${type}" אינו ברשימה אך הלחיצה מציגה ${visible}`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked >= 0, "סחיפה רצה");
});
