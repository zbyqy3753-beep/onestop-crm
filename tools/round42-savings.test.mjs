import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  afterPriceDependsOnLines,
  computeSaving,
  isComparable,
  requiresMultipleLines,
  tierCapsAt,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 42 — אותה הצהרה, נוסח שכן. ארבעה שערים הכירו צורה
 * אחת של הצהרה ופיספסו את השכנה:
 *
 *   • "ואילך" — הנוסח החי של id 42 ("לרוכשים 3 מנויים ואילך") —
 *     בזמן ש-"ומעלה" ו-"ויותר" כן נתפסו.
 *   • שתי היחידות — "מנויים" מול "קווים" — שהקטלוג מנסח בשתיהן,
 *     בזמן שכל חלופה הכירה אחת בלבד.
 *   • "מנוי אחד" ב-`tierCapsAt`, שהכיר רק "קו אחד".
 *   • טווח מוצהר ("2-3 מנויים") שנקרא כ"אינו תקרה" — ולכן המדרגה
 *     הוחלה גם מעל הטווח שהרשומה הצהירה, בזמן שהאריח לידה
 *     מדפיס "2–3 קווים".
 *
 * כל השינויים בכיוון השמרני (בריכה קטנה, מחיר גבוה יותר), והמבחן
 * האחרון כאן מקבע שהבריכה והבחירות לא זזו בפועל.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));

/** רשומה סלולרית מלאה שעוברת היום את כל השערים, עם טקסט מוחלף. */
const withText = (text, over = {}) => ({ ...byId("121"), id: "t", description: text, ...over });

test("סבב 42: שתי היחידות נקראות ב-requiresMultipleLines", () => {
  for (const text of [
    "לרוכשים 2 מנויים",
    "לרוכשים 2 קווים",
    "קו שני",
    "מנוי שני",
    "3 קווים ב 99",
    "3 מנויים ב 99",
  ]) {
    assert.equal(requiresMultipleLines(withText(text)), true, text);
  }
});

test("סבב 42: ואילך הוא אותה הצהרה כמו ומעלה", () => {
  // שלושת הנוסחים שהקטלוג נושא בפועל, עם `priceAfterPromo` כדי
  // ש-`afterPriceDependsOnLines` תגיע לבדיקת הנוסח.
  for (const unit of ["מנויים", "קווים"]) {
    for (const tail of ["ומעלה", "ויותר", "ואילך"]) {
      const p = withText(`לרוכשים 3 ${unit} ${tail} 29 ₪`, { priceAfterPromo: 49 });
      assert.equal(afterPriceDependsOnLines(p), true, `${unit} ${tail}`);
      assert.equal(isComparable(p, "cellular"), false, `${unit} ${tail}`);
    }
  }
});

test("סבב 42: tierCapsAt מכיר מנוי אחד ולא רק קו אחד", () => {
  assert.equal(tierCapsAt(withText("עד קו אחד 30 ₪ לקו"), 1), true);
  assert.equal(tierCapsAt(withText("עד מנוי אחד 30 ₪ למנוי"), 1), true);
  // ו"ואילך" גובר על "עד", כמו "ומעלה".
  assert.equal(tierCapsAt(withText("עד 3 מנויים ואילך 30 ₪"), 3), false);
});

test("סבב 42: טווח מוצהר הוא תקרה, כמו שהאריח מדפיס אותו", () => {
  // הניסוח של id 57 במלואו.
  const p = withText("למצרפים 2-3 מנויים – 33 ₪ למשך שנה");
  assert.equal(tierCapsAt(p, 3), true, "העליונה בטווח היא תקרה");
  // ומחוץ לטווח המדרגה אינה מוצהרת בכלל.
  assert.equal(tierCapsAt(p, 5), false);
});

test("סבב 42: הבריכה והבחירות לא זזו מההרחבות", () => {
  const pool = (track) =>
    live.filter((p) => isComparable(p, track)).map((p) => String(p.id)).sort();
  assert.deepEqual(pool("cellular"), ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"]);
  assert.deepEqual(pool("home"), ["157", "3"]);

  // הבחירה בכל מסלול וכמות, בדיוק כפי שנמדדה לפני הסבב.
  for (const lines of [1, 2, 3, 5, 10]) {
    const cell = computeSaving(live, "cellular", lines, 200);
    assert.equal(String(cell.pick.id), lines === 1 ? "121" : "117", `cellular L${lines}`);
    const home = computeSaving(live, "home", lines, 200);
    assert.equal(String(home.pick.id), "157", `home L${lines}`);
  }
});
