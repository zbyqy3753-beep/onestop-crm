import assert from "node:assert/strict";
import { test } from "node:test";
import Module from "node:module";

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

const { sortsFor, sortCatalog, defaultSortFor } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);
const { compareLabel } = await import("../src/app/lp/ui/CompareTray.tsx");
const { basePackages, listable, providerSlug, byCategory } = await import(
  "../src/app/lp/catalog/catalog.ts"
);
const { promoRise, priceNote, usableLineTiers, headlineValue } = await import(
  "../src/app/lp/catalog/format.ts"
);

/*
 * ⚠️ סבב 52 — שלוש הבטחות שהנתון אינו תומך בהן, כולן על משטחי התצוגה
 * בלבד (בריכת ההשוואה והמנוע לא זזו; נמדד לפני ואחרי).
 *
 *   • התווית "מחיר אחרי ההטבה: מהזול ליקר" הוצעה על רשימות שאין בהן
 *     אף מחיר-אחרי-הטבה שמיש, והסדר שיצא ממנה היה מחיר **היום**.
 *   • `priceNote` הדפיס "המחיר מותנה בכמות המנויים" על מספר שהמדרגות
 *     שלידו, על אותו כרטיס, דווקא **מורידות**.
 *   • `compareLabel` הכריז מחיר כמבדיל בין תאומות שחולקות אותו מחיר.
 */

const ALL = listable(basePackages());
const RAW = basePackages();
const byId = (n) => RAW.find((p) => String(p.id) === String(n));
const ids = (l) => l.map((p) => String(p.id)).join(",");
const rankable = (l) => l.filter((p) => promoRise(p)?.kind === "amount").length;
const offersAfter = (l) => sortsFor(l).some((s) => s.key === "after-asc");

/** כל רשימה שהדף מגיש בפועל: קטגוריה, חברה, סוג, וחברה×סוג. */
function reachableLists() {
  const out = [];
  const slugs = [...new Set(ALL.map(providerSlug).filter(Boolean))];
  for (const cat of ["cellular", "home", "electricity"]) {
    const all = byCategory(ALL, cat);
    const types = (l) => [...new Set(l.map((p) => p.type).filter(Boolean))];
    out.push([`${cat}`, all]);
    for (const t of types(all)) out.push([`${cat} type=${t}`, all.filter((p) => p.type === t)]);
    for (const s of slugs) {
      const ps = all.filter((p) => providerSlug(p) === s);
      if (!ps.length) continue;
      out.push([`${cat} prov=${s}`, ps]);
      for (const t of types(ps)) {
        out.push([`${cat} prov=${s} type=${t}`, ps.filter((p) => p.type === t)]);
      }
    }
  }
  return out.filter(([, l]) => l.length >= 2);
}

test("round52: התווית 'מחיר אחרי ההטבה' אינה מוצעת על אף רשימה שאין בה מחיר שמיש", () => {
  const bad = reachableLists()
    .filter(([, l]) => offersAfter(l) && rankable(l) === 0)
    .map(([name]) => name);
  assert.deepEqual(bad, [], "התווית מבטיחה סדר שהדירוג אינו מספק");
});

test("round52: עשר רשימות אמיתיות איבדו את התווית, ואחת מהן היא עמוד ספק בברירת מחדל", () => {
  /*
   * ⚠️ המספר מקובע כדי שהרחבה עתידית של השער לא תחזיר אותן בשקט.
   * השער הקודם היה `some(promoRise !== null) && some(afterPriceIsKnown)`
   * — שני `some` נפרדים על שתי רשומות **שונות**.
   */
  const was = (l) =>
    l.some((p) => promoRise(p) !== null) &&
    l.some((p) => promoRise(p)?.kind !== "period" && !(p.priceAfterPromoNote && p.priceAfterPromo == null));
  const lost = reachableLists().filter(([, l]) => was(l) && !offersAfter(l));
  assert.equal(lost.length, 10, "מספר הרשימות שאיבדו את התווית השתנה");
  for (const [, l] of lost) assert.equal(rankable(l), 0, "רשימה שאיבדה את התווית כן יכלה לדרג");

  /* עמוד הספק של סלקום, מקטע הבית — מצב ברירת המחדל, בלי שבב אחד. */
  const cellcomHome = byCategory(ALL, "home").filter((p) => providerSlug(p) === "cellcom");
  assert.equal(cellcomHome.length, 8);
  assert.equal(offersAfter(cellcomHome), false);
  /*
   * זה הסדר שהתווית החזירה: id 157 ב-₪149 בראש ו-id 132 ב-₪59
   * רביעי, כשחמש מהשמונה מצהירות על העלייה בפרוזה ונדחפו מתחת
   * לשלוש שלא מסרו דבר. אין בו שום מידע על המחיר שאחרי.
   */
  assert.equal(ids(sortCatalog(cellcomHome, "after-asc")), "157,102,107,132,81,92,108,109");
  /* וברירת המחדל ממילא לא הייתה `after-asc`, ולכן הטעינה הראשונה לא זזה. */
  assert.notEqual(defaultSortFor(cellcomHome), "after-asc");
});

