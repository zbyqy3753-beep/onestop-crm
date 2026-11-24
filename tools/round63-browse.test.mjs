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

const { basePackages, listable, byCategory } = await import("../src/app/lp/catalog/catalog.ts");
const { CUSTOMER_TYPE_HE, specOf } = await import("../src/app/lp/catalog/format.ts");
const { priceBoundsOf, matchesFilters, typeFacets } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);

const ALL = listable(basePackages());
const ELEC = byCategory(ALL, "electricity");
const CELL = byCategory(ALL, "cellular");
const HOME = byCategory(ALL, "home");
const NO_FILTERS = { providers: [], types: [], maxPrice: null };

/*
 * סבב 63, ממצא 1 — השבב בכרטיס החשמל.
 *
 * הכרטיס הדפיס `pkg.type`, שבחשמל אינו ציר: 12 מתוך 18 הרשומות
 * החזיקו בו את שם הקטגוריה ("חשמל"), חמש את סוג הלקוח באיות שלישי
 * ("עסקי", "וועדי בתים") ואחת כלום. הבדיקה מקבעת שהציר שהכרטיס
 * מדפיס הוא הציר שהמסנן מחזיר — `CUSTOMER_TYPE_HE[customerType]`.
 */
const cardChip = (pkg) => {
  if (pkg.category !== "electricity") return null;
  const t = specOf(pkg).customerType;
  return typeof t === "string" && Object.hasOwn(CUSTOMER_TYPE_HE, t) ? CUSTOMER_TYPE_HE[t] : null;
};

test("חשמל: שבב הכרטיס אינו שם הקטגוריה", () => {
  assert.equal(ELEC.length, 18);
  const tabName = ELEC.filter((p) => cardChip(p) === "חשמל");
  assert.deepEqual(tabName, [], "שבב בכרטיס קורא את שם הלשונית");
  /* לפני התיקון: 12 רשומות החזיקו בדיוק את זה ב-`type`. */
  const rawTabName = ELEC.filter((p) => p.type === "חשמל").map((p) => String(p.id));
  assert.equal(rawTabName.length, 12, "הנתון עצמו לא השתנה — רק מי נקרא");
});

test("חשמל: השבב בכרטיס והשבב במסנן אומרים אותה מילה", () => {
  const facetLabels = new Set(typeFacets(ELEC, NO_FILTERS).map(([t]) => t));
  for (const p of ELEC) {
    const chip = cardChip(p);
    assert.ok(chip, `מסלול ${p.id} בלי שבב`);
    assert.ok(
      facetLabels.has(chip),
      `מסלול ${p.id}: הכרטיס אומר "${chip}" ואין שבב מסנן כזה`,
    );
  }
  /* שלושת האיותים שנעלמו: "עסקי" מול "לקוח עסקי", "וועדי בתים" מול "ועד בית". */
  for (const [id, want] of [
    ["143", "לקוח עסקי"],
    ["141", "לקוח עסקי"],
    ["140", "לקוח עסקי"],
    ["145", "ועד בית"],
    ["142", "ועד בית"],
  ]) {
    const p = ELEC.find((x) => String(x.id) === id);
    assert.ok(p, `מסלול ${id} אינו בקטלוג`);
    assert.equal(cardChip(p), want);
  }
});

test("חשמל: תאומי הנתונים 150 ו-147 מתוייגים זהה", () => {
  const a = ELEC.find((p) => String(p.id) === "150");
  const b = ELEC.find((p) => String(p.id) === "147");
  assert.ok(a && b);
  /* `type` שלהם נפרד (`"חשמל"` מול `null`), `customerType` זהה. */
  assert.notEqual(a.type, b.type);
  assert.equal(cardChip(a), cardChip(b));
});

/*
 * סבב 63, ממצא 2 — קצוות המחוון נמדדים אחרי שאר המסננים.
 *
 * `priceBoundsOf(packages)` קרא את הרשימה הלא מסוננת, ולכן שלוש
 * התצוגות של המחוון המשיכו לצטט את הקטגוריה כולה אחרי שבב חברה או
 * סוג — בניגוד לחוזה שהן מצהירות עליו.
 */
const boundsUnder = (packages, filters) =>
  priceBoundsOf(packages.filter((p) => matchesFilters(p, filters, "maxPrice")));

test("המחוון: שבב סוג מצמצם את קצוות המחוון", () => {
  const whole = priceBoundsOf(CELL);
  const kosher = boundsUnder(CELL, { ...NO_FILTERS, types: ["כשר"] });
  assert.ok(kosher);
  assert.ok(kosher.highest < whole.highest, "הקצה העליון לא זז");
  assert.equal(kosher.highest, 39);
  assert.equal(kosher.lowest, 25);
});

test("המחוון: כל תווית קצה היא מחיר שחבילה גלויה באמת נושאת", () => {
  for (const [packages, label] of [
    [CELL, "cellular"],
    [HOME, "home"],
  ]) {
    const types = typeFacets(packages, NO_FILTERS).map(([t]) => t);
    for (const type of types) {
      const filters = { ...NO_FILTERS, types: [type] };
      const visible = packages.filter((p) => matchesFilters(p, filters, "maxPrice"));
      const bounds = priceBoundsOf(visible);
      if (!bounds) continue;
      const prices = visible.map((p) => p.price).filter((v) => Number.isFinite(v));
      assert.ok(
        prices.includes(bounds.lowest),
        `${label}/${type}: תווית ${bounds.lowest} אינה מחיר של חבילה גלויה`,
      );
      assert.ok(
        prices.includes(bounds.highest),
        `${label}/${type}: תווית ${bounds.highest} אינה מחיר של חבילה גלויה`,
      );
    }
  }
});

test("המחוון: טווח שהתכנס למחיר אחד אינו מצייר פקד", () => {
  const only83 = boundsUnder(HOME, { ...NO_FILTERS, types: ["קו ביתי"] });
  assert.ok(only83);
  /* id 83 לבדו ב-₪19.9 — `max === min`, ולכן ה-fieldset נכבה. */
  assert.equal(only83.min, only83.max);
  assert.equal(only83.lowest, only83.highest);
  /* ובלי השבב יש טווח אמיתי, והפקד כן מצויר. */
  const open = priceBoundsOf(HOME);
  assert.ok(open.max > open.min);
});

/*
 * תקרה שנפלה מחוץ לטווח החדש נקראת כ"בלי תקרה" — אחרת הכותרת
 * מדפיסה מספר שהידית אינה יכולה לעמוד בו.
 */
const capUnder = (bounds, maxPrice) =>
  bounds != null && maxPrice != null && maxPrice < bounds.max ? maxPrice : null;

test("המחוון: תקרה מעל הקצה החדש אינה מודפסת", () => {
  const kosher = boundsUnder(CELL, { ...NO_FILTERS, types: ["כשר"] });
  assert.equal(capUnder(kosher, 40), null, "₪40 מעל קצה ₪39 — אין תקרה");
  assert.equal(capUnder(kosher, 30), 30, "תקרה שבתוך הטווח נשמרת");
});
