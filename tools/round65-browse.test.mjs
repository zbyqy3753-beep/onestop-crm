import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import { basePackages, byCategory, listable } from "../src/app/lp/catalog/catalog.ts";

/* ראה `tools/lpBrowse.test.mjs` למה `actions` מוחלף כאן. */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const {
  facetMaxPrice,
  facetOptions,
  hasAnyFilterControl,
  matchesFilters,
  priceBoundsOf,
  resolveMaxPrice,
  typeFacets,
} = await import("../src/app/lp/ui/CatalogBrowser.tsx");

const ALL = listable(basePackages());
const HOME = listable(byCategory(basePackages(), "home"));
const CELL = listable(byCategory(basePackages(), "cellular"));

/** התקרה המיושבת של הרשימה עצמה — מה ש-`filters` נושא ומה שהתוצאות נחתכות בו. */
function listMaxPrice(packages, f) {
  return resolveMaxPrice(
    priceBoundsOf(packages.filter((p) => matchesFilters(p, f, "maxPrice"))),
    f.maxPrice,
  );
}

/** התוצאות שעל המסך במצב `f` (שבו `maxPrice` הוא הגולמי). */
function resultsOf(packages, f) {
  const eff = listMaxPrice(packages, f);
  return packages.filter((p) => matchesFilters(p, { ...f, maxPrice: eff }));
}

/*
 * סבב 65, `CatalogBrowser.tsx`. המונה שעל שבב נספר בציר שלו **מנוטרל**
 * (ה-SmartCut), והתקרה שנמסרה לו נמדדה מול הרשימה שהציר הזה כן מסנן —
 * שני מספרים על אותו שבב משתי רשימות שונות. תקרה שהייתה "רדומה" במצב
 * הנוכחי חוזרת לחתוך במצב שהלחיצה מייצרת, והמונה הובטח בלעדיה.
 */

test("סבב 65: המונה על שבב נספר בתקרה שהלחיצה עליו מחזירה לחיים", () => {
  /*
   * המסלול, שלוש לחיצות מהמסך הנקי בלשונית `בית`: גרירה ל-₪59
   * (3 תוצאות) → שבב `קו ביתי` משאיר את id 83 לבדה ב-₪19.9, כלומר
   * `min === max`, המחוון כולו יורד מהמסך והתקרה נעשית רדומה.
   */
  const step2 = { providers: [], types: ["קו ביתי"], maxPrice: 59 };
  assert.equal(listMaxPrice(HOME, step2), null, "התקרה אינה רדומה בצעד שהבדיקה נבנתה עליו");
  assert.deepEqual(
    resultsOf(HOME, step2).map((p) => String(p.id)),
    ["83"],
    "הרשימה בצעד 2 זזה",
  );

  /*
   * ⚠️ כאן היה הפגם: בצעד 2 השבבים חזרו להכריז על הקטגוריה כולה
   * (`סיבים 16`), ולחיצה על `סיבים` החזירה את ₪59 לחיים (הקצה העליון
   * של בית הוא ₪209) והשאירה את id 83 לבדה — אפס מ-16 חבילות הסיבים
   * שהובטחו, והשבב שנלחץ נקרא מיד אחר כך `סיבים 0`.
   */
  const types = Object.fromEntries(facetOptions(HOME, step2).types);
  assert.equal(
    types["סיבים"],
    undefined,
    "שבב הסיבים עוד מבטיח חבילות שהתקרה שחוזרת לחיים חותכת את כולן",
  );
  assert.equal(types["TV"], 2, "המונה של TV אינו מה שהלחיצה מחזירה");
  assert.equal(types["קו ביתי"], 1, "השבב המסומן אינו נשאר עם המונה שלו");

  /* ושש-עשרה חבילות הסיבים אכן כולן מעל התקרה — זה מה שהמונה הבטיח. */
  const fiber = HOME.filter((p) => p.type === "סיבים");
  assert.equal(fiber.length, 16, "מספר חבילות הסיבים בקטלוג זז");
  assert.equal(
    fiber.filter((p) => p.price <= 59).length,
    0,
    "יש חבילת סיבים מתחת ל-₪59 — התרחיש אינו מה שהבדיקה מתארת",
  );
});

