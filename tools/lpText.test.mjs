import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  basePackages,
  freeText,
  listable,
  packageLabel,
  packageTitle,
  providerName,
} from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף — אותה החלפה בדיוק שמתועדת ב-
 * `tools/lpBrowse.test.mjs`: שרשרת `CatalogBrowser → PackageCard →
 * LeadForm → ../actions` נוגעת בשכבת ה-DB, שבה יש `await` ברמת המודול,
 * וזו צורה ש-tsx אינו יכול לקמפל ל-CJS — כלומר עצם ה**ייבוא** נופל.
 * ההחלפה מצומצמת למודול הזה בלבד; כל השאר הוא הקוד האמיתי.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { CatalogBrowser, matchesFilters, typeFacets } = await import(
  "../src/app/lp/ui/CatalogBrowser.tsx"
);
const { CompareSheet, CompareTray } = await import("../src/app/lp/ui/CompareTray.tsx");
const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");

const ALL = listable(basePackages());
const NONE = { providers: [], types: [], maxPrice: null };
const BASE = ALL.find((p) => p.category === "cellular");
const HOME = ALL.find((p) => p.category === "home");

/*
 * ⚠️ הבדיקות כאן הן על **שדות הטקסט שהמשטחים מדפיסים** — `name`,
 * `type`, `description`, `benefits` — ולא על המספרים. המחלקה היא
 * אחת: הקטלוג נכנס דרך `as unknown as Catalog`, אין ולידציה בזמן
 * ריצה, ושדה בצורה בלתי צפויה שנקרא בלי שער אינו מפיל כרטיס אחד
 * אלא זורק בתוך רינדור השרת ומחזיר את **כל** `/lp` ב-500.
 *
 * ⚠️ רינדור אמיתי (`renderToStaticMarkup`) ולא השוואת מחרוזות: כל
 * שלוש הנפילות שהקובץ הזה חוסם היו נפילות של **הרנדרר**, לא של
 * הלוגיקה.
 */

/** כל שלושת המשטחים שלי על אותה רשומה, בקריאה אחת. */
function renderAll(pkg) {
  return {
    card: renderToStaticMarkup(
      React.createElement(PackageCard, { pkg, defaultOpen: true, onCompareToggle() {} }),
    ),
    tray: renderToStaticMarkup(
      React.createElement(CompareTray, {
        items: [pkg, BASE],
        onRemove() {},
        onClear() {},
        max: 4,
      }),
    ),
    sheet: renderToStaticMarkup(
      React.createElement(CompareSheet, { items: [pkg, BASE], onClose() {} }),
    ),
    browser: renderToStaticMarkup(
      React.createElement(CatalogBrowser, { packages: [pkg, BASE], category: "cellular" }),
    ),
  };
}

/*
 * שם שאינו מחרוזת הוא תצורה שהקטלוג **מייצר במכוון**: `basePackages`
 * משאירה אותו כמות שהוא ("דריסה הייתה מוחקת את הראיה היחידה שהרשומה
 * פגומה"), ולכן השער חייב לשבת בצד שמדפיס.
 */
test("טקסט: שם חבילה פגום אינו מפיל אף אחד משלושת המשטחים", () => {
  for (const name of [{}, { he: "x" }, [], 5, null, undefined, true]) {
    const pkg = { ...BASE, name };
    assert.doesNotThrow(() => renderAll(pkg), `name: ${JSON.stringify(name)}`);
  }
});

test("טקסט: שם חבילה פגום אינו מודפס כ-[object Object] ולא כ-null", () => {
  for (const name of [{}, [], null, 5]) {
    const html = Object.values(renderAll({ ...BASE, name })).join("\n");
    assert.ok(!html.includes("[object Object]"), `name: ${JSON.stringify(name)}`);
    assert.ok(!/>null</.test(html), `name: ${JSON.stringify(name)}`);
  }
});

/*
 * ⚠️ הכותרת הנראית יכולה להיות ריקה (שם הספק מודפס לידה ממילא), אבל
 * **שם נגיש** ריק הוא פקד שמכריז על פעולה בלי לומר על מה.
 */
test("נגישות: תיבת ההשוואה והשבב נושאים שם גם כשהשם פגום", () => {
  const pkg = { ...BASE, name: {} };
  const { card, tray } = renderAll(pkg);
  const provider = providerName(pkg);
  assert.ok(provider !== "", "הרשומה הנבחרת חייבת לשאת שם ספק");
  assert.ok(card.includes(`הוסף את ${provider} להשוואה`), card.slice(0, 400));
  assert.ok(tray.includes(`הסר את ${provider} מההשוואה`), tray.slice(0, 400));
});

