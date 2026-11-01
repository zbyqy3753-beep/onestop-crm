import assert from "node:assert/strict";
import { test } from "node:test";
import Module from "node:module";

/*
 * ⚠️ אותו stub שבראש `tools/round48-browse.test.mjs` — השרשרת
 * `CatalogBrowser → PackageCard → LeadForm → ../actions` מגיעה למודול
 * `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { sortsFor, defaultSortFor, catalogResults } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);
const { basePackages, byCategory, listable, providers } = await import(
  "../src/app/lp/catalog/catalog.ts"
);

/*
 * ⚠️ סבב 49 — שני שערי התפריט היו `category === "electricity"` בזמן
 * שהנימוק שכתוב עליהם הוא נימוק **נתונים**: "אין נתון שהתווית
 * מבטיחה". התנאי מתקיים גם מחוץ לחשמל, והשער לא ראה אותו.
 */

const ALL = basePackages();
const L = listable(ALL);
const NO_FILTERS = { providers: [], types: [], maxPrice: null };
const slugOf = (p) => (typeof p.provider === "object" ? p.provider?.slug : null);
const section = (slug, category) =>
  byCategory(
    L.filter((p) => slugOf(p) === slug),
    category,
  );
const keys = (pkgs) => sortsFor(pkgs).map((s) => s.key);

/** ארבעת העמודים הסטטיים שאין בהם אף רשומה עם `recommended: true`. */
const NO_RECOMMENDED = [
  ["partner", "cellular", 6],
  ["partner", "home", 6],
  ["wecom", "cellular", 6],
  ["sting-tv", "home", 2],
];

test("סבב 49: עמוד ספק בלי אף המלצה אינו מציע — ואינו נפתח על — 'מומלצים תחילה'", () => {
  for (const [slug, category, n] of NO_RECOMMENDED) {
    const pkgs = section(slug, category);
    assert.equal(pkgs.length, n, `${slug}/${category}`);
    assert.equal(
      pkgs.some((p) => p.recommended === true),
      false,
      `${slug}/${category} — אפס המלצות`,
    );
    assert.ok(!keys(pkgs).includes("recommended"), `${slug}/${category}`);
    assert.equal(defaultSortFor(pkgs), "price-asc", `${slug}/${category}`);
  }
});

test("סבב 49: והסדר על המסך אינו זז — התווית היא מה שהשתנה", () => {
  /*
   * ⚠️ הקומפרטור של `recommended` נפל כולו ל-`byPrice` בארבעת
   * העמודים האלה, ולכן ברירת המחדל החדשה מחזירה פריט-פריט את אותו
   * סדר בדיוק. מה שהשתנה הוא מה שכתוב על המיון, לא מה שמוצג תחתיו.
   */
  for (const [slug, category] of NO_RECOMMENDED) {
    const pkgs = section(slug, category);
    assert.deepEqual(
      catalogResults(pkgs, NO_FILTERS, "price-asc").map((p) => p.id),
      catalogResults(pkgs, NO_FILTERS, "recommended").map((p) => p.id),
      `${slug}/${category}`,
    );
  }
});

test("סבב 49: `wecom` סלולר — אין הצהרת עלייה, ולכן גם הציר הזה יורד", () => {
  // כל שש הרשומות שם חסרות הצהרת עלייה, ולכן `after-asc` נפל
  // ל-`price` גם הוא: תפריט בן ארבע תוויות ששתיים מהן כפילות.
  const pkgs = section("wecom", "cellular");
  assert.deepEqual(keys(pkgs), ["price-asc", "price-desc"]);
});

test("סבב 49: לשוניות הסלולר והבית — שני הצירים נשארים, הנתון קיים", () => {
  for (const category of ["cellular", "home"]) {
    const pkgs = byCategory(L, category);
    assert.deepEqual(keys(pkgs), ["recommended", "price-asc", "price-desc", "after-asc"]);
    assert.equal(defaultSortFor(pkgs), "recommended");
  }
});

test("סבב 49: החשמל נשאר מגודר כשהיה — מהנתון, בלי לקרוא את שמו", () => {
  /*
   * ⚠️ השער עבר מהקטגוריה לנתון, ולכן החשמל חייב להישאר בדיוק כפי
   * שהיה: אפס `recommended` ואפס הצהרות עלייה ב-18 מסלוליו, ולכן
   * תפריט בן שתי אפשרויות שנפתח על `price-asc`.
   */
  for (const pkgs of [
    byCategory(L, "electricity"),
    section("cellcom", "electricity"),
    section("hot-energy", "electricity"),
    section("bezeq-energy", "electricity"),
  ]) {
    assert.deepEqual(keys(pkgs), ["price-asc", "price-desc"]);
    assert.equal(defaultSortFor(pkgs), "price-asc");
  }
});

test("סבב 49: בכל חתך — ברירת המחדל היא אפשרות שהתפריט באמת מציע", () => {
  /*
   * ⚠️ זה האינווריאנט שהשער הקודם הפר מחוץ לחשמל: `<select>` עם
   * `value` שאין לו `<option>` מציג את האפשרות הראשונה בזמן שה-state
   * הוא משהו אחר — תווית אחת ומיון אחר.
   */
  const sections = [];
  for (const c of ["cellular", "home", "electricity"]) sections.push([`tab/${c}`, byCategory(L, c)]);
  for (const prov of providers(ALL)) {
    for (const c of ["cellular", "home", "electricity"]) {
      const pkgs = section(prov.slug, c);
      if (pkgs.length) sections.push([`${prov.slug}/${c}`, pkgs]);
    }
  }
  assert.equal(sections.length, 18);
  for (const [name, pkgs] of sections) {
    const offered = keys(pkgs);
    assert.ok(offered.length >= 2, name);
    assert.ok(offered.includes(defaultSortFor(pkgs)), name);
    // וכל תווית שנשארת מבטיחה נתון שקיים ברשימה הזו.
    if (offered.includes("recommended")) {
      assert.ok(
        pkgs.some((p) => p.recommended === true),
        name,
      );
    }
  }
});
