import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { basePackages, listable, packageTitle, providerName } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף, מאותה סיבה שמתועדת ב-`lpBrowse.test.mjs`:
 * הוא מודול `"use server"` עם `await` ברמת המודול, ש-tsx אינו יכול לקמפל
 * ל-CJS — כלומר עצם הייבוא של `LeadForm`/`CatalogBrowser` נופל בלעדיו.
 * אף רכיב שנבדק כאן אינו קורא ל-Server Action.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { LeadForm } = await import("../src/app/lp/ui/LeadForm.tsx");
const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");
const { CompareSheet } = await import("../src/app/lp/ui/CompareTray.tsx");
const { sortCatalog } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

const ALL = listable(basePackages());
const REAL = ALL.find((p) => p.category === "cellular");

/*
 * ────────────────────────────────────────────────────────────────────
 * 1. שם החבילה: שער אחד בכל המשטחים שמדפיסים אותו — כולל הטופס
 * ────────────────────────────────────────────────────────────────────
 *
 * ⚠️ `LeadForm` היה המשטח הרביעי שקרא את `pkg.name` גולמי, אחרי שהשער
 * (`packageTitle`/`packageLabel`) חובר לכרטיס, לשבב במגש ההשוואה
 * ולכותרת העמודה בטבלה — והוא יושב *בתוך* הכרטיס המגודר. הקטלוג נכנס
 * לקוד דרך `as unknown as Catalog`, כלומר אין ולידציה בזמן ריצה.
 */

/** החבילה האמיתית עם שדה אחד שהוחלף בצורה שהמחלץ עשוי לייצר. */
function corrupt(field, value) {
  return { ...REAL, [field]: value };
}

function leadMarkup(pkg, props = {}) {
  return renderToStaticMarkup(React.createElement(LeadForm, { pkg, ...props }));
}

function hiddenPackageName(html) {
  const m = html.match(/name="packageName" value="([^"]*)"/);
  return m ? m[1] : null;
}

test("טופס: שם חבילה פגום אינו מפיל את רינדור הטופס", () => {
  for (const bad of [{}, null, 5, ["a"], { he: "x" }]) {
    for (const compact of [true, false]) {
      assert.doesNotThrow(
        () => leadMarkup(corrupt("name", bad), { compact }),
        `name=${JSON.stringify(bad)} compact=${compact}`,
      );
    }
  }
});

test("טופס: העמודה packageName אינה נושאת [object Object] או null", () => {
  for (const bad of [{}, null, 5, ["a"]]) {
    const value = hiddenPackageName(leadMarkup(corrupt("name", bad), { compact: true }));
    assert.ok(value, `name=${JSON.stringify(bad)}: צפוי שדה מוסתר`);
    for (const junk of ["[object Object]", "null", "undefined", "NaN"]) {
      assert.ok(
        !value.includes(junk),
        `name=${JSON.stringify(bad)}: העמודה נשלחה כ-"${value}"`,
      );
    }
    // בלי שם — שם הספק לבדו, ולא "ספק · ספק".
    assert.equal(value, providerName(REAL), `name=${JSON.stringify(bad)}`);
  }
});

test("טופס: שם תקין נשלח בעמודה עם הספק, פעם אחת", () => {
  const value = hiddenPackageName(leadMarkup(REAL, { compact: true }));
  assert.equal(value, `${packageTitle(REAL)} · ${providerName(REAL)}`);
});

test("טופס: הטקסט שהמבקר רואה אינו 'לגבי ' בלי מושא", () => {
  // `!compact` הוא המסלול שהדפיס את השדה כילד של React וזרק עליו.
  const html = leadMarkup(corrupt("name", {}), { compact: false });
  assert.ok(html.includes(providerName(REAL)), "צפויה נפילה חזרה לשם הספק");
  assert.ok(!html.includes("[object Object]"));
});

test("טופס: השם מנוקה משאריות המחלץ, כמו בכרטיס ובטבלה", () => {
  // `basePackages` מנקה `name` במקום, ולכן השארית נבדקת על רשומה
  // שנבנתה ישירות — בדיוק הצורה שמגיעה ממסלול שאינו עובר שם.
  const raw = corrupt("name", "סלקום משפחתי פלוס [line] חבילה זו מיועדת לבעלי כרטיס אשראי בלבד");
  const value = hiddenPackageName(leadMarkup(raw, { compact: true }));
  assert.ok(value.startsWith("סלקום משפחתי פלוס ·"), value);
  assert.ok(!value.includes("[line]"), value);
});