test("טקסט: שדה הסוג הפגום אינו מפיל את הכרטיס ואת שבבי הסינון", () => {
  for (const type of [{}, [{}], [], 5, true]) {
    assert.doesNotThrow(() => renderAll({ ...BASE, type }), `type: ${JSON.stringify(type)}`);
  }
});

/*
 * ⚠️ סוג שאינו תווית אינו מודפס אבל כן מקבל פקד: `typeKey` ממפה אותו
 * לדלי "אחר", כי רשומה שנפלה ממסנן שאין לה בו פקד נעלמה גם כששלושת
 * השבבים דלוקים (id 147 בחשמל). הערך הגולמי עצמו לא מגיע למסך.
 */
test("טקסט: סוג שאינו תווית נכנס לדלי 'אחר' ואינו מודפס כמו שהוא", () => {
  for (const type of [{}, 5, ""]) {
    const pkg = { ...BASE, type };
    const html = Object.values(renderAll(pkg)).join("\n");
    assert.ok(!html.includes("[object Object]"), `type: ${JSON.stringify(type)}`);
    assert.deepEqual(
      typeFacets([pkg], NONE),
      [["אחר", 1]],
      `type: ${JSON.stringify(type)} — חייב פקד שמחזיר את הרשומה`,
    );
    assert.equal(
      matchesFilters(pkg, { ...NONE, types: ["אחר"] }),
      true,
      `type: ${JSON.stringify(type)} — השבב חייב להחזיר אותה`,
    );
  }
});

/* סוג פגום אינו יכול להתאים לשבב שסומן — ואינו נושר כשהמסנן כבוי. */
test("מסננים: סוג פגום נושר כשמסנן הסוג פעיל ונשאר כשהוא כבוי", () => {
  const pkg = { ...BASE, type: {} };
  assert.equal(matchesFilters(pkg, NONE), true);
  assert.equal(matchesFilters(pkg, { ...NONE, types: [BASE.type] }), false);
});

/*
 * `description`/`benefits` הם אותו טקסט חופשי, והנפילה שלהם היא
 * **בלחיצה**: הם מרונדרים רק בפאנל הפתוח, ו-`benefits` הוא גם אחד
 * משלושת התנאים שמציירים את הכפתור — כלומר ערך פגום צייר כפתור
 * שמפיל את העץ ברגע שנלחץ.
 */
test("טקסט: פרוזה פגומה אינה מפילה את הפאנל הפתוח", () => {
  for (const patch of [
    { description: {} },
    { benefits: {} },
    { description: [{}] },
    { description: 5, benefits: 7 },
  ]) {
    const pkg = { ...BASE, ...patch };
    assert.doesNotThrow(
      () => renderToStaticMarkup(React.createElement(PackageCard, { pkg, defaultOpen: true })),
      JSON.stringify(patch),
    );
  }
});

test("טקסט: הטבות פגומות אינן מציירות כפתור 'פרטים מלאים' ריק", () => {
  /* רשומה שכל שלושת התנאים שלה ריקים — ראה את השער בכרטיס. */
  const bare = {
    ...BASE,
    spec: {},
    description: null,
    benefits: {},
    priceAfterPromo: null,
    priceAfterPromoNote: null,
  };
  const html = renderToStaticMarkup(React.createElement(PackageCard, { pkg: bare }));
  assert.ok(!html.includes("פרטים מלאים"), html.slice(0, 600));
});

/*
 * ⚠️ והשער אינו משנה דבר בקטלוג של היום. 109 הרשומות נקיות, ולכן
 * כל ההוספה הזו היא שער לרענון הבא — ובדיקה שמוכיחה את זה היא מה
 * שמפריד בין שער לבין שינוי התנהגות שלא הוזמן.
 */
test("טקסט: הקטלוג של היום עובר את השערים בלי שינוי", () => {
  for (const p of ALL) {
    assert.equal(packageTitle(p), p.name, `id ${p.id}`);
    assert.equal(freeText(p.type), p.type ?? null, `id ${p.id}`);
    assert.equal(packageLabel(p, providerName(p)), p.name, `id ${p.id}`);
  }
  assert.ok(ALL.length > 100, `נבדקו ${ALL.length} רשומות`);
  assert.ok(HOME, "חייבת להיות חבילת בית אחת לפחות");
});
