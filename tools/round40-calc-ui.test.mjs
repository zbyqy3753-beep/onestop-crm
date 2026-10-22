import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * ⚠️ אותו stub שבראש `tools/lpBrowse.test.mjs` — `LeadForm` מייבא
 * `../actions`, מודול `"use server"` ש-tsx אינו יכול לקמפל, ואף רכיב
 * שנבדק כאן אינו קורא ל-Server Action.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { LeadForm } = await import("../src/app/lp/ui/LeadForm.tsx");
const { SavingsCalculator } = await import("../src/app/lp/ui/SavingsCalculator.tsx");
const { basePackages } = await import("../src/app/lp/catalog/catalog.ts");

/*
 * ⚠️ סבב 40, שכבת הקלט והטופס:
 *   • כפתור השליחה נצבע ב-`opacity-40` — 1.85:1 על הכיתוב "שולח…",
 *     בחלון ה-pending הארוך ביותר בדף (בדיקת כפילות, כתיבה למסד, שתי
 *     התראות). אותו תיקון שה-CTA של המחשבון כבר קיבל במפורש, ושלא
 *     הוחל על הכפתור שבסוף אותו מסלול בדיוק.
 *   • `inputMode="numeric"` חסם באייפון את ה-`+` של `+972` — הצורה
 *     שההערה על `dir="ltr"` באותו שדה טורחת לתמוך בה.
 *   • המחשבון לא העביר `onSent`, ולכן "קיבלנו!" נמחק בלחיצה היחידה
 *     שהמסך מציע אחריו ("לשנות את הנתונים"), והטופס חזר ריק ובלי שום
 *     סימן שפנייה כבר נשלחה — כלומר בקשה שנייה לאותו טלפון.
 */

const leadFormSrc = readFileSync("src/app/lp/ui/LeadForm.tsx", "utf8");
const calcSrc = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");

test("מצב השליחה נצבע בטוקנים ולא ב-`opacity-40`", () => {
  assert.ok(
    !/className=.*opacity-40/.test(leadFormSrc),
    "`opacity-40` מעמעם רקע **וטקסט** — 1.85:1 על הכיתוב `שולח…`",
  );
  assert.ok(
    /pending \? "cursor-not-allowed bg-lp-surface-3 text-lp-ink-2 hover:bg-lp-surface-3"/.test(
      leadFormSrc,
    ),
    "אותו צמד טוקנים שה-CTA של המחשבון משתמש בו (5.4:1)",
  );
});

test("שדה הטלפון מאפשר להקליד את ה-`+` של +972", () => {
  const html = renderToStaticMarkup(React.createElement(LeadForm, { compact: true }));
  assert.ok(html.includes('type="tel"'));
  assert.ok(
    /inputMode="tel"/i.test(html),
    'inputMode="numeric" מציג באייפון מקלדת ספרות בלבד, שאין בה `+`',
  );
  assert.ok(!/inputMode="numeric"/i.test(html));
  // ⚠️ `dir="ltr"` נשאר: בלעדיו ה-`+` המוביל נודד לקצה הימני.
  assert.ok(html.includes('dir="ltr"'));
});

test("המחשבון מחבר `onSent` — אחרת העובדה שנשלחה פנייה נמחקת בשינוי הנתונים", () => {
  assert.ok(
    /onSent=\{\(\) => setSent\(true\)\}/.test(calcSrc),
    "`LeadForm` חושף `onSent` בדיוק בשביל זה, ו-`PackageCard` כבר מחזיק את העובדה",
  );
  assert.ok(calcSrc.includes("לשלוח את הנתונים המעודכנים?"));
  // ⚠️ והטופס **נשאר** זמין: `actions.ts` מצרף פנייה חוזרת בחלון 24
  // שעות לליד הקיים, ולכן מי שתיקן את הסכום דווקא מעדכן את הנציג.
  assert.ok(calcSrc.includes("שליחה נוספת"));
});

test("סכום אבסורדי נפסל ואינו מועבר לנציג כעובדה", () => {
  // שלושת המשטחים שהכריזו עליו: ההודעה, הכפתור, וה-Enter בשדה.
  assert.ok(calcSrc.includes("const absurdSpend = typedSpend > MAX_TYPED_SPEND;"));
  assert.ok(calcSrc.includes("if (monthlySpend <= 0 || absurdSpend) return;"));
  assert.ok(calcSrc.includes("aria-disabled={monthlySpend <= 0 || absurdSpend}"));
  assert.ok(calcSrc.includes("הסכום שהזנתם אינו נראה כחשבון חודשי"));
  // ⚠️ וההודעה קודמת ל-`overCapHint` בשרשרת: סכום אבסורדי הוא גם
  // `overCap`, ובלי הקדימות המסך היה מבטיח עליו "יעבור לנציג".
  assert.ok(calcSrc.indexOf("const spendHint = absurdHint") < calcSrc.indexOf(": overCapHint"));
});

test("המחשבון מרונדר ומכריז על השלב לקורא מסך", () => {
  const html = renderToStaticMarkup(
    React.createElement(SavingsCalculator, { packages: basePackages() }),
  );
  assert.ok(html.includes("שלב 1 מתוך 3"));
  assert.ok(html.includes("על מה תרצו לחסוך?"));
});
