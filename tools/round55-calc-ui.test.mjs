import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { isComparable } from "../src/app/lp/catalog/savings.ts";

/*
 * סבב 55, המחשבון. אותו שיקול של `round47/51-calc-ui`: מצב האשף חי
 * ב-`useState` בתוך `"use client"`, ולכן האמירות נבדקות על **המקור**.
 */
const SRC = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const P = basePackages();
const byId = (id) => P.find((p) => String(p.id) === String(id));

/*
 * גילוי הציוד הוא `OR` על שני שדות נפרדים, והנוסח נקב בשניהם בלי קשר
 * לזה שנדלק — בזמן ש-`phoneDisclosure`, שורה מתחתיו, מחזיק שני
 * נוסחים ומנמק את הפיצול ("מחרוזת אחת לשתי עובדות היא הכחשה של עובדה
 * שהרשומה מסרה").
 */

test("סבב 55: לגילוי הציוד שלושה נוסחים, אחד לכל שדה", () => {
  assert.match(CODE, /equipConverter && equipExtender/);
  assert.match(CODE, /"ממיר נוסף מעל זה שכלול, ומגדיל טווח, הם תוספת חודשית/);
  assert.match(CODE, /"ממיר נוסף מעל זה שכלול הוא תוספת חודשית/);
  assert.match(CODE, /"מגדיל טווח הוא תוספת חודשית/);
  // ואותם שלושה בהערה לנציג.
  assert.match(CODE, /"ממיר נוסף בתוספת חודשית לפי הרשומה; לתמחר בנפרד"/);
  assert.match(CODE, /"מגדיל טווח בתוספת חודשית לפי הרשומה; לתמחר בנפרד"/);
});

test("והראיה: תשע רשומות בית נושאות מגדיל טווח בלבד ואינן מזכירות ממיר", () => {
  const extenderOnly = P.filter(
    (p) =>
      p.category === "home" &&
      p.spec &&
      typeof p.spec.extraExtenderCost === "number" &&
      p.spec.extraConverterCost == null,
  );
  assert.equal(extenderOnly.length, 9);
  // id 153 היא הקרובה לבריכה מביניהן — `declaresRiseInText` לבדו
  // מחזיק אותה בחוץ (ההכרעה הפתוחה של סבב 45).
  const p153 = byId(153);
  assert.equal(p153.spec.extraConverterCost, null);
  assert.equal(p153.spec.extraExtenderCost, 11.9);
  assert.equal(isComparable(p153, "home"), false);
});

test("ושתי רשומות בריכת הבית נושאות את שדה הממיר בלבד — התוספת למגדיל היא פרוזה", () => {
  for (const id of [157, 3]) {
    const p = byId(id);
    assert.equal(isComparable(p, "home"), true);
    assert.equal(p.spec.extraConverterCost, 15);
    // ⚠️ ההערה בקוד הצהירה ש-157 נושאת גם ₪14.90 בשדה. היא `null`.
    assert.equal(p.spec.extraExtenderCost, null);
    assert.match(String(p.description ?? ""), /מגדיל טווח/);
  }
});