test("סבב 65: המונה שווה למה שרואים מאותו סוג אחרי הלחיצה, בכל מצב בר-הגעה", () => {
  /*
   * האינווריאנט שהתיקון מקבע, והוא בדיוק מה שהשבב מבטיח: `סיבים 16`
   * אומר "שש-עשרה חבילות סיבים", ולכן אחרי הלחיצה חייבות להיות על
   * המסך שש-עשרה חבילות סיבים.
   *
   * ⚠️ ולא "המונה שווה למה שהלחיצה **מוסיפה**" — האינווריאנט הזה אינו
   * נכון בתכנון הזה ואין לקבע אותו: ציר הסוג הוא OR, וההצמדה
   * `Math.max(maxPrice, bounds.min)` (ההכרעה המתועדת "הכוונה שנשמרה")
   * מורידה את התקרה כשהלחיצה מוסיפה סוג **זול** — ולכן הרשימה שאחרי
   * הלחיצה אינה מכילה בהכרח את זו שלפניה. נמדד: `בית` + `טריפל`
   * בתקרה ₪20, לחיצה על `קו ביתי` מורידה את ההצמדה מ-₪99 ל-₪20
   * ומסתירה טריפלים שהיו מוצגים. זה התנהגות מכוונת, לא הפגם.
   *
   * נמדד על שני המשטחים שבהם יש מחוון, על **כל** ערך תקרה שהפקד
   * מגיש (`min..max`) × הסוג המסומן: 3,970 מצבים בבית ו-1,640 בסלולר.
   * לפני התיקון: 1,479 ו-404 הפרות (בהן `5G 26` שמראה **אפס**
   * חבילות 5G, ו-`סיבים 16` שמראה אחת). אחרי: אפס ואפס.
   */
  for (const [label, packages] of [
    ["בית", HOME],
    ["סלולר", CELL],
  ]) {
    const bounds = priceBoundsOf(packages);
    assert.ok(bounds, `${label}: אין טווח מחירים`);
    const types = [...new Set(packages.map((p) => p.type).filter(Boolean))];
    let checked = 0;
    for (let raw = bounds.min; raw <= bounds.max; raw++) {
      for (const seed of [[], ...types.map((t) => [t])]) {
        const base = { providers: [], types: seed, maxPrice: raw };
        for (const [type, count] of facetOptions(packages, base).types) {
          if (seed.includes(type)) continue;
          const after = resultsOf(packages, { ...base, types: [...seed, type] });
          const visible = after.filter((p) => p.type === type).length;
          assert.equal(
            count,
            visible,
            `${label} raw=${raw} types=[${seed}] שבב "${type}": המונה ${count} מול ${visible} שמוצגות בפועל`,
          );
          checked++;
        }
      }
    }
    assert.ok(checked > 1000, `${label}: נבדקו ${checked} מצבים בלבד`);
  }
});

test("סבב 65: התקרה הרדומה עצמה לא זזה — הרשימה והתג כפי שהיו", () => {
  /*
   * ההכרעה המתועדת ("תקרה שאינה חותכת דבר שקולה לאין-תקרה", והתקרה
   * הגולמית נשמרת כך שהסרת השבב מחזירה אותה) אינה נוגעת בתיקון הזה.
   * `resolveMaxPrice` הוא אותו כלל, שעבר מ-`useMemo` לפונקציה.
   */
  assert.equal(resolveMaxPrice(null, 59), null, "בלי טווח אין תקרה");
  assert.equal(resolveMaxPrice({ min: 20, max: 209 }, null), null, "בלי תקרה גולמית אין תקרה");
  assert.equal(resolveMaxPrice({ min: 20, max: 59 }, 59), null, "תקרה בקצה אינה חותכת, ולכן null");
  assert.equal(resolveMaxPrice({ min: 99, max: 199 }, 59), 99, "תקרה מתחת לטווח מוצמדת למינימום");
  assert.equal(resolveMaxPrice({ min: 20, max: 209 }, 59), 59, "תקרה שחותכת נקראת כפי שהיא");

  /* ו-`facetMaxPrice` הוא `null` בדיוק כשאין תקרה גולמית. */
  assert.equal(facetMaxPrice(HOME, { providers: [], types: [], maxPrice: null }, "types"), null);
  assert.equal(facetMaxPrice(HOME, { providers: [], types: [], maxPrice: null }, "providers"), null);
});

