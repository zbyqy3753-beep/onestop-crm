import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/* ⚠️ אותו stub שבראש `tools/round40-calc-ui.test.mjs`. */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { basePackages, listable } = await import("../src/app/lp/catalog/catalog.ts");
const { computeSaving } = await import("../src/app/lp/catalog/savings.ts");
const { CatalogBrowser } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

const PACKAGES = basePackages();
const live = listable(PACKAGES);

/*
 * ⚠️ סבב 41, שתי הצהרות שהמסך מסר ושהנתון אינו תומך בהן:
 *   • לשונית החשמל נפתחה על "מומלצים תחילה" — תווית שאפס מ-18
 *     המסלולים מבססים. האפשרות יורדת שם, וברירת המחדל עוברת ל-
 *     `price-asc` כדי שה-`<select>` לא יחזיק `value` בלי `<option>`.
 *   • ההסתייגות הביתית על קו הטלפון הוצמדה לכל גולש לפי `track`
 *     לבדו, בזמן שהחבילה הנבחרת (id 157) היא טריפל שהקו **כלול** בה.
 */

test("סבב 41: לשונית החשמל אינה מציעה — ואינה נפתחת על — מיון שאין לו נתון", () => {
  const html = renderToStaticMarkup(
    React.createElement(CatalogBrowser, {
      packages: live.filter((p) => p.category === "electricity"),
      category: "electricity",
    }),
  );

  // האפשרות עצמה ירדה מהתפריט, כמו `after-asc` לפניה.
  assert.ok(!html.includes("מומלצים תחילה"), "האפשרות עדיין בתפריט החשמל");
  // ⚠️ ו-`<select>` אינו מחזיק `value` שאין לו `<option>`.
  assert.ok(!html.includes('value="recommended"'), "ברירת המחדל עדיין `recommended`");
  // ⚠️ סבב 44: הנוסח הזה היה "הנחה: בכל השעות תחילה". ראה
  // `tools/round44-browse.test.mjs` — התווית הבטיחה `allHours`,
  // והדירוג מקבץ לפי היעדר הצהרה על שעות. הכוונה כאן לא זזה:
  // ל-`<select>` יש `<option>` לערך שהוא מחזיק.
  assert.ok(html.includes("הנחה: ללא חלון שעות תחילה"), "התווית שהדירוג באמת מספק חסרה");
});

test("סבב 41: בסלולר האפשרות נשארת — שם היא כן אומרת משהו", () => {
  const html = renderToStaticMarkup(
    React.createElement(CatalogBrowser, {
      packages: live.filter((p) => p.category === "cellular"),
      category: "cellular",
    }),
  );
  assert.ok(html.includes("מומלצים תחילה"));
});

test("סבב 41: החבילה הביתית הנבחרת כוללת קו טלפון, ולכן ההסתייגות עליו אינה חלה", () => {
  /*
   * ⚠️ זה האינווריאנט שההסתייגות תלויה בו. ההסתייגות נשארת בקוד
   * ל-`hasPhone` שאינו `true` (ids כמו 3, שבו הוא `false`), ולכן אם
   * הבחירה הביתית תזוז ברענון הבא — הבדיקה הזו היא שתיפול, ולא המסך.
   */
  const picks = new Set();
  for (let spend = 10; spend <= 3000; spend += 10) {
    for (let units = 1; units <= 10; units++) {
      picks.add(String(computeSaving(PACKAGES, "home", units, spend).pick?.id));
    }
  }
  assert.deepEqual([...picks], ["157"]);

  const pick = live.find((p) => String(p.id) === "157");
  assert.equal(pick.spec.hasPhone, true);

  // והאחות בבריכה היא דווקא זו שההסתייגות כן נכונה עליה.
  assert.equal(live.find((p) => String(p.id) === "3").spec.hasPhone, false);
});
