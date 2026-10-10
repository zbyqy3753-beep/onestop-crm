import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { basePackages, byCategory, listable } from "../src/app/lp/catalog/catalog.ts";
import { familyPriceOnly, requiresMultipleLines } from "../src/app/lp/catalog/savings.ts";
import { discountIsCapped, headlineValue, priceNote } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף בבדיקה, ולא מתוך נוחות: הוא מודול
 * `"use server"` שמשרשר את שכבת ה-DB (`src/server/repositories`), שבה
 * יש `await` ברמת המודול — צורה ש-tsx אינו יכול לקמפל ל-CJS, ולכן
 * עצם ה**ייבוא** של `CatalogBrowser` נפל כאן. שרשרת הייבוא היא
 * `CatalogBrowser → PackageCard → LeadForm → ../actions`, ואף אחד
 * מהרכיבים שנבדקים כאן אינו קורא ל-Server Action. ההחלפה מצומצמת
 * למודול הזה בלבד, כדי שכל השאר — `PackageCard`, `format`, `savings`,
 * הקטלוג עצמו — יישאר הקוד האמיתי.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const {
  CatalogBrowser,
  catalogResults,
  matchesFilters,
  priceBoundsOf,
  providerFacets,
  sortCatalog,
  typeFacets,
} = await import("../src/app/lp/ui/CatalogBrowser.tsx");
const { CatalogTabs } = await import("../src/app/lp/ui/CatalogTabs.tsx");
const { CompareSheet } = await import("../src/app/lp/ui/CompareTray.tsx");

/** בריחת תווים ב-attribute, כפי ש-React כותב אותה. */
function escapeAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/*
 * ⚠️ עיון בקטלוג — המסננים, המונים, המיון וטבלת ההשוואה — מול
 * **הקטלוג האמיתי** (`packages.json`), בדיוק כמו `catalog.test.mjs`.
 *
 * ⚠️ הרכיבים נבדקים ברינדור אמיתי (`renderToStaticMarkup`) ולא בהשוואת
 * מחרוזות שנבנו ביד: כל שלושת הבאגים שהקובץ הזה חוסם היו **בפלט** —
 * מספר שהודפס בלי ההסתייגות שהכרטיס שלידו מדפיס, ריפוד שחסר בגיליון
 * הנייד, וסדר שהיפוך קומפרטור הפך על פיו.
 */

const ALL = listable(basePackages());
const NONE = { providers: [], types: [], maxPrice: null };

/* חבילה סינתטית — לשערים שהקטלוג של היום אינו מגיע אליהם. */
function fakePackage(id, price, extra = {}) {
  return {
    id,
    slug: `p-${id}`,
    category: "cellular",
    categoryHe: "סלולר",
    name: `חבילה ${id}`,
    type: "5G",
    badges: [],
    recommended: false,
    provider: { slug: "x", name: "X", logo: "x.png", raw: null },
    description: null,
    benefits: null,
    crmOrderUrl: "",
    priceAfterPromoNote: null,
    priceModel: "monthly",
    price,
    priceAfterPromo: null,
    spec: {
      dataGb: null,
      unlimitedData: false,
      minutes: null,
      sms: null,
      intlMinutes: null,
      simCost: null,
      connectionFee: null,
      transferFee: null,
      esim: false,
      kosher: false,
      fiveG: true,
      lineTiers: null,
    },
    ...extra,
  };
}