/*
 * ────────────────────────────────────────────────────────────────────
 * 2. שדות הטקסט שכבר גודרו — נעילה שלא ייפתחו שוב
 * ────────────────────────────────────────────────────────────────────
 */

test("כרטיס: name/type/description/benefits/badges פגומים אינם מפילים אותו", () => {
  const bads = [{}, null, 5, ["x"], true];
  for (const field of ["name", "type", "description", "benefits", "badges"]) {
    for (const bad of bads) {
      assert.doesNotThrow(
        () =>
          renderToStaticMarkup(
            React.createElement(PackageCard, { pkg: corrupt(field, bad), defaultOpen: true }),
          ),
        `${field}=${JSON.stringify(bad)}`,
      );
    }
  }
});

test("מגש/טבלה: שם פגום אינו מפיל את כותרת העמודה", () => {
  for (const bad of [{}, null, 5, ["x"]]) {
    assert.doesNotThrow(
      () =>
        renderToStaticMarkup(
          React.createElement(CompareSheet, {
            items: [corrupt("name", bad), REAL],
            onClose() {},
          }),
        ),
      `name=${JSON.stringify(bad)}`,
    );
  }
});

/*
 * ────────────────────────────────────────────────────────────────────
 * 3. `recommended`: הכרטיס והמיון קוראים את אותו שדה אותו דבר
 * ────────────────────────────────────────────────────────────────────
 *
 * ⚠️ `Number("false")` הוא `NaN`, ו-`NaN` נבלע ב-`||` ונופל למחיר:
 * הכרטיס צייר "מומלץ" ותפריט "מומלצים תחילה" התעלם. שני קוראים
 * לאותו שדה בשני פקדים שיושבים זה מעל זה.
 */

test("מיון: כל ערך שהכרטיס מסמן כמומלץ מדורג גם ראשון", () => {
  for (const flag of [true, "false", "yes", 1, {}, "0"]) {
    const marked = { ...REAL, id: "flagged", price: 99, recommended: flag };
    const plain = { ...REAL, id: "plain", price: 10, recommended: false };
    const html = renderToStaticMarkup(React.createElement(PackageCard, { pkg: marked }));
    const badge = html.includes("מומלץ");
    const first = sortCatalog([plain, marked], "recommended")[0].id === "flagged";
    assert.equal(
      badge,
      first,
      `recommended=${JSON.stringify(flag)}: תג=${badge} אבל ראשון במיון=${first}`,
    );
  }
});

test("מיון: ערך לא בוליאני אינו מחזיר קומפרטור ל-NaN (סדר תלוי-קלט)", () => {
  const list = [
    { ...REAL, id: "a", price: 90, recommended: "false" },
    { ...REAL, id: "b", price: 10, recommended: "false" },
    { ...REAL, id: "c", price: 50, recommended: "false" },
  ];
  const order = (arr) => sortCatalog(arr, "recommended").map((p) => p.id).join(",");
  assert.equal(order(list), order([...list].reverse()), "הסדר השתנה עם סדר הקלט");
});

/*
 * ────────────────────────────────────────────────────────────────────
 * 4. ניגודיות: טקסט קטן אינו נושא את `lp-ink-3`
 * ────────────────────────────────────────────────────────────────────
 *
 * ⚠️ `--color-lp-ink-3` (`#7d8b99`) הוא 3.49:1 על לבן ו-3.27:1 על
 * `lp-surface-2` — מתחת ל-AA (4.5:1) לכל טקסט שאינו "גדול", ו-`lp-2xs`
 * הוא 11px. הנעילה היא על הפלט המרונדר ולא על הקוד, כי זה בדיוק מה
 * שהמבקר רואה בטלפון.
 */

function smallInkThree(html) {
  const out = [];
  for (const m of html.matchAll(/class="([^"]*lp-ink-3[^"]*)"/g)) {
    const cls = m[1];
    if (/\btext-(lp-2xs|xs|sm)\b/.test(cls)) out.push(cls);
  }
  return out;
}

test("כרטיס: אין טקסט ≤14px ב-lp-ink-3", () => {
  const html = renderToStaticMarkup(
    React.createElement(PackageCard, {
      pkg: REAL,
      defaultOpen: true,
      onCompareToggle() {},
    }),
  );
  assert.deepEqual(smallInkThree(html), []);
});

test("טבלת ההשוואה: תוויות השורות אינן ב-lp-ink-3", () => {
  const html = renderToStaticMarkup(
    React.createElement(CompareSheet, { items: [REAL, ALL[1]], onClose() {} }),
  );
  assert.deepEqual(
    smallInkThree(html).filter((c) => !/text-2xl/.test(c)),
    [],
  );
});
