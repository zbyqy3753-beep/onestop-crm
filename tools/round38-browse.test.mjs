import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { basePackages, byCategory, listable } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף בבדיקה — ההנמקה המלאה יושבת בראש
 * `tools/lpBrowse.test.mjs`, וזה אותו stub בדיוק: שרשרת הייבוא
 * `CatalogBrowser → PackageCard → LeadForm → ../actions` מגיעה למודול
 * `"use server"` ש-tsx אינו יכול לקמפל, ואף רכיב שנבדק כאן אינו קורא
 * ל-Server Action.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { CatalogBrowser } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

const ALL = listable(basePackages());

const render = (packages, category) =>
  renderToStaticMarkup(React.createElement(CatalogBrowser, { packages, category }));

/** הטקסט שהגולש רואה, בלי התגיות. */
const text = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* ────────────────────────────────────────────────────────────────────
 * סבב 38 — המסך הריק אינו תולה את הריקנות במסנן שלא הופעל
 * ──────────────────────────────────────────────────────────────────── */

/*
 * ⚠️ "אין חבילות שמתאימות לסינון. נסו להסיר חלק מהמסננים" הודפס על
 * **כל** רשימה ריקה, כולל קטגוריה שאין בה חבילה גלויה אחת — ואז אין
 * מסנן אחד להסיר: תג הסינון אינו מרונדר, "נקה הכל" מכריז על עצמו
 * כלא-זמין, והפאנל ריק. המסך שלח את הגולש לחפש פקד שאינו קיים ותלה
 * בו ריקנות שאינה שלו.
 *
 * הקטגוריות של היום כולן מאוכלסות (55/33/18), ולכן זה שער לרענון הבא
 * — מאותה מחלקה של "המשטח מדפיס מצב שהשער אינו מכיר" שהקבצים האלה
 * מתעדים שוב ושוב. הוא נבדק על רשימה ריקה כי זו הצורה המדויקת שבה
 * `page.tsx` תעביר קטגוריה שהרענון רוקן.
 */
test("ריק: בלי מסנן פעיל המסך אינו מורה להסיר מסננים", () => {
  for (const [category, word] of [
    ["cellular", "חבילות"],
    ["home", "חבילות"],
    ["electricity", "מסלולים"],
  ]) {
    const body = text(render([], category));
    assert.ok(
      !body.includes("נסו להסיר"),
      `${category}: המסך מורה להסיר מסננים כשאין אף מסנן פעיל — ${body}`,
    );
    assert.ok(
      !body.includes("שמתאימות לסינון") && !body.includes("שמתאימים לסינון"),
      `${category}: הריקנות נתלית בסינון שלא הופעל — ${body}`,
    );
    /* ⚠️ והצורה נגזרת מהקטגוריה, כמו בכל מונה בדף. */
    assert.ok(
      body.includes(`אין כאן ${word} להצגה כרגע.`),
      `${category}: אין נוסח ריק שאומר "${word}" — ${body}`,
    );
  }
});

/*
 * ⚠️ אזור מסנן בלי אף פקד אינו מרונדר — הצד ההפוך של השער על
 * `typeOptions` (קומיט 8ef2dbe), שם פקד **פעיל** נעלם. כאן נשארה
 * תווית: קבוצה מסומנת "חברה" שאין בתוכה תיבה אחת, כלומר כותרת
 * שמבטיחה מסנן שאינו קיים, ולקורא מסך "קבוצה, חברה" ואחריה כלום.
 */
test("ריק: אין קבוצת 'חברה' כשאין אף חברה לסנן לפיה", () => {
  for (const category of ["cellular", "home", "electricity"]) {
    assert.ok(
      !render([], category).includes(">חברה<"),
      `${category}: מרונדרת קבוצת מסנן חברה בלי אף תיבת סימון`,
    );
  }
});

/*
 * ⚠️ והשער אינו "לא מרנדרים לעולם". זו הטעות שהתיקון למסנן הסוג נכתב
 * נגדה, ולכן שתי הבדיקות חייבות לשבת זו לצד זו: על הקטלוג האמיתי
 * הקבוצה כן על המסך, עם תיבה לכל חברה שיש לה חבילה גלויה.
 */
test("לא ריק: קבוצת 'חברה' על המסך בכל שלוש הקטגוריות", () => {
  for (const category of ["cellular", "home", "electricity"]) {
    const pkgs = byCategory(ALL, category);
    assert.ok(pkgs.length > 0, `${category}: אין חבילות — הקטלוג השתנה מתחת לבדיקה`);
    const html = render(pkgs, category);
    assert.ok(html.includes(">חברה<"), `${category}: קבוצת מסנן החברה נעלמה`);
    assert.ok(
      !text(html).includes("אין כאן"),
      `${category}: נוסח המסך הריק מודפס על קטגוריה מאוכלסת`,
    );
  }
});