function fakeElectricity(id, discountPercent, extra = {}) {
  return {
    id,
    slug: `e-${id}`,
    category: "electricity",
    categoryHe: "חשמל",
    name: `מסלול ${id}`,
    type: "חשמל",
    badges: [],
    recommended: false,
    provider: { slug: "x", name: "X", logo: "x.png", raw: null },
    description: null,
    benefits: null,
    crmOrderUrl: "",
    priceAfterPromoNote: null,
    priceModel: "discount",
    price: null,
    priceAfterPromo: null,
    discountPercent,
    rawPriceField: null,
    spec: {
      discountPercent,
      allHours: true,
      hoursText: null,
      customerType: "private",
      commitment: null,
      smartMeterRequired: null,
      maxMonthlyBill: null,
    },
    ...extra,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * 1. טבלת ההשוואה והכרטיס אומרים את אותו דבר על אותו מחיר
 * ──────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ הפער שהבדיקות האלה חוסמות: שער שנוסף ל-`PackageCard` ולא לטבלה.
 * זה קרה כאן ארבע פעמים (ראה `discountIsCapped`, `priceNote`), ולכן
 * הנעילה היא על הפלט המרונדר של הטבלה ולא על `format.ts` לבדו —
 * `priceNote` יכולה להיות נכונה בזמן שהטבלה אינה מדפיסה אותה בכלל.
 * תשע חבילות בקטלוג של היום נושאות הסתייגות כזו.
 */
const CONDITIONED = ALL.filter(
  (p) => p.category !== "electricity" && p.price != null && (requiresMultipleLines(p) || familyPriceOnly(p)),
);

function sheetMarkup(items) {
  return renderToStaticMarkup(React.createElement(CompareSheet, { items, onClose() {} }));
}

test("השוואה: הקטלוג עדיין נושא חבילות שהמחיר שלהן מותנה בכמות מנויים", () => {
  // אם רענון מסיר את כולן, הבדיקות שמתחת הופכות לריקות — וזה צריך להיאמר.
  assert.ok(
    CONDITIONED.length >= 5,
    `צפויות לפחות 5 חבילות עם מחיר מותנה, נמצאו ${CONDITIONED.length}`,
  );
});

test("השוואה: מחיר מותנה בכמות מנויים נושא את ההסתייגות גם בטבלה", () => {
  const flat = ALL.find(
    (p) => p.category === "cellular" && p.price != null && priceNote(p)?.value == null,
  );
  assert.ok(flat, "לא נמצאה חבילה סלולרית עם מחיר שטוח");

  const missing = [];
  for (const p of CONDITIONED) {
    const html = sheetMarkup([p, flat]);
    const note = priceNote(p)?.value;
    assert.ok(note, `${p.id}: צפויה הסתייגות`);
    if (!html.includes(note)) missing.push(p.id);
  }

  assert.deepEqual(
    missing,
    [],
    `חבילות שהטבלה מדפיסה את המחיר שלהן בלי ההסתייגות שהכרטיס מדפיס: ${missing.join(", ")}`,
  );
});

test("השוואה: מחיר שטוח אינו מקבל הסתייגות מומצאת", () => {
  const flat = ALL.filter(
    (p) => p.category === "cellular" && p.price != null && priceNote(p)?.value == null,
  ).slice(0, 2);
  assert.equal(flat.length, 2);
  const html = sheetMarkup(flat);
  assert.ok(!html.includes("מותנה בכמות המנויים"));
  assert.ok(!html.includes("משני מנויים ומעלה"));
});

test("השוואה: ההסתייגות המחמירה קודמת — מינימום חוזי לפני מסלול משפחתי", () => {
  // id 16 נושא את שתי ההצהרות ("3 קווים ב 92.70" וגם "משפחתי"); הכרטיס
  // בוחר בראשונה, והטבלה חייבת לבחור באותה.
  const both = ALL.filter((p) => requiresMultipleLines(p) && familyPriceOnly(p));
  assert.ok(both.length > 0, "לא נמצאה חבילה שנושאת את שתי ההצהרות");
  for (const p of both) {
    assert.equal(priceNote(p)?.value, "המחיר מותנה בכמות המנויים בחבילה", `id ${p.id}`);
  }
});

test("השוואה: מסלול חשמל אינו מקבל הסתייגות על כמות מנויים", () => {
  const e = byCategory(ALL, "electricity");
  for (const p of e) {
    const v = priceNote(p)?.value ?? "";
    assert.ok(!v.includes("מנויים"), `id ${p.id}: ${v}`);
  }
  const html = sheetMarkup(e.slice(0, 2));
  assert.ok(html.includes("הנחה בחשבון"));
  assert.ok(!html.includes("מותנה בכמות המנויים"));
});

/*
 * ⚠️ בנייד חלון ההשוואה הוא גיליון שנצמד לתחתית המסך, ולכן הוא זקוק
 * לריפוד הגזרה הבטוחה — אותו תיקון שנעשה ב-`lp.css` לשורש הדף
 * ובסרגל ההשוואה עצמו, ונשאר פתוח דווקא בחלון שמעל שניהם.
 */
test("השוואה: גיליון הנייד מפנה מקום לגזרה הבטוחה", () => {
  const html = sheetMarkup(byCategory(ALL, "cellular").slice(0, 2));
  assert.match(html, /env\(safe-area-inset-bottom\)/);
});

/*
 * ⚠️ שורת המחיר בטבלה מול המספר הגדול שבכרטיס. הטבלה בנתה את
 * המחרוזת בעצמה בעוד הכרטיס עבר ל-`headlineValue`, ולכן `price: 0`
 * היה "₪0" בטבלה מול "—" בכרטיס ו-`discountPercent: null` היה
 * "null% הנחה" מול "—" — אותה רשומה בשני ערכים, זה לצד זה.
 */
function priceCells(html) {
  const tbody = html.slice(html.indexOf("<tbody>"));
  const row = tbody.slice(0, tbody.indexOf("</tr>"));
  return [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => m[1]);
}

test("השוואה: שורת המחיר מדפיסה בדיוק את המספר שהכרטיס מדפיס", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const partner = pkgs[pkgs.length - 1];
    for (const p of pkgs) {
      const cells = priceCells(sheetMarkup([p, partner]));
      const expected =
        cat === "electricity"
          ? `${discountIsCapped(p) ? "עד " : ""}${headlineValue(p)} הנחה`
          : headlineValue(p);
      assert.equal(cells[0], expected, `${cat}/${p.id}`);
    }
  }
});

