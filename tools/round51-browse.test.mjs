import assert from "node:assert/strict";
import { test } from "node:test";
import Module from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * ⚠️ אותו stub שבראש `tools/round50-browse.test.mjs` — השרשרת
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

const { sortsFor, sortCatalog, matchesFilters } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);
const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");
const { basePackages, listable } = await import("../src/app/lp/catalog/catalog.ts");
const { detailRows, promoRise } = await import("../src/app/lp/catalog/format.ts");

const PKGS = listable(basePackages());
const byId = (id) => PKGS.find((p) => p.id === id);
const html = (pkg) => renderToStaticMarkup(React.createElement(PackageCard, { pkg }));

/*
 * ⚠️ סבב 51, העיון — שתי הבטחות שהנתון שעל המסך אינו תומך בהן.
 */

/* ── 1. תווית המיון דורשת נתון שאפשר לדרג לפיו ───────────────────── */

test("`מחיר אחרי ההטבה` אינו מוצע על רשימה שאין בה אף מחיר בר-דירוג", () => {
  /*
   * סלולר + "גולן טלקום" + שבב "כשר" = ids 23 (`priceAfterPromoNote`
   * בלי מספר → `kind: "note"`) ו-24 (`kind: "period"`). שתיהן מצהירות
   * על עלייה, ולכן `promoRise` אישר את התווית — אבל `byAfterPrice`
   * אינה יודעת לדרג אף אחת מהן ונופלת כולה ל-`byPrice`, כלומר שתי
   * תוויות בתפריט החזירו את אותה רשימה פריט-פריט. בראש נשארה id 23
   * ב-₪25, שהכרטיס שלה מדפיס "לאחר מכן 59 ₪".
   */
  const subset = PKGS.filter(
    (p) => p.category !== "electricity" && matchesFilters(p, { providers: ["golan"], types: ["כשר"], maxPrice: null }),
  ).filter((p) => p.spec && "esim" in p.spec);
  const ids = subset.map((p) => p.id).sort();
  assert.deepEqual(ids, ["23", "24"], "הרשימה שעליה נמדד הפגם");
  assert.ok(subset.every((p) => promoRise(p) !== null), "שתיהן מצהירות על עלייה");

  const keys = sortsFor(subset).map((s) => s.key);
  assert.ok(!keys.includes("after-asc"), "התווית הוצעה בלי נתון לדרג");

  // והראיה שהיא הייתה כפילות: שני המיונים מחזירים את אותה רשימה.
  assert.deepEqual(
    sortCatalog(subset, "after-asc").map((p) => p.id),
    sortCatalog(subset, "price-asc").map((p) => p.id),
  );
});

test("והחשמל נשאר מחוץ לתפריט, כפי שהשער הקודם קבע", () => {
  // ⚠️ `afterPriceIsKnown` לבדה `true` על 18 מסלולי החשמל (אין להם
  // `priceAfterPromo` ואין `priceAfterPromoNote`), ולכן התנאי הראשון
  // — `promoRise` — חייב להישאר.
  const electricity = PKGS.filter((p) => p.category === "electricity");
  assert.ok(electricity.length >= 18);
  assert.ok(!sortsFor(electricity).map((s) => s.key).includes("after-asc"));
});

test("והלשונית המלאה ממשיכה להציע את התווית", () => {
  const cellular = PKGS.filter((p) => p.spec && "esim" in p.spec);
  assert.ok(sortsFor(cellular).map((s) => s.key).includes("after-asc"));
});

/* ── 2. שורת התנאים המחייבים אינה תלויה בשדה של הרשומה ───────────── */

test("כרטיס בלי פאנל מדפיס בכל זאת את התנאים המחייבים של הספק", () => {
  /*
   * id 100 (`ISP Trip All In Direct N Plus`, ₪129) היא היום הרשומה
   * היחידה שבה `detailRows` ריק **וגם** `description` ו-`benefits`
   * ריקים: הכרטיס שלה הציג לוגו, שם, מחיר וכפתור — בלי שום הסתייגות.
   * ההצהרה הזו היא היחידה בכרטיס שאינה תלויה באף שדה.
   */
  const bare = byId("100");
  assert.equal(detailRows(bare).length, 0);
  assert.equal(bare.description, null);
  assert.equal(bare.benefits, null);

  const markup = html(bare);
  assert.ok(!markup.includes("פרטים מלאים"), "אין פאנל, וזה נכון");
  assert.ok(markup.includes("התנאים המחייבים"), "ההסתייגות נעלמה עם הפאנל");
});

test("וכרטיס שיש לו פאנל אינו מקבל אותה פעמיים", () => {
  // ⚠️ `rows.length > 0 || description || benefits` — אותו שער, הפוך.
  // 103 הכרטיסים שכבר נושאים אותה בתוך הפאנל אינם זזים.
  const withPanel = byId("91");
  assert.ok(detailRows(withPanel).length > 0);
  const markup = html(withPanel);
  assert.ok(markup.includes("פרטים מלאים"));
  assert.equal(markup.split("התנאים המחייבים").length - 1, 0, "סגור — הפאנל אינו מרונדר");
});
