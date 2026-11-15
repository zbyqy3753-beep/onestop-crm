import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { MAX_SPEND, computeSaving, isComparable, perLinePrice } from "../src/app/lp/catalog/savings.ts";

const SRC = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");
/** הקוד בלי ההערות — כדי שנימוק בעברית לא ייחשב כנוסח שעל המסך. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const FORM = readFileSync("src/app/lp/ui/LeadForm.tsx", "utf8");

const P = basePackages();

/*
 * סבב 57. הכותרת ה-sr-only של שלב 3 היא יעד הפוקוס של השלב, והיא
 * הנשאה את הסתייגות התקרה בשני ענפים מתוך שלושה. הפסקה הנראית
 * מתחתיה כן נושאת אותה מחוץ לשלושת הענפים — זו האי-סימטריה שההערה
 * על הפסקה מתעדת כמתוקנת, ושלא הוחלה על הכותרת.
 */

test("סבב 57: הסתייגות התקרה מחוץ לשלושת ענפי הכותרת", () => {
  const start = CODE.indexOf("ref={headingRef} tabIndex={-1} className=\"sr-only");
  const heading = CODE.slice(start, CODE.indexOf("</h3>", start));
  assert.ok(heading.includes("overCap"), "ההסתייגות נעלמה מהכותרת");
  // ההסתייגות מופיעה פעם אחת, מחוץ לשלשה — ולא משורשרת בתוך ענף.
  assert.equal(
    (heading.match(/overCap/g) ?? []).length,
    1,
    "ההסתייגות חזרה להיות משורשרת בתוך ענף",
  );
  // שלושת הענפים עצמם נקיים ממנה.
  for (const branch of ["אפשר לחסוך עד", "לא נמצאה בקטלוג חבילה", "לא נמצא חיסכון בתשלום החודשי"]) {
    const i = heading.indexOf(branch);
    assert.ok(i > 0, `הענף "${branch}" נעלם`);
  }
  // והנוסח מפוצל כמו בפסקה הנראית: `noMatch` אינו מחשב דבר.
  assert.match(heading, /המחשבון עוצר בתקרה של/);
  assert.match(heading, /לפי תקרת המחשבון/);
});

test("סבב 57: הענף השלישי עם תקרה הוא שער ולא מצב חי", () => {
  /*
   * `overCap` גורר `monthlySpend === MAX_SPEND`, והעלות הגבוהה ביותר
   * בבריכה רחוקה מתחתיו — ולכן אין מצב חי של `pick && !worthwhile`
   * עם תקרה. הבדיקה מתעדת שזו הסיבה שהתיקון רדום, לא שהוא מיותר.
   */
  let worstCost = 0;
  for (const track of ["cellular", "home"]) {
    for (const p of P.filter((x) => isComparable(x, track))) {
      for (let n = 1; n <= 10; n += 1) worstCost = Math.max(worstCost, perLinePrice(p, n) * n);
    }
  }
  assert.ok(worstCost < MAX_SPEND, `העלות הגבוהה בבריכה (${worstCost}) עברה את התקרה`);
  for (const track of ["cellular", "home"]) {
    for (let n = 1; n <= 10; n += 1) {
      const s = computeSaving(P, track, n, MAX_SPEND);
      assert.ok(s.pick && s.worthwhile, `${track}/${n}: נפתח ענף שלישי עם תקרה`);
    }
  }
});

test("סבב 57: הטופס אינו מצהיר שההסכמה נשמרת", () => {
  // אין ל-`consent` עמודה, והוא אינו נכנס ל-`note`.
  assert.ok(!/consent/i.test(readFileSync("prisma/schema.prisma", "utf8")));
  assert.ok(
    !/ההסכמה נאכפת בשרת ונשמרת/.test(FORM),
    "ההערה חזרה להצהיר שההסכמה נשמרת",
  );
  assert.match(FORM, /אינה נשמרת/);
});