test("השוואה: רשומה פגומה אינה מודפסת כמחיר אפס או כ-null אחוז", () => {
  const broken = fakePackage("zero", 0);
  const flat = fakePackage("flat", 49.9);
  assert.deepEqual(priceCells(sheetMarkup([broken, flat])), ["—", "₪49.9"]);

  const nullDiscount = fakeElectricity("null-pct", null);
  const real = fakeElectricity("real", 20);
  assert.deepEqual(priceCells(sheetMarkup([nullDiscount, real])), ["—", "20% הנחה"]);
});

test("השוואה: 'עד' על הנחה מדורגת, כמו בכרטיס", () => {
  const capped = fakeElectricity("capped", 10, {
    description: 'הנחה של עד 10% עד 149 ש"ח',
  });
  assert.ok(discountIsCapped(capped), "הרשומה הסינתטית אינה נקראת כתקרה");
  const flatPct = fakeElectricity("flat-pct", 6);
  assert.deepEqual(priceCells(sheetMarkup([capped, flatPct])), ["עד 10% הנחה", "6% הנחה"]);
});

test("השוואה: כותרות העמודה והשורה מוצהרות עם scope", () => {
  const html = sheetMarkup(byCategory(ALL, "cellular").slice(0, 3));
  assert.ok(html.includes('scope="col"'));
  assert.ok(html.includes('scope="row"'));
});

/* ────────────────────────────────────────────────────────────────────
 * 2. ציר המחיר קורא את שדה המחיר כמו כל שאר הדף
 * ──────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ `price: 0` היא הצורה שהמחלץ מייצר כשלא קרא מחיר (ids 18/22 בקטלוג
 * של היום, שנעצרות ב-`isListable`). `byPrice` ו-`afterPrice` שולחות
 * אותה לסוף הרשימה; המחוון קרא `?? Infinity` בלבד, ולכן היה מוריד את
 * הקצה התחתון ל-₪0 ומכניס אותה לכל תוצאה.
 */
test("מחוון: רשומה בלי מחיר שמיש אינה קובעת את קצה המחוון", () => {
  const pkgs = [fakePackage("a", 0), fakePackage("b", 50), fakePackage("c", 21.9)];
  assert.deepEqual(priceBoundsOf(pkgs), { min: 22, max: 50 });
});

test("מחוון: רשומה בלי מחיר שמיש אינה נכנסת לתוצאות של אף ערך מחוון", () => {
  const broken = fakePackage("a", 0);
  const pkgs = [broken, fakePackage("b", 50)];
  const bounds = priceBoundsOf(pkgs);
  for (let v = bounds.min; v <= bounds.max; v++) {
    const ids = catalogResults(pkgs, { ...NONE, maxPrice: v }, "price-asc").map((p) => p.id);
    assert.ok(!ids.includes("a"), `maxPrice=${v} הכניס רשומה בלי מחיר`);
  }
});

