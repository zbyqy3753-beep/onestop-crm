import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import { basePackages, byPrice, isRecommended, listable, packageTitle, providerName } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ אותו stub שבראש `tools/lpBrowse.test.mjs` — שרשרת הייבוא
 * `CompareTray`/`CatalogBrowser → PackageCard → LeadForm → ../actions`
 * מגיעה למודול `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { compareLabel } = await import("../src/app/lp/ui/CompareTray.tsx");
const { sortCatalog } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

/*
 * ⚠️ סבב 41, שני משטחים שהצהירו יותר ממה שהרשומה מסרה:
 *   • המגש וטבלת ההשוואה זיהו עמודה לפי לוגו + כותרת בלבד, ושלושה
 *     זוגות בקטלוג מתנגשים בשניהם. ids 50/51 הם החמורים: אותו ספק,
 *     אותה כותרת, אותו מחיר (₪60) — ואז הטבלה הצהירה על "אותה חבילה"
 *     גם 4,000 SMS וגם `—`. הרשומה כן מסרה את ההבדל ב-`rawName`
 *     (`Valentine's *2*`), ו-`displayName` מנקה אותו לתצוגה.
 *   • "מומלצים תחילה" בלשונית החשמל: אפס מ-18 המסלולים נושאים
 *     `recommended`, ולכן הסדר שהאפשרות החזירה זהה פריט-פריט לסדר של
 *     האפשרות שמתחתיה — והדף נפתח עליה.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));

test("סבב 41: שתי רשומות שונות שנראות זהות מקבלות כותרות שמבדילות ביניהן", () => {
  const a = byId("50");
  const b = byId("51");

  // התצורה עצמה: אותו ספק, אותה כותרת, אותו מחיר.
  assert.equal(packageTitle(a), packageTitle(b));
  assert.equal(providerName(a), providerName(b));
  assert.equal(a.price, b.price);

  // והרשומה כן מסרה את ההבדל.
  assert.equal(b.rawName, "Valentine's *2*");

  const pair = [a, b];
  assert.notEqual(compareLabel(a, pair), compareLabel(b, pair));
  assert.equal(compareLabel(b, pair), "Valentine's · גרסה 2");
});

test("סבב 41: בלי התנגשות בפועל הכותרת נשארת נקייה", () => {
  // ⚠️ "גרסה 2" על עמודה בודדת היא רעש שאינו אומר לגולש דבר.
  const b = byId("51");
  assert.equal(compareLabel(b, [b]), "Valentine's");
  assert.equal(compareLabel(b, [b, byId("157")]), "Valentine's");
});

test("סבב 41: זוג שאין בו `*2*` נופל למחיר, שהוא ההבדל היחיד שהרשומה מסרה", () => {
  // ids 23/24 נושאים אותו `name` גולמי בדיוק — פגם נתונים שאינו
  // בר-תיקון כאן — ולכן המבדיל הוא המחיר.
  const a = byId("23");
  const b = byId("24");
  assert.equal(a.rawName, undefined);
  const pair = [a, b];
  assert.equal(compareLabel(a, pair), "כשר · ₪25");
  assert.equal(compareLabel(b, pair), "כשר · ₪27.9");
});

test("סבב 41: בחשמל `recommended` אינה מוסיפה דבר על `price-asc`", () => {
  const electric = live.filter((p) => p.category === "electricity");

  // זה הנימוק להסרת האפשרות: אין במה למיין.
  assert.equal(electric.length, 18);
  assert.equal(electric.filter(isRecommended).length, 0);

  const recommended = sortCatalog(electric, "recommended").map((p) => String(p.id));
  const priceAsc = sortCatalog(electric, "price-asc").map((p) => String(p.id));
  assert.deepEqual(recommended, priceAsc);

  // ⚠️ והסדר עצמו אינו זז — זה מה שהופך את התיקון לתווית בלבד.
  assert.deepEqual(priceAsc, [...electric].sort(byPrice).map((p) => String(p.id)));
});

test("סבב 41: בסלולר ובבית `recommended` כן אומרת משהו, ולכן נשארת", () => {
  for (const category of ["cellular", "home"]) {
    const group = live.filter((p) => p.category === category);
    assert.ok(group.filter(isRecommended).length > 0, category);
    assert.notDeepEqual(
      sortCatalog(group, "recommended").map((p) => String(p.id)),
      sortCatalog(group, "price-asc").map((p) => String(p.id)),
    );
  }
});

test("סבב 41: שם פגום נופל לשם הספק, ולא למחרוזת ריקה", () => {
  /*
   * ⚠️ זה החוזה ש-`packageLabel` החזיקה במקום הזה לפני `compareLabel`:
   * רשומה שה-`name` שלה אינו מחרוזת מחזירה `""` מ-`packageTitle`,
   * ושם נגיש ריק הוא פקד שמכריז פעולה בלי לומר על מה.
   */
  const broken = { ...byId("51"), name: {}, rawName: undefined };
  const label = compareLabel(broken, [broken]);
  assert.equal(label, providerName(broken));
  assert.notEqual(label, "");
});
