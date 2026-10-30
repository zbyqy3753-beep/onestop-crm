import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * ⚠️ אותו stub שבראש `tools/round40-calc-ui.test.mjs` — `LeadForm`
 * מייבא `../actions`, מודול `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { LeadForm } = await import("../src/app/lp/ui/LeadForm.tsx");
const { basePackages } = await import("../src/app/lp/catalog/catalog.ts");
const { computeSaving } = await import("../src/app/lp/catalog/savings.ts");

/*
 * ⚠️ סבב 47, מסלול הליד — שלוש אמירות שהמשטח השכן כבר מקיים:
 *
 *   • עמודת `packageName` ב-CRM ("החבילה שהגולש **לחץ** עליה", לפי
 *     `actions.ts`) נחתמה על כל ליד שבו נמצאה חבילה, גם כשהמחשבון
 *     הכריז שאין חיסכון. סלולר/קו אחד/₪30: המסך אומר "לא נוכל
 *     להבטיח חיסכון", `sentSubject` אומר את אותו דבר, ההערה אומרת
 *     "לא מצא חיסכון" — והעמודה נחתמה `wecom300GB 5G · WeCom`,
 *     חבילה ש-₪4 בחודש **יקרה** ממה שהגולש משלם. מפתח הסינון של
 *     הנציג נחתם על ההיפך מלקוח של אותה חבילה.
 *
 *   • `LeadForm` גידר את ה-`title` לבדו ולא את הספק, ולכן ספק ריק
 *     כתב `"<שם> · "` לתוך אותה עמודה. המחשבון מגדר את שני הצדדים.
 *
 *   • ההסתייגות על קו הטלפון בדקה `phoneExtra` לפני `phoneMissing`,
 *     ושני התנאים אינם מוציאים זה את זה: רשומה עם `hasPhone: false`
 *     **וגם** הצהרת תוספת קיבלה את הנוסח "ובה קו הטלפון **כלול**" —
 *     הכחשה של מה שהרשומה מסרה. רדום היום (157 היא `true`+תוספת,
 *     3 היא `false` בלי תוספת), שער לרענון הבא.
 */

const PACKAGES = basePackages();
const calcSrc = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");

test("בלי חיסכון — עמודת החבילה אינה נחתמת", () => {
  /*
   * המספרים האלה הם העוגן: אם הקטלוג זז והבחירה הזו הופכת למשתלמת,
   * הבדיקה תיפול ותאלץ לבחור סכום אחר, ולא תעבור בשקט.
   */
  const s = computeSaving(PACKAGES, "cellular", 1, 30);
  assert.ok(s.pick, "נמצאה חבילה — זה התרחיש שהבדיקה בודקת");
  assert.equal(String(s.pick.id), "121");
  assert.equal(s.worthwhile, false, "₪30 הפך למשתלם — יש לבחור סכום אחר לעוגן");

  assert.match(
    calcSrc,
    /packageName=\{\s*worthwhile \?/,
    "`packageName` נחתם על `saving.pick` ולא על `worthwhile`",
  );
});

test("עם חיסכון — העמודה כן נחתמת", () => {
  const s = computeSaving(PACKAGES, "cellular", 1, 200);
  assert.equal(s.worthwhile, true);
  assert.equal(String(s.pick.id), "121");
});

test("שם החבילה לא נעלם — ההערה לנציג ממשיכה למסור אותו בכל ענף", () => {
  assert.match(
    calcSrc,
    /saving\.pick && pickTarget/,
    "ההקשר נשמר בהערה גם כשמפתח הסינון אינו נחתם",
  );
});

test("`LeadForm` מגדר את שני הצדדים — אין מפריד תלוי", () => {
  const src = readFileSync("src/app/lp/ui/LeadForm.tsx", "utf8");
  assert.ok(
    !/value=\{title \? `\$\{title\} · \$\{provider\}` : provider\}/.test(src),
    "ספק ריק כותב `\"<שם> · \"` לתוך עמודה ייעודית",
  );
  assert.match(src, /\[title, provider\]\.filter\(Boolean\)\.join\(" · "\)/);

  const html = renderToStaticMarkup(
    React.createElement(LeadForm, {
      compact: true,
      pkg: { id: "157", name: "טריפל פלוס 149", provider: "סלקום", slug: null },
    }),
  );
  const field = /name="packageName" value="([^"]*)"/.exec(html);
  assert.ok(field, "השדה לא רונדר");
  assert.ok(
    !/ · $/.test(field[1]),
    `מפריד תלוי נכתב לעמודה: "${field[1]}"`,
  );
  assert.equal(field[1], "טריפל פלוס 149");
});

test("הכחשת הרשומה גוברת על התוספת — `phoneMissing` נבדק ראשון", () => {
  for (const re of [
    /\{phoneDisclosure\s*\?\s*phoneMissing/,
    /phoneDisclosure\s*\?\s*phoneMissing\s*\?\s*"החבילה היא אינטרנט וטלוויזיה — אינה כוללת קו טלפון/,
  ]) {
    assert.match(calcSrc, re, "ענף התוספת עדיין קודם להכחשה");
  }
});