test("מחוון: כל ערך בטווח מחזיר לפחות תוצאה אחת בכל קטגוריה", () => {
  for (const cat of ["cellular", "home"]) {
    const pkgs = byCategory(ALL, cat);
    const bounds = priceBoundsOf(pkgs);
    assert.ok(bounds, cat);
    for (let v = bounds.min; v <= bounds.max; v++) {
      const n = catalogResults(pkgs, { ...NONE, maxPrice: v }, "recommended").length;
      assert.ok(n > 0, `${cat}: מחוון על ${v} החזיר 0 תוצאות`);
    }
  }
});

test("מחוון: בלשונית החשמל אין ציר מחיר כלל", () => {
  assert.equal(priceBoundsOf(byCategory(ALL, "electricity")), null);
});

/* ────────────────────────────────────────────────────────────────────
 * 3. מיון
 * ──────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ `byPrice` שולחת רשומה שאין בה מחיר שמיש לסוף **בכוונה**. המיון
 * היורד היה היפוך עיוור של הקומפרטור (`byPrice(b, a)`), ולכן הפך
 * דווקא את השער הזה: "מחיר: מהיקר לזול" היה נפתח בחבילות שהמחיר
 * שלהן לא נקרא. `byAfterPrice` כבר עושה את זה נכון בשני הכיוונים.
 */
test("מיון: 'מהיקר לזול' משאיר רשומה בלי מחיר בסוף, לא בראש", () => {
  const pkgs = [fakePackage("broken", 0), fakePackage("mid", 50), fakePackage("top", 99)];
  const desc = sortCatalog(pkgs, "price-desc").map((p) => p.id);
  assert.deepEqual(desc, ["top", "mid", "broken"]);
  const asc = sortCatalog(pkgs, "price-asc").map((p) => p.id);
  assert.deepEqual(asc, ["mid", "top", "broken"]);
});

test("מיון: שני הכיוונים מונוטוניים על הקטלוג האמיתי", () => {
  for (const cat of ["cellular", "home"]) {
    const pkgs = byCategory(ALL, cat);
    const asc = sortCatalog(pkgs, "price-asc").map((p) => p.price);
    const desc = sortCatalog(pkgs, "price-desc").map((p) => p.price);
    for (let i = 1; i < asc.length; i++) assert.ok(asc[i] >= asc[i - 1], `${cat} asc ב-${i}`);
    for (let i = 1; i < desc.length; i++) assert.ok(desc[i] <= desc[i - 1], `${cat} desc ב-${i}`);
    assert.deepEqual([...desc].reverse(), asc, `${cat}: היורד אינו ההיפוך של העולה`);
  }
});

test("מיון: 'אחרי ההטבה' לא מדרג חבילה שלא ידוע מה תעלה מעל אחת שידוע", () => {
  for (const cat of ["cellular", "home"]) {
    const sorted = sortCatalog(byCategory(ALL, cat), "after-asc");
    let seenUnknown = false;
    for (const p of sorted) {
      const known = !(p.priceAfterPromoNote && p.priceAfterPromo == null);
      if (!known) seenUnknown = true;
      else assert.ok(!seenUnknown, `${cat}: ${p.id} ידוע אך מופיע אחרי לא-ידוע`);
    }
  }
});

test("מיון: המיון אינו משנה את קבוצת התוצאות", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const base = new Set(pkgs.map((p) => p.id));
    for (const sort of ["recommended", "price-asc", "price-desc", "after-asc"]) {
      const ids = catalogResults(pkgs, NONE, sort).map((p) => p.id);
      assert.equal(ids.length, pkgs.length, `${cat}/${sort}`);
      assert.deepEqual(new Set(ids), base, `${cat}/${sort}`);
    }
  }
});

/* ────────────────────────────────────────────────────────────────────
 * 4. המונים שעל השבבים מסכימים עם הרשימה שמתחתיהם
 * ──────────────────────────────────────────────────────────────────── */