test("round52: החשמל נשאר מחוץ לתפריט, והרשימות עם מחיר שמיש שומרות אותו", () => {
  for (const [name, l] of reachableLists()) {
    if (name.startsWith("electricity")) {
      assert.equal(offersAfter(l), false, `החשמל קיבל את התווית ב-${name}`);
    } else if (rankable(l) > 0) {
      assert.equal(offersAfter(l), true, `רשימה עם מחיר שמיש איבדה את התווית ב-${name}`);
    }
  }
});

test("round52: id 57 — ההסתייגות אינה נאמרת על מספר שהמדרגות שלידו מורידות", () => {
  const p = byId("57");
  assert.equal(p.price, 39.9);
  /* הרשומה מנסחת "למצרפים", ולכן השער הטקסטואלי לא ראה אותה. */
  assert.match(String(p.description), /למצרפים/);
  assert.deepEqual(usableLineTiers(p), [
    { lines: 3, price: 33 },
    { lines: 4, price: 30 },
  ]);
  /* שתי האמירות הסותרות ישבו על אותו כרטיס; זו שאינה נכונה הוסרה. */
  assert.equal(priceNote(p), null);
});

test("round52: שתי הרשומות שהמדרגה שלהן שווה ל-price נשארות מסויגות בצדק", () => {
  /*
   * ⚠️ `<` חזק ולא `<=` — זה כל ההבדל. ב-id 110 המחיר המותנה **הוא**
   * ₪35 שעל הכרטיס, וב-id 68 הוא ₪39.9.
   */
  for (const n of ["110", "68"]) {
    assert.deepEqual(
      priceNote(byId(n)),
      { label: "תנאי המחיר", value: "המחיר מותנה בכמות המנויים בחבילה" },
      `id ${n} איבדה הסתייגות נכונה`,
    );
  }
  const t68 = usableLineTiers(byId("68"));
  assert.ok(t68.some((t) => t.price >= byId("68").price), "מדרגה של id 68 ירדה מתחת ל-price");
});

test("round52: id 57 היא הרשומה היחידה בקטלוג שהשער הכמותי מזיז", () => {
  const moved = RAW.filter((p) => {
    const t = usableLineTiers(p);
    return (
      typeof p.price === "number" &&
      Number.isFinite(p.price) &&
      t.length > 0 &&
      t.every((x) => x.price < p.price)
    );
  }).map((p) => String(p.id));
  assert.deepEqual(moved, ["57"]);
});

test("round52: מחיר שהתאומות חולקות אינו נאמר כמבדיל", () => {
  const [v1, v2] = [byId("50"), byId("51")];
  const pair = [v1, v2];
  /* שתיהן ₪60 — וזה בדיוק מה ששורת 'מחיר לחודש' מדפיסה בשתי העמודות. */
  assert.equal(headlineValue(v1), headlineValue(v2));
  assert.equal(compareLabel(v1, pair), "Valentine's");
  assert.equal(compareLabel(v2, pair), "Valentine's · גרסה 2");
  assert.notEqual(compareLabel(v1, pair), compareLabel(v2, pair));
});

test("round52: וכשהמחיר כן ייחודי בין התאומות — הוא נשאר על שתיהן", () => {
  const [k1, k2] = [byId("23"), byId("24")];
  const pair = [k1, k2];
  assert.deepEqual([compareLabel(k1, pair), compareLabel(k2, pair)], ["כשר · ₪25", "כשר · ₪27.9"]);
});

test("round52: אין ולו זוג אחד בקטלוג ששתי התוויות שלו זהות", () => {
  /*
   * ⚠️ האינווריאנטה שסבב 44 קבע — נמדדת שוב, כי הסרת ענף המחיר
   * מרשומה אחת היא בדיוק הסיכון להחזיר כפילות.
   */
  const dupes = [];
  for (let i = 0; i < RAW.length; i++) {
    for (let j = i + 1; j < RAW.length; j++) {
      const pair = [RAW[i], RAW[j]];
      if (compareLabel(pair[0], pair) === compareLabel(pair[1], pair)) {
        dupes.push([String(RAW[i].id), String(RAW[j].id)]);
      }
    }
  }
  assert.deepEqual(dupes, []);
});
