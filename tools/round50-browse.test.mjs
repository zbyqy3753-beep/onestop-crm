import assert from "node:assert/strict";
import { test } from "node:test";
import Module from "node:module";

/*
 * ⚠️ אותו stub שבראש `tools/round49-browse.test.mjs` — השרשרת
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

const { sortsFor, catalogResults, sortCatalog, matchesFilters } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);
const { compareLabel } = await import("../src/app/lp/ui/CompareTray.tsx");
const { basePackages, listable, providerSlug, packageLabel, providerName } = await import(
  "../src/app/lp/catalog/catalog.ts"
);

/*
 * ⚠️ סבב 50 — שתי הבטחות שהנתון ברשימה שעל המסך אינו תומך בהן.
 *
 *   • תפריט המיון נגזר מ-`packages` ולא מהרשימה המסוננת, כלומר
 *     המסננים בעמודה הצדדית עקפו את `sortsFor` לגמרי.
 *   • השם הנגיש של תיבת ההשוואה נגזר מ-`packageLabel`, בזמן
 *     ש-`compareLabel` הוחלה על השבב, על ה-✕ ועל כותרת העמודה —
 *     ולא על הפקד שבו הבחירה נעשית.
 */

const ALL = listable(basePackages());
const CELL = ALL.filter((p) => p.category === "cellular");
const wecom = { providers: ["wecom"], types: [], maxPrice: null };

test("תפריט המיון נגזר מהרשימה שעל המסך ולא מהקטגוריה", () => {
  const res = catalogResults(CELL, wecom, "recommended");
  assert.deepEqual(res.map((p) => String(p.id)), ["117", "121", "116", "93", "19", "21"]);
  /* אף אחת מהשש אינה `recommended` ואף אחת אינה מצהירה על עלייה. */
  assert.deepEqual(sortsFor(res).map((s) => s.key), ["price-asc", "price-desc"]);
  /* ובקטגוריה כולה התפריט כן מציע את שתי התוויות האלה. */
  assert.deepEqual(sortsFor(CELL).map((s) => s.key), [
    "recommended",
    "price-asc",
    "price-desc",
    "after-asc",
  ]);
});

test("שלוש התוויות שהוסרו החזירו את אותה רשימה פריט-פריט", () => {
  const orders = ["recommended", "price-asc", "after-asc"].map((k) =>
    catalogResults(CELL, wecom, k).map((p) => String(p.id)).join(","),
  );
  assert.equal(new Set(orders).size, 1, "התוויות החזירו סדרים שונים");
});

test("הסדר שעל המסך אינו זז באף מסנן — רק התוויות מצטמצמות", () => {
  /*
   * ⚠️ המספרים שעל המסך נשמרים. בכל צירוף של שבב חברה או שבב סוג
   * בשלוש הקטגוריות, האפשרות שהתפריט מאבד נופלת לאפשרות שהוא כן
   * מציע — והקומפרטור שלה מחזיר את אותו סדר בדיוק.
   */
  let narrowed = 0;
  for (const cat of ["cellular", "home", "electricity"]) {
    const pk = ALL.filter((p) => p.category === cat);
    const combos = [
      { providers: [], types: [], maxPrice: null },
      ...[...new Set(pk.map(providerSlug).filter(Boolean))].map((s) => ({
        providers: [s],
        types: [],
        maxPrice: null,
      })),
      ...[...new Set(pk.map((p) => p.type).filter(Boolean))].map((t) => ({
        providers: [],
        types: [t],
        maxPrice: null,
      })),
    ];
    for (const f of combos) {
      const matched = pk.filter((p) => matchesFilters(p, f));
      const before = sortsFor(pk);
      const after = sortsFor(matched);
      if (after.length < before.length && matched.length) narrowed++;
      for (const key of before.map((s) => s.key)) {
        const eff = after.some((s) => s.key === key) ? key : (after[0]?.key ?? "price-asc");
        assert.equal(
          sortCatalog(matched, eff).map((p) => p.id).join(","),
          catalogResults(pk, f, key).map((p) => p.id).join(","),
          `הסדר זז ב-${cat} ${JSON.stringify(f)} (${key} → ${eff})`,
        );
      }
    }
  }
  assert.equal(narrowed, 9, "מספר התפריטים שהצטמצמו השתנה");
});

test("שתי תיבות השוואה אינן מכריזות את אותו שם נגיש", () => {
  /*
   * ארבעה זוגות בקטלוג מחזירים `packageLabel` זהה באותה קטגוריה.
   * ids 51/50 הם החמורים: אותו לוגו, אותה כותרת, אותו ₪60.
   */
  const groups = new Map();
  for (const p of ALL) {
    const key = `${p.category}|${packageLabel(p, providerName(p))}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1);
  assert.equal(dupes.length, 4, "מספר הזוגות בעלי שם זהה השתנה");
  for (const g of dupes) {
    const names = g.map((p) => compareLabel(p, g));
    assert.equal(new Set(names).size, g.length, `שם נגיש כפול: ${names.join(" / ")}`);
  }
});

test("בלי רשימת שכנות השם אינו זז — עמודי הפירוט מרנדרים כרטיס בודד", () => {
  for (const id of ["51", "50", "27", "157"]) {
    const p = ALL.find((x) => String(x.id) === id);
    assert.equal(compareLabel(p, [p]), packageLabel(p, providerName(p)));
  }
});
