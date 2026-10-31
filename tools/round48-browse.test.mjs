import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Module from "node:module";

/*
 * ⚠️ אותו stub שבראש `tools/round42-lead.test.mjs` — השרשרת
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

const { priceBoundsOf } = await import("../src/app/lp/ui/CatalogBrowser.tsx");
const { basePackages, byCategory, listable, providers } = await import(
  "../src/app/lp/catalog/catalog.ts"
);

/*
 * ⚠️ סבב 48 — הכותרת של מחוון המחיר (ו-`aria-valuetext`, הדבר היחיד
 * שקורא מסך מכריז) ציטטו את הקצה ה**מעוגל**, בזמן ששתי התוויות
 * מתחת למחוון קיבלו בסבב 45/46 את הכלל "התווית חייבת מחיר שחבילה
 * אחת באמת נושאת". ב-`/lp/provider/cellcom` הכותרת אמרה "מחיר עד
 * ₪120" מול ₪119.9 בתווית שמתחתיה — שני מספרים לאותו מצב מחוון,
 * באותו מסך, ואין לסלקום חבילה סלולרית ב-₪120.
 */

const ALL = listable(basePackages());

/** כל חתך שמרנדר מחוון: שתי הלשוניות ועמוד ספק לכל שילוב. */
function sections() {
  const out = [];
  for (const cat of ["cellular", "home"]) {
    out.push([`tab/${cat}`, byCategory(ALL, cat)]);
    for (const pr of providers(ALL)) {
      const sub = byCategory(
        ALL.filter((p) => p.provider?.slug === pr.slug),
        cat,
      );
      if (sub.length) out.push([`${pr.slug}/${cat}`, sub]);
    }
  }
  return out;
}

test("סבב 48: קצה המחוון שמודפס הוא מחיר שחבילה אחת באמת נושאת", () => {
  let checked = 0;
  for (const [label, rows] of sections()) {
    const b = priceBoundsOf(rows);
    if (!b) continue;
    checked++;
    // `highest` הוא הקצה המדויק; `max` הוא הקצה המעוגל של הפקד.
    assert.ok(
      rows.some((p) => [p.price, p.priceAfterPromo].includes(b.highest)),
      `${label}: ${b.highest} אינו מחיר של אף חבילה`,
    );
  }
  assert.ok(checked >= 8, `נבדקו ${checked} חתכים`);
});

test("סבב 48: יש חתכים שבהם הקצה המעוגל אינו מחיר קיים — ולכן ההבדל נמדד", () => {
  const mismatched = sections().filter(([, rows]) => {
    const b = priceBoundsOf(rows);
    return b && b.max !== b.highest;
  });
  // אם הקטלוג ישתנה כך שכל הקצוות שלמים, הבדיקה מעל עדיין מגנה.
  assert.ok(mismatched.length > 0, "לא נמצא חתך עם קצה לא-שלם");
});

test("סבב 48: הכותרת ו-`aria-valuetext` קוראות את הקצה המדויק", () => {
  const src = readFileSync(
    new URL("../src/app/lp/ui/CatalogBrowser.tsx", import.meta.url),
    "utf8",
  );
  // שתי התצוגות שמדפיסות סכום לגולש — הקצה המדויק.
  assert.match(src, /\{shekels\(maxPrice \?\? priceBounds\.highest\)\}/);
  assert.match(src, /aria-valuetext=\{shekels\(maxPrice \?\? priceBounds\.highest\)\}/);
  // והפקד עצמו נשאר על הקצה המעוגל — ראה `priceBoundsOf`.
  assert.match(src, /max=\{priceBounds\.max\}/);
  assert.match(src, /value=\{maxPrice \?\? priceBounds\.max\}/);
  assert.ok(!/\{shekels\(maxPrice \?\? priceBounds\.max\)\}/.test(src));
});
