import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import { basePackages, hasKnownAfterPrice, listable } from "../src/app/lp/catalog/catalog.ts";
import { priceNote, promoRise, usableLineTiers } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ אותו stub בדיוק שבראש `tools/lpBrowse.test.mjs` — שרשרת הייבוא
 * `CatalogBrowser → PackageCard → LeadForm → ../actions` מגיעה למודול
 * `"use server"` ש-tsx אינו יכול לקמפל, ו-`sortCatalog` אינה נוגעת בו.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { sortCatalog } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

/*
 * ⚠️ סבב 40, צד התצוגה — שתי אמירות שסותרות את מה שעל אותו כרטיס:
 *   • המיון "מחיר אחרי ההטבה" דירג לפי מחיר ההטבה 20 רשומות שמצהירות
 *     על תקופת מבצע בטקסט חופשי — בזמן שהכרטיס שלהן מדפיס, מתחת
 *     לאותו פקד מיון, "בדקו מה המחיר אחריה".
 *   • הסתייגות "מחיר למנוי במסלול משפחתי — משני מנויים ומעלה" הודפסה
 *     על רשומה שמסרה מדרגות כמות שמכסות גם קו בודד, לצד שורה שאומרת
 *     את ההפוך.
 */

const PACKAGES = basePackages();
const live = listable(PACKAGES);
const cellular = live.filter((p) => p.category === "cellular");

const byId = (id) => PACKAGES.find((p) => p.id === id);

test("`period` — תקופת מבצע בטקסט חופשי — יורד לסוף מיון `אחרי ההטבה`", () => {
  const period = cellular.filter((p) => promoRise(p)?.kind === "period");
  assert.ok(period.length > 0, "הענף חייב להיות חי בקטלוג, אחרת הבדיקה ריקה");
  // ⚠️ זו הסיבה שהפגם היה שקט: `hasKnownAfterPrice` אומרת עליהן `true`.
  assert.ok(period.every(hasKnownAfterPrice));

  const sorted = sortCatalog(cellular, "after-asc");
  const known = sorted.findIndex((p) => promoRise(p)?.kind === "period");
  const unknownAfter = sorted
    .slice(known)
    .every((p) => !hasKnownAfterPrice(p) || promoRise(p)?.kind === "period");
  assert.ok(
    unknownAfter,
    "מהרשומה הראשונה שלא ידוע מה תעלה אחרי ההטבה והלאה — אין יותר רשומה שכן ידוע עליה",
  );

  // שלושת המופעים שהדוח מנה, כל אחד מהם אחרי כל מי שמחירו-אחרי ידוע.
  for (const id of ["57", "17", "27"]) {
    const at = sorted.findIndex((p) => p.id === id);
    assert.ok(at >= known, `id ${id} חייב לשבת בקבוצה שלא ידוע מה תעלה אחריה`);
  }
});

test("הסתייגות המסלול המשפחתי אינה סותרת את שורת המדרגות על אותו כרטיס", () => {
  const family = byId("36");
  assert.ok(usableLineTiers(family).length > 0, "id 36 מוסרת מדרגות כמות");
  assert.equal(
    priceNote(family),
    null,
    "הרשומה מסרה מדרגות שמכסות גם קו בודד — ההסתייגות השטוחה מכחישה אותן",
  );
  // ⚠️ id 37 נושאת מבנה זהה ומעולם לא סויגה — זו הראיה שזו השמטה.
  assert.equal(priceNote(byId("37")), null);
  // ⚠️ ו-id 117, שבשבילה השער נכתב, נשארת מסויגת: שם אין מדרגות.
  const wecom = byId("117");
  assert.equal(usableLineTiers(wecom).length, 0);
  assert.deepEqual(priceNote(wecom), {
    label: "תנאי המחיר",
    value: "מחיר למנוי במסלול משפחתי — משני מנויים ומעלה",
  });
});

test("`usableLineTiers` פוסלת מדרגה פגומה בדיוק כמו שורת הפירוט", () => {
  const bad = {
    ...byId("36"),
    spec: {
      ...byId("36").spec,
      lineTiers: [
        { lines: 0, price: 39.9 },
        { lines: 2.5, price: 39.9 },
        { lines: 2, price: null },
        null,
        { lines: 3, price: 34.9 },
      ],
    },
  };
  assert.deepEqual(usableLineTiers(bad), [{ lines: 3, price: 34.9 }]);
  assert.deepEqual(usableLineTiers({ ...byId("36"), spec: { lineTiers: "3 קווים ב99" } }), []);
});
