import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

/*
 * ⚠️ אותו stub שבראש `tools/round46-browse.test.mjs` — ראה ההערה שם.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { basePackages, listable, byCategory, providerSlug } = await import(
  "../src/app/lp/catalog/catalog.ts"
);
const { CUSTOMER_TYPE_HE, cardStats } = await import("../src/app/lp/catalog/format.ts");
const { typeFacets, matchesFilters, hasAnyFilterControl, catalogResults } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);

const NO_FILTERS = { providers: [], types: [], maxPrice: null };
const ELEC = byCategory(listable(basePackages()), "electricity");
const byId = (id) => {
  const p = ELEC.find((x) => String(x.id) === String(id));
  assert.ok(p, `מסלול ${id} אינו בקטלוג`);
  return p;
};

/*
 * סבב 62, ציר הסוג בלשונית החשמל.
 *
 * בחשמל `p.type` אינו ציר אחד אלא שלושה מעורבים: שם הקטגוריה
 * ("חשמל", 12 רשומות), סוג לקוח ("עסקי" 3, "וועדי בתים" 2) ו-`null`
 * אחד. מזה יצאו שתי תקלות של תווית שמתארת קבוצה אחרת, ושתיהן נבדקות
 * כאן. התיקון קורא את הציר מ-`spec.customerType` — אותו מקור שהאריח
 * "מיועד ל" שעל הכרטיס כבר מדפיס.
 */

test("סבב 62: אין בחשמל שבב סוג שנקרא בשם הלשונית עצמה", () => {
  const chips = typeFacets(ELEC, NO_FILTERS).map(([t]) => t);
  assert.ok(
    !chips.includes("חשמל"),
    `שבב "חשמל" ליד שורה שמכריזה "${ELEC.length} מסלולים" נקרא כאל-פעולה, ובפועל הוריד 6 מסלולים`,
  );
  assert.deepEqual([...chips].sort(), ["ועד בית", "לקוח עסקי", "לקוח פרטי"]);
});

test("סבב 62: שבבי החשמל מחלקים את כל 18 המסלולים, בלי דלי שאריות", () => {
  const chips = typeFacets(ELEC, NO_FILTERS);
  assert.equal(
    chips.reduce((a, [, n]) => a + n, 0),
    ELEC.length,
  );
  assert.ok(
    !chips.some(([t]) => t === "אחר"),
    "כל 18 מצהירים על סוג לקוח תקף, ולכן אין למה שיישאר דלי שאריות",
  );
  // והחלוקה היא בדיוק זו שהנתון מצהיר עליה.
  assert.deepEqual(Object.fromEntries(chips), {
    "לקוח פרטי": 13,
    "לקוח עסקי": 3,
    "ועד בית": 2,
  });
});

/*
 * ⚠️ הליבה: ids 147 ו-150 הם אותו מסלול בכל מה שהכרטיס מדפיס — אותו
 * שם, אותם 20%, אותו חלון לילה, ושני הכרטיסים מצהירים "לקוח פרטי" —
 * ונפלו לשני שבבים שונים, כי `type` של 147 הוא `null`. מי שסימן
 * "חשמל" כדי לצמצם ללקוח פרטי איבד בשקט את התאום.
 */
test("סבב 62: שני מסלולים שהכרטיס שלהם מצהיר אותו דבר נופלים לאותו שבב", () => {
  const twins = [byId("147"), byId("150")];
  for (const p of twins) {
    assert.equal(p.name, "חוסכים בלילה 20%");
    assert.equal(p.spec.discountPercent, 20);
    assert.equal(p.spec.hoursText, "23:00 עד 7:00");
    // האריח שעל הכרטיס — אותו מקור שהמסנן קורא עכשיו.
    const tile = cardStats(p).find((s) => s.caption === "מיועד ל");
    assert.ok(tile, `למסלול ${p.id} אין אריח "מיועד ל"`);
    assert.equal(tile.value, "לקוח פרטי", `מסלול ${p.id}`);
  }
  // 147 נושאת `type: null` ו-150 נושאת `"חשמל"` — ההבדל שיצר את הפיצול.
  assert.equal(twins[0].type, null);
  assert.equal(twins[1].type, "חשמל");

  const kept = ELEC.filter((p) => matchesFilters(p, { ...NO_FILTERS, types: ["לקוח פרטי"] })).map(
    (p) => String(p.id),
  );
  assert.ok(kept.includes("147"), "התאום חייב להישאר עם אחיו");
  assert.ok(kept.includes("150"));
  assert.equal(kept.length, 13);
});

test("סבב 62: סימון כל שבבי החשמל אינו מסתיר אף מסלול", () => {
  const types = typeFacets(ELEC, NO_FILTERS).map(([t]) => t);
  assert.equal(catalogResults(ELEC, { ...NO_FILTERS, types }, "price-asc").length, ELEC.length);
});

/*
 * ⚠️ הציר החדש מגודר לחשמל בלבד: בסלולר ובבית `p.type` **כן** ציר
 * נקי, ולכן שם לא נגענו. הבדיקה הזו היא השער שלא ייסחף.
 */
test("סבב 62: בסלולר ובבית ציר הסוג נשאר `p.type`", () => {
  const expected = {
    cellular: { "5G": 26, "4G": 20, כשר: 8, בסיס: 1 },
    home: { סיבים: 16, טריפל: 11, TV: 3, נחושת: 2, "קו ביתי": 1 },
  };
  for (const cat of ["cellular", "home"]) {
    const pkgs = byCategory(listable(basePackages()), cat);
    assert.deepEqual(Object.fromEntries(typeFacets(pkgs, NO_FILTERS)), expected[cat], cat);
  }
});

/*
 * ⚠️ והתוצאה המכוונת: `/lp/provider/hot-energy` מאבד את כרטיס הסינון.
 * ארבע הרשומות שלו היו `["חשמל", 3]` ו-`["אחר", 1]` — בדיוק הפיצול
 * המדומה — וכולן לקוח פרטי. כשאין במה לסנן, אין פקד; זה אותו כלל
 * שסבב 46 אכף על bezeq-energy. ראה הבדיקות המעודכנות בסבבים 46 ו-55.
 */
test("סבב 62: hot-energy מאבד את כרטיס הסינון, כי אין בו במה לסנן", () => {
  const hot = ELEC.filter((p) => providerSlug(p) === "hot-energy");
  assert.equal(hot.length, 4);
  assert.deepEqual(
    [...new Set(hot.map((p) => p.spec.customerType))],
    ["private"],
    "כל ארבעתן לקוח פרטי",
  );
  assert.equal(typeFacets(hot, NO_FILTERS).length, 1, "ציר אחד — fieldset הסוג לא מרונדר");
  assert.equal(hasAnyFilterControl(hot, NO_FILTERS), false);
  // ולא דרך ערך שאינו בטבלה: `CUSTOMER_TYPE_HE` הוא המקור היחיד לתווית.
  assert.equal(typeFacets(hot, NO_FILTERS)[0][0], CUSTOMER_TYPE_HE.private);
});