test("סבב 65: כרטיס הסינון והמונים נשאלים באותה תקרה", () => {
  /*
   * `hasAnyFilterControl` קראה את שני הצירים עם התקרה של הרשימה,
   * כלומר יכלה להחליט על הכרטיס לפי רשימת שבבים אחרת מזו שמרונדרת.
   * היא קוראת עכשיו את אותה `facetOptions`.
   */
  const NO_FILTERS = { providers: [], types: [], maxPrice: null };
  assert.equal(hasAnyFilterControl(HOME, NO_FILTERS), true);
  assert.equal(hasAnyFilterControl(CELL, NO_FILTERS), true);

  /* וההחלטה עקבית עם אורך הרשימות שהכרטיס באמת מרנדר. */
  for (const raw of [null, 39, 59, 1000]) {
    for (const packages of [HOME, CELL]) {
      const f = { providers: [], types: [], maxPrice: raw };
      const facets = facetOptions(packages, f);
      const bounds = priceBoundsOf(packages);
      assert.equal(
        hasAnyFilterControl(packages, f),
        facets.providers.length > 1 || facets.types.length > 1 || bounds != null,
        `raw=${raw}: הכרטיס אינו מסכים עם השבבים שמתחתיו`,
      );
    }
  }
});

test("סבב 65: `typeFacets` עצמה לא נגעה — אותם מונים על אותה תקרה", () => {
  /*
   * שער על הכיוון: התיקון הוא **מי** מוסר את התקרה, לא מה נספר בה.
   * קריאה ישירה ל-`typeFacets` עם תקרה מפורשת מחזירה בדיוק מה שהחזירה.
   */
  assert.deepEqual(typeFacets(HOME, { providers: [], types: [], maxPrice: null }), [
    ["סיבים", 16],
    ["טריפל", 11],
    ["TV", 3],
    ["נחושת", 2],
    ["קו ביתי", 1],
  ]);
  /*
   * ⚠️ המספרים בתקרה ₪59 **זזו בסבב 67**, והכיוון הוא האינווריאנט
   * שהבדיקה שמעל מקבעת. `typeFacets` שואלת עכשיו כל ערך על התקרה
   * שהלחיצה עליו מייצרת (`valueMaxPrice`) ולא על תקרה אחת לציר, ולכן
   * שלושת הסוגים שנעלמו כאן חזרו עם 1: ₪59 נופל מתחת ל-`min` של
   * כל אחד מהם, ההצמדה `Math.max(maxPrice, bounds.min)` מעלה את
   * התקרה למדרגה הזולה שנותרה, ולחיצה על `סיבים` באמת מציגה חבילת
   * סיבים אחת (₪99). ההיעלמות הקודמת הייתה הצהרת "אין כאן כלום
   * מהסוג הזה" מול לחיצה שמציגה אחת — אותה הפרה שהבדיקה שמעל
   * מודדת, מהצד השני. ראה `tools/round67-browse.test.mjs`.
   *
   * ⚠️ והמצב שסבב 65 נבנה עליו **אינו** זז: שם `types` כבר מחזיק
   * `קו ביתי`, ה-`min` של המצב שאחרי הלחיצה הוא ₪19.9, ההצמדה אינה
   * נוגסת, ו-`סיבים` נשאר מחוץ לרשימה (הבדיקה הראשונה בקובץ).
   */
  assert.deepEqual(typeFacets(HOME, { providers: [], types: [], maxPrice: 59 }), [
    ["TV", 2],
    ["טריפל", 1],
    ["סיבים", 1],
    ["קו ביתי", 1],
    ["נחושת", 1],
  ]);
});

test("סבב 65: שום משטח לא נותר בלי אף תוצאה בגלל התיקון", () => {
  /* הרשימות עצמן אינן נגזרות מ-`facetOptions`, ולכן זה שער ולא מדידה. */
  for (const packages of [ALL, HOME, CELL]) {
    assert.ok(resultsOf(packages, { providers: [], types: [], maxPrice: null }).length > 0);
  }
});
