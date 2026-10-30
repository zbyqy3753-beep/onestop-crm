import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { promoNoteRises, promoRise } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ אותו stub שבראש `tools/round40-browse.test.mjs` — שרשרת הייבוא
 * מגיעה ל-`../actions`, מודול `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");

/*
 * ⚠️ סבב 47, צד התצוגה — שתי אמירות שהשער שלהן כבר היה בקובץ:
 *
 *   • טון ה"עלייה" נקרא `rise.kind === "amount"` לבדו, ולכן עלייה
 *     שנמסרה בפרוזה קיבלה את הקופסה האפורה של הסתייגויות מבצע —
 *     זהה למי שלא מצהיר על עלייה בכלל. ids 42 ו-61 הן השתיים
 *     שמצהירות, ו-`promoNoteRises` הוא השער שמבדיל — עד כאן הוא
 *     נקרא רק כדי לבחור את התווית. id 42 ו-id 87 יושבות באותה רשת
 *     עם אותו ₪39.9 היום ואותו ₪69.9 אחרי, ונצבעו הפוך.
 *
 *   • `aria-controls="lp-filters"` הצביע על `id` שאינו קיים בשום
 *     מקום באפליקציה, בזמן שהפאנל עצמו נושא `useId`.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === id);

const RISE_SOFT = "bg-lp-rise-soft";
const NEUTRAL = "bg-lp-surface-2";

const cardHtml = (pkg) => renderToStaticMarkup(React.createElement(PackageCard, { pkg }));
const riseSoftCount = (html) => (html.match(new RegExp(RISE_SOFT, "g")) ?? []).length;

test("עלייה שנמסרה בפרוזה נצבעת כעלייה (ids 42, 61)", () => {
  for (const id of ["42", "61"]) {
    const pkg = byId(id);
    assert.ok(pkg, `id ${id} נעלמה מהקטלוג`);
    const rise = promoRise(pkg);
    assert.equal(rise?.kind, "note", `id ${id} עברה לענף אחר`);
    assert.equal(promoNoteRises(pkg, rise.note), true, `id ${id} אינה מצהירה על עלייה`);

    assert.equal(
      riseSoftCount(cardHtml(pkg)),
      1,
      `id ${id} מצהירה על עלייה ונצבעה בטון נייטרלי`,
    );
  }
});

test("נוסח מבצע שאינו מצהיר על עלייה נשאר נייטרלי", () => {
  /*
   * תשע מ-11 רשומות ענף ה-`note` פותחות במחיר **המבצע** — צביעתן
   * באדום הייתה אומרת בצבע את ההפוך ממה שהן אומרות במילים.
   */
  const neutral = live.filter((p) => {
    const rise = promoRise(p);
    return rise?.kind === "note" && !promoNoteRises(p, rise.note);
  });
  assert.equal(neutral.length, 9, "מספר הרשומות הנייטרליות בענף `note` זז");

  for (const pkg of neutral) {
    const html = cardHtml(pkg);
    assert.equal(
      riseSoftCount(html),
      0,
      `id ${pkg.id} אינה מצהירה על עלייה ונצבעה כעלייה`,
    );
    assert.ok(html.includes(NEUTRAL), `id ${pkg.id} איבדה את הטון הנייטרלי`);
  }
});

test("השער נקרא בשני המשטחים — הכרטיס ומגש ההשוואה", () => {
  for (const file of ["src/app/lp/ui/PackageCard.tsx", "src/app/lp/ui/CompareTray.tsx"]) {
    assert.match(
      readFileSync(file, "utf8"),
      /promoNoteRises\(pkg, rise\.note\)/,
      `${file} בוחר את הטון בלי שער הכיוון`,
    );
  }
});

test("`aria-controls` של כפתור הסינון מצביע על הפאנל האמיתי", () => {
  const src = readFileSync("src/app/lp/ui/CatalogBrowser.tsx", "utf8");
  assert.ok(
    !/aria-controls="lp-filters"/.test(src),
    "המחרוזת `lp-filters` אינה קיימת כ-`id` בשום מקום באפליקציה",
  );
  assert.match(src, /aria-controls=\{panelId\}/);
});