test("מסננים: המונה על כל אפשרות הוא בדיוק מה שהיא מוסיפה לתוצאות", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const bounds = priceBoundsOf(pkgs);
    const prices = bounds ? [null, bounds.min, Math.round((bounds.min + bounds.max) / 2)] : [null];
    const types = [...new Set(pkgs.map((p) => p.type).filter(Boolean))];

    for (const maxPrice of prices) {
      for (const seedTypes of [[], types.slice(0, 1)]) {
        const base = { providers: [], types: seedTypes, maxPrice };
        const before = catalogResults(pkgs, base, "recommended").length;
        for (const o of providerFacets(pkgs, base)) {
          const after = catalogResults(pkgs, { ...base, providers: [o.slug] }, "recommended").length;
          assert.equal(after, o.count, `${cat}: חברה ${o.slug} הצהירה ${o.count} והחזירה ${after}`);
        }
        // שתי חברות הן איחוד: הסכום של שני המונים.
        const two = providerFacets(pkgs, base).slice(0, 2);
        if (two.length === 2) {
          const after = catalogResults(
            pkgs,
            { ...base, providers: two.map((o) => o.slug) },
            "recommended",
          ).length;
          assert.equal(after, two[0].count + two[1].count, `${cat}: איחוד שתי חברות`);
        }
        assert.ok(before >= 0);
      }
    }
  }
});

test("מסננים: המונה על שבב סוג הוא בדיוק מה שהוא מחזיר", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const bounds = priceBoundsOf(pkgs);
    const providerSlugs = [...new Set(pkgs.map((p) => p.provider.slug))];
    const seeds = [[], providerSlugs.slice(0, 1)];
    const prices = bounds ? [null, Math.round((bounds.min + bounds.max) / 2)] : [null];

    for (const maxPrice of prices) {
      for (const providers of seeds) {
        const base = { providers, types: [], maxPrice };
        for (const [type, count] of typeFacets(pkgs, base)) {
          const after = catalogResults(pkgs, { ...base, types: [type] }, "recommended").length;
          assert.equal(after, count, `${cat}: סוג ${type} הצהיר ${count} והחזיר ${after}`);
        }
      }
    }
  }
});

/*
 * ⚠️ מסנן פעיל חייב להיות ניתן לביטול. פעמיים כבר קרה שאפשרות
 * **מסומנת** נעלמה מהמסך כשמסנן אחר צמצם את התוצאות — תג סינון
 * שמראה 2, תוצאות מסוננות, ושום פקד לבטל.
 */
test("מסננים: אפשרות מסומנת נשארת ברשימה גם כשהמונה שלה 0", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const bounds = priceBoundsOf(pkgs);
    const providerSlugs = [...new Set(pkgs.map((p) => p.provider.slug))];
    const types = [...new Set(pkgs.map((p) => p.type).filter(Boolean))];
    const prices = bounds ? [null, bounds.min, bounds.max] : [null];

    for (const maxPrice of prices) {
      for (const slug of providerSlugs) {
        for (const type of types) {
          const f = { providers: [slug], types: [type], maxPrice };
          assert.ok(
            providerFacets(pkgs, f).some((o) => o.slug === slug),
            `${cat}: החברה ${slug} נעלמה בזמן שהיא מסומנת`,
          );
          assert.ok(
            typeFacets(pkgs, f).some(([t]) => t === type),
            `${cat}: הסוג ${type} נעלם בזמן שהוא מסומן`,
          );
        }
      }
    }
  }
});

test("מסננים: בלי מסננים סכום מוני החברות הוא מספר התוצאות", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const sum = providerFacets(pkgs, NONE).reduce((a, o) => a + o.count, 0);
    assert.equal(sum, pkgs.length, cat);
  }
});

/*
 * ⚠️ `type: null` אינו נספר באף שבב (id 147 בחשמל), וזה ממצא פתוח
 * שמחכה להכרעה — אין דלי "אחר". הבדיקה מקבעת את הפער בגודלו הנוכחי
 * כדי שרענון שמגדיל אותו לא יעבור בשקט.
 */
test("מסננים: הפער בין סכום שבבי הסוג לתוצאות הוא בדיוק רשומות בלי סוג", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const sum = typeFacets(pkgs, NONE).reduce((a, [, n]) => a + n, 0);
    const noType = pkgs.filter((p) => !p.type).map((p) => p.id);
    assert.equal(sum + noType.length, pkgs.length, `${cat}: ללא סוג — ${noType.join(", ")}`);
  }
  assert.deepEqual(
    byCategory(ALL, "electricity")
      .filter((p) => !p.type)
      .map((p) => p.id),
    ["147"],
    "רשומות בלי סוג בחשמל — חוב ידוע",
  );
});

