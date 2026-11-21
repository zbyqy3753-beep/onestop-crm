import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

/*
 * ⚠️ אותו stub שבראש `tools/round44-browse.test.mjs` — ראה ההערה שם.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { basePackages, listable, providers, providerSlug, byCategory, CATEGORY_ORDER } =
  await import("../src/app/lp/catalog/catalog.ts");
const { providerFacets, typeFacets, priceBoundsOf, hasAnyFilterControl } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);

const NO_FILTERS = { providers: [], types: [], maxPrice: null };

function sectionsOf(slug) {
  const mine = listable(basePackages()).filter((p) => providerSlug(p) === slug);
  return CATEGORY_ORDER.map((c) => byCategory(mine, c)).filter((g) => g.length);
}

/*
 * ⚠️ סבב 46 — כרטיס הסינון נפרס ריק לגמרי.
 *
 * `div#lp-filters` מחזיק שלושה בלוקים וכל שלושתם מגודרים
 * (`providerOptions.length > 1`, `typeOptions.length > 1`,
 * `priceBounds && !isElectric`), אבל הכרטיס עצמו, כפתור "סינון" עם
 * `aria-expanded`/`aria-controls`, כותרת הדסקטופ וכפתור "נקה הכל"
 * לא היו מגודרים בכלום. ב-`/lp/provider/bezeq-energy` — עמוד סטטי
 * אמיתי, `generateStaticParams` נגזר מ-`providers(basePackages())` —
 * כל שלושת התנאים כבויים: ספק אחד, סוג אחד ("חשמל"), ו-`priceBoundsOf`
 * מחזיר null. התוצאה היא קבוצת פקדים שאין בתוכה פקד אחד, ובנייד
 * כפתור בר-מיקוד שמכריז `aria-expanded` ופותח כלום.
 *
 * זו אותה מחלקת פגם שההערה על ה-fieldset מצהירה שתוקנה ("תווית
 * שמבטיחה מסנן שאינו קיים"), רק שהשער הוחל על ה-fieldsets ולא על
 * המכולה שמעליהם.
 */
test("סבב 46: סקשן שאין בו אף פקד סינון אינו מצהיר על כרטיס סינון", () => {
  const electricity = sectionsOf("bezeq-energy");
  assert.equal(electricity.length, 1);
  const g = electricity[0];
  assert.equal(g[0].category, "electricity");
  assert.equal(providerFacets(g, NO_FILTERS).length, 1, "ספק אחד — fieldset החברה לא מרונדר");
  assert.equal(typeFacets(g, NO_FILTERS).length, 1, 'סוג אחד ("חשמל") — fieldset הסוג לא מרונדר');
  assert.equal(priceBoundsOf(g), null, "חשמל — מחוון המחיר לא מרונדר");
  assert.equal(
    hasAnyFilterControl(g, NO_FILTERS),
    false,
    "ולכן הכרטיס, הכפתור ו-'נקה הכל' אינם נפרסים",
  );
});

test("סבב 46: סקשן שיש בו פקד אמיתי כן מצהיר על כרטיס סינון", () => {
  /*
   * ⚠️ hot-energy היה העדות כאן עד סבב 62, כשני סוגים — אלא ששני
   * הסוגים האלה היו `["חשמל", 3]` ו-`["אחר", 1]`, כלומר בדיוק
   * הפיצול המדומה שסבב 62 הסיר: ארבע רשומות החשמל שלו הן כולן
   * לקוח פרטי. מאז `typeFacets` שלו באורך 1 והכרטיס יורד — אותו
   * כלל בדיוק שהבדיקה שמעל אוכפת על bezeq-energy. ראה הבדיקה
   * "אין בקטלוג סקשן נוסף" שמתחת.
   *
   * העדות לכיוון החיובי היא עכשיו הסקשן הסלולרי של cellcom, שבו
   * המחוון לבדו מצדיק את הכרטיס.
   */
  const cell = sectionsOf("cellcom").find((g) => g[0].category === "cellular");
  assert.ok(cell);
  assert.equal(hasAnyFilterControl(cell, NO_FILTERS), true);
});

test("סבב 46: אין בקטלוג סקשן נוסף שנפרס עם כרטיס סינון ריק", () => {
  const empty = [];
  for (const pr of providers(listable(basePackages()))) {
    for (const g of sectionsOf(pr.slug)) {
      if (!hasAnyFilterControl(g, NO_FILTERS)) empty.push(`${pr.slug}/${g[0].category}`);
    }
  }
  /*
   * ⚠️ hot-energy/electricity נוסף בסבב 62, ובכוונה: ארבע רשומות
   * החשמל שלו הן כולן לקוח פרטי, ולכן אחרי שציר הסוג עבר ל-
   * `spec.customerType` אין בסקשן הזה במה לסנן. השבבים שהיו שם,
   * "חשמל" ו-"אחר", חילקו קבוצה שאינה מחולקת.
   */
  assert.deepEqual(empty.sort(), ["bezeq-energy/electricity", "hot-energy/electricity"]);
});
