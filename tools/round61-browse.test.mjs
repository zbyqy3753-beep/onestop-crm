import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

/*
 * ⚠️ אותו stub שבראש `tools/round55-browse.test.mjs` — השרשרת
 * `PackageCard → LeadForm → ../actions` מגיעה למודול `"use server"`
 * ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");
const { basePackages } = await import("../src/app/lp/catalog/catalog.ts");
const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");
const { CompareTray, CompareSheet } = await import("../src/app/lp/ui/CompareTray.tsx");

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const noop = () => {};

/*
 * סבב 61, משטחי ההשוואה. בחשמל אלה **מסלולים** — אותה הכרעה ששורת
 * התוצאות ב-`CatalogBrowser`, לשוניות הקטלוג ורצועת השירותים
 * ב-`page.tsx` כבר עושות לפי `PLANS_CAPTION`/`PACKAGES_CAPTION`.
 * ארבעה משטחי השוואה נשארו מאחור וקראו לאותן 18 הרשומות "חבילות",
 * באותו מסך שמדפיס מעליהן "18 מסלולים".
 */

const cardHtml = (id, props = {}) =>
  renderToStaticMarkup(
    React.createElement(PackageCard, {
      pkg: byId(id),
      compareFull: true,
      compareChecked: false,
      onCompareToggle: noop,
      ...props,
    }),
  );

test("סבב 61: תיבת ההשוואה שבכרטיס חשמל אומרת 'מסלולים'", () => {
  // id 143 — `תעריף כללי 8% הנחה`, cellcom, קטגוריית חשמל.
  const electric = cardHtml("143");
  assert.equal(byId("143").category, "electricity");
  assert.match(electric, /ניתן להשוות עד 4 מסלולים/);
  assert.equal(/ניתן להשוות עד 4 חבילות/.test(electric), false);

  // ושני המשטחים בכרטיס — ה-`title` וה-`aria-label` — לא רק אחד מהם.
  assert.equal((electric.match(/ניתן להשוות עד 4 מסלולים/g) ?? []).length, 2);
});

test("ובסלולר ובבית זה נשאר 'חבילות', בלי תזוזה", () => {
  for (const id of ["121", "157"]) {
    const html = cardHtml(id);
    assert.match(html, /ניתן להשוות עד 4 חבילות/);
    assert.equal(/ניתן להשוות עד 4 מסלולים/.test(html), false);
  }
});

test("סבב 61: המגש והגיליון נוקבים באותו שם כמו המסך שמעליהם", () => {
  const trayHtml = (ids) =>
    renderToStaticMarkup(
      React.createElement(CompareTray, {
        items: ids.map(byId),
        onRemove: noop,
        onClear: noop,
        max: 4,
      }),
    );

  // מסלול חשמל בודד במגש — הכיתוב שהוא עצמו ההסבר.
  assert.match(trayHtml(["143"]), /בחרו עוד מסלול/);
  assert.match(trayHtml(["121"]), /בחרו עוד חבילה/);

  // ⚠️ `items` הוא המקור היחיד לקטגוריה כאן, ולכן תערובת נשארת "חבילה".
  assert.match(trayHtml(["143", "121"]).replace(/<[^>]*>/g, " "), /השוו/);

  const sheetHtml = (ids) =>
    renderToStaticMarkup(
      React.createElement(CompareSheet, { items: ids.map(byId), onClose: noop }),
    );
  // ids 150 + 147 — שני מסלולי חשמל (אותה כותרת `חוסכים בלילה 20%`).
  const electric = sheetHtml(["150", "147"]);
  assert.equal(byId("150").category, "electricity");
  assert.equal(byId("147").category, "electricity");
  assert.match(electric, /השוואת מסלולים/);
  assert.equal(/השוואת חבילות/.test(electric), false);
  // ושני המשטחים: ה-`h2` וה-`aria-label` של ה-`dialog`.
  assert.equal((electric.match(/השוואת מסלולים/g) ?? []).length, 2);

  const cell = sheetHtml(["121", "117"]);
  assert.match(cell, /השוואת חבילות/);
  assert.equal(/השוואת מסלולים/.test(cell), false);
});
