import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * ⚠️ אותו stub שבראש `tools/lpBrowse.test.mjs` — `LeadForm` מייבא
 * `../actions`, מודול `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { LeadForm } = await import("../src/app/lp/ui/LeadForm.tsx");
const { basePackages, listable } = await import("../src/app/lp/catalog/catalog.ts");
const { computeSaving, phoneLineCostsExtra } = await import("../src/app/lp/catalog/savings.ts");

/*
 * ⚠️ סבב 44 — שתי אמירות שהמסך נתן והמשטח שמתחתיו לא קיים:
 *
 *   • תיבת ההסכמה אומרת "אלירן קליין מאלירן תקשורת יצור איתי קשר",
 *     ולחיצה אחת אחר כך האישור הכריז "נציג ONE STOP יחזור אליך" —
 *     גוף משפטי אחר מזה שהגולש אישר. הכלל של בעל המערכת כתוב
 *     ב-`page.tsx` ומצהיר שההסכמה היא לפנייה של אלירן.
 *   • ההסתייגות על קו הטלפון מבטיחה ש"הנציג יתמחר אותו בנפרד",
 *     וההערה לנציג — כל מה שהוא רואה — לא אמרה על כך דבר.
 */

const leadFormSrc = readFileSync("src/app/lp/ui/LeadForm.tsx", "utf8");
const calcSrc = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");
const browseSrc = readFileSync("src/app/lp/ui/CatalogBrowser.tsx", "utf8");

const live = listable(basePackages());

test("lead: ההסכמה והאישור מדברים על אותו גוף", () => {
  const consent = /אני מאשר\/ת ש(\S+ \S+) מאלירן תקשורת/.exec(leadFormSrc);
  assert.ok(consent, "תיבת ההסכמה נוקבת בשם");
  assert.equal(consent[1], "אלירן קליין");
  // ⚠️ הפאנל שמוצג אחרי השליחה — לא עוד "נציג ONE STOP".
  assert.match(leadFormSrc, /קיבלנו! אלירן יחזור אליך בהקדם\./);
});

test("lead: פאנל האישור המרונדר אינו מזכיר ONE STOP", () => {
  /*
   * ⚠️ מרונדר ולא נקרא מהמקור: `LeadForm` מחזיק שתי מחרוזות
   * "יחזור אליך" בשני ענפים שונים, וזו שהגולש רואה אחרי השליחה
   * היא זו שבתוך `state.status === "sent"`.
   */
  const html = renderToStaticMarkup(
    React.createElement(LeadForm, { compact: true, sentSubject: "לגבי החבילה המשתלמת עבורך" }),
  );
  // הטופס עצמו (לפני שליחה) נושא את תיבת ההסכמה בשם אלירן.
  assert.match(html, /אלירן קליין מאלירן תקשורת/);
  assert.ok(!html.includes("ONE STOP"), "אין ONE STOP בטופס שהגולש מאשר בו");
});

test("lead: ONE STOP נשאר במקומות שמזהים את הגוף המשפטי", () => {
  /*
   * ⚠️ הכלל הוא ש-ONE STOP נשאר בגילוי הנאות ובשאלות — ולכן זה
   * אינו "חיפוש והחלפה" גורף. המבחן מקבע את שני הצדדים.
   */
  assert.match(readFileSync("src/app/lp/ui/SiteFooter.tsx", "utf8"), /ONE STOP הוא משווק מורשה/);
  assert.match(readFileSync("src/app/lp/ui/Faq.tsx", "utf8"), /ONE STOP מקבלת עמלה/);
});

test("calc: ההערה לנציג נושאת את ההסתייגות על קו הטלפון", () => {
  /*
   * ⚠️ אותה אמירה בשני המשטחים — וזה בדיוק מה שלא היה נכון.
   *
   * ההערה שכאן הצהירה ש"ההסתייגות על המסך מותנית ב-
   * `phoneLineCostsExtra(saving.pick)`, וההערה חייבת להיות מותנית
   * באותו ביטוי בדיוק" — אבל המסך הוסיף זרוע שנייה בסבב 43
   * (`hasPhone !== true ||`), וההערה נשארה על הזרוע האחת. כלומר
   * שני המשטחים כבר התיישנו בנפרד, בדיוק כפי שההערה הזהירה.
   * אומת: id 3 (`STING פייבר`, בלי קו טלפון ובלי הצהרת תוספת)
   * הדליק את ההצהרה על המסך בזמן שההערה לנציג שתקה.
   *
   * סבב 45 חילץ נגזרת אחת (`phoneDisclosure`) ששני המשטחים קוראים,
   * ולכן זה הביטוי שמקובע כאן. הנוסח נפרד לשני המצבים, כי "קו
   * בתוספת" ו"אין קו בחבילה" הן שתי עובדות שונות לנציג.
   */
  assert.match(calcSrc, /הנציג יתמחר אותו בנפרד/);
  assert.match(calcSrc, /const phoneDisclosure =/);
  // ההערה לנציג נתלית בנגזרת המשותפת, לא בתנאי צר משלה.
  assert.match(calcSrc, /phoneDisclosure\s*\n?\s*\? phoneExtra/);
  assert.match(calcSrc, /קו טלפון בתוספת לפי הרשומה; לתמחר בנפרד/);
  assert.match(calcSrc, /אינה כוללת קו טלפון; לתמחר בנפרד/);
});

test("calc: הבחירה הביתית היא זו שההסתייגות חלה עליה, בכל סכום", () => {
  /*
   * ⚠️ id 157 מצהירה "קו ביתי כלול בתוכנית עם 1000 דקות בתוספת
   * 20 ש״ח", והיא הבחירה בכל מקרה ביתי (הבריכה היא {157, 3}
   * ו-`units` נעוץ ב-1 במסלול הבית). כלומר ההערה החדשה מופיעה
   * בכל ליד ביתי שיוצא מהמחשבון — וזה ה-₪240 בשנה שהנציג צריך
   * לתמחר.
   */
  for (const spend of [150, 220, 350, 500, 1000]) {
    const s = computeSaving(live, "home", 1, spend);
    assert.equal(String(s.pick.id), "157", `spend ${spend}`);
    assert.equal(phoneLineCostsExtra(s.pick), true, `spend ${spend}`);
  }
});

test("browse: מסנן 'חברה' נפרס רק כשיש ממה לבחור", () => {
  /*
   * ⚠️ `> 1` ולא `> 0` — אותה הגדרה כמו שבב הסוג שמתחתיו. בעמודי
   * ספק יש תמיד אפשרות אחת, ולכן התיבה היחידה לא יכלה לסנן דבר.
   */
  assert.match(browseSrc, /\(providerOptions\.length > 1 \|\| selectedProviders\.length > 0\)/);
  assert.match(browseSrc, /\(typeOptions\.length > 1 \|\| selectedTypes\.length > 0\)/);
});