/* ────────────────────────────────────────────────────────────────────
 * 5. השם הנגיש של פקד שנושא מונה
 * ──────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ חישוב השם הנגיש משרשר את טקסט הילדים בלי להוסיף רווח כשאין
 * רווח ב-DOM. תיבת הסימון של החברה הכריזה "גולן טלקום18" והלשונית
 * "סלולר55"; שבבי הסוג דווקא כן הפרידו — אותו נתון בשלוש צורות
 * בשלושה פקדים שיושבים זה מעל זה.
 */
function accessibleNames(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "g");
  return [...html.matchAll(re)]
    .map((m) => /aria-label="([^"]*)"/.exec(m[0]))
    .filter(Boolean)
    .map((m) => m[1]);
}

test("נגישות: המונה על תיבת החברה ועל שבב הסוג אינו נדבק לשם", () => {
  for (const cat of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, cat);
    const html = renderToStaticMarkup(
      React.createElement(CatalogBrowser, { packages: pkgs, category: cat }),
    );
    const unit = cat === "electricity" ? "מסלול" : "חביל";

    for (const o of providerFacets(pkgs, NONE)) {
      const expected = `${o.name} — ${o.count} `;
      assert.ok(
        html.includes(`aria-label="${escapeAttr(expected)}`),
        `${cat}: לתיבת ${o.name} אין שם נגיש שמפריד את המונה`,
      );
    }
    for (const [type, count] of typeFacets(pkgs, NONE)) {
      assert.ok(
        html.includes(`aria-label="${escapeAttr(`${type} — ${count} `)}`),
        `${cat}: לשבב ${type} אין שם נגיש שמפריד את המונה`,
      );
    }
    // המילה שמסבירה מה נספר — חבילות או מסלולים — לפי הקטגוריה.
    assert.ok(
      accessibleNames(html, "input").some((n) => n.includes(unit)),
      `${cat}: המונה אינו אומר מה הוא מונה`,
    );
  }
});

test("נגישות: הלשונית מכריזה את הקטגוריה והמונה בנפרד", () => {
  const html = renderToStaticMarkup(React.createElement(CatalogTabs, { packages: ALL }));
  // שלוש הלשוניות ראשונות ב-DOM; מה שאחריהן הוא שבבי הסוג של הקטלוג.
  const names = accessibleNames(html, "button")
    .filter((n) => n.includes("—"))
    .slice(0, 3);
  assert.deepEqual(names, [
    `סלולר — ${byCategory(ALL, "cellular").length} חבילות`,
    `אינטרנט וטלוויזיה — ${byCategory(ALL, "home").length} חבילות`,
    `חשמל — ${byCategory(ALL, "electricity").length} מסלולים`,
  ]);
});

test("נגישות: צורת היחיד נשמרת גם בשם הנגיש", () => {
  const html = renderToStaticMarkup(
    React.createElement(CatalogTabs, { packages: [byCategory(ALL, "cellular")[0]] }),
  );
  assert.ok(
    accessibleNames(html, "button").includes("סלולר — 1 חבילה"),
    "לשונית עם חבילה אחת הכריזה 'חבילות'",
  );
});

test("מסננים: הפרדיקט מנטרל ציר אחד בלבד", () => {
  const p = fakePackage("a", 50, { type: "4G" });
  const f = { providers: ["other"], types: ["5G"], maxPrice: 10 };
  assert.equal(matchesFilters(p, f), false);
  assert.equal(matchesFilters(p, f, "providers"), false);
  assert.equal(matchesFilters(p, { ...f, types: [], maxPrice: null }, "providers"), true);
  assert.equal(matchesFilters(p, { providers: [], types: [], maxPrice: 50 }), true);
  assert.equal(matchesFilters(p, { providers: [], types: [], maxPrice: 49 }), false);
  // רשומה בלי סוג אינה נתפסת על ידי שום שבב סוג.
  assert.equal(
    matchesFilters(fakePackage("b", 50, { type: null }), { providers: [], types: ["5G"], maxPrice: null }),
    false,
  );
});
