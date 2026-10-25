import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  afterPriceDependsOnLines,
  computeSaving,
  declaresRiseInText,
  isComparable,
  phoneLineCostsExtra,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 43 — שלושה ממצאים במנוע, כולם מאותה משפחה: שער שמכיר
 * הצהרה בצורה אחת ומפספס את השכנה.
 *
 *   • צורת ה**מילה** של התחייבות לתקופה ("תקף לשנה") מול צורת
 *     ה**ספרה** ("תקף ל 24 חודשים"), בזמן ש-`למשך` קיבל את שתיהן.
 *   • `מנויים כולל` בלי `קווים כולל` — החלופה הראשונה הפרה את
 *     הכלל ששתי השורות מעליה מצהירות.
 *   • `hasPhone: true` שנקרא כ"הקו כלול בלי עלות", בזמן
 *     שהרשומה אומרת "בתוספת 20 ש״ח".
 *
 * שני הראשונים בכיוון השמרני (בריכה קטנה או שווה), השלישי מוסיף
 * גילוי ואינו נוגע בחשבון. המבחן האחרון מקבע שהבריכה והבחירות
 * לא זזו בפועל.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));
const withText = (text, over = {}) => ({
  ...byId("121"),
  id: "t",
  name: "t",
  rawName: "t",
  description: text,
  benefits: null,
  priceAfterPromoNote: null,
  ...over,
});

test("סבב 43: התחייבות לתקופה נקראת גם במילה וגם בספרה", () => {
  for (const verb of ["מובטח", "תקף", "קבוע"]) {
    for (const period of ["24 חודשים", "שנה", "שנתיים"]) {
      assert.equal(
        declaresRiseInText(withText(`${verb} ל${period}`)),
        true,
        `${verb} ל${period}`,
      );
    }
  }
});

test("סבב 43: הנוסח המילולי חי בקטלוג — id 91 כותבת 'תקף לשנה'", () => {
  const p91 = byId("91");
  assert.match(p91.description ?? "", /תקף לשנה/);
  // ⚠️ והיא נושאת `priceAfterPromo`, ולכן השער אינו נקרא עליה
  // ב-`isComparable` והבריכה אינה משתנה. זה השער לרענון הבא.
  assert.equal(p91.priceAfterPromo, 57.9);
});

test("סבב 43: רשומה שמצהירה על התקופה במילה בלבד נפסלת מהבריכה", () => {
  const worded = withText("גלישה 150GB תקף לשנה", { priceAfterPromo: null });
  assert.equal(declaresRiseInText(worded), true);
  assert.equal(isComparable(worded, "cellular"), false);
});

test("סבב 43: שתי היחידות נקראות ב'כולל' כמו בכל חלופה אחרת", () => {
  for (const unit of ["מנויים", "קווים"]) {
    const p = withText(`עד 2 ${unit} כולל - 39.9 ₪ ל${unit === "מנויים" ? "מנוי" : "קו"}`, {
      priceAfterPromo: 49,
    });
    assert.equal(afterPriceDependsOnLines(p), true, unit);
    assert.equal(isComparable(p, "cellular"), false, unit);
  }
});

test("סבב 43: הקו הביתי של id 157 מוצהר בתוספת, ולכן ההסתייגות מוצגת", () => {
  const p157 = byId("157");
  assert.equal(p157.spec.hasPhone, true, "הרשומה מצהירה שהקו כלול");
  assert.match(p157.description ?? "", /בתוספת 20 ש"ח/);
  // ⚠️ זה בדיוק הפער: `hasPhone: true` אינו "בלי עלות".
  assert.equal(phoneLineCostsExtra(p157), true);
});

test("סבב 43: phoneLineCostsExtra עוגן בסכום כספי ולא במספר לבדו", () => {
  // הנוסח של ids 92/102/107/108/109 — "בתוספת" שייך לדקות, והכסף
  // מגיע מ-"עלות קו ביתי 20 ש״ח".
  assert.equal(phoneLineCostsExtra(withText('עלות קו ביתי 20 ש"ח בתוספת 1000 דקות')), true);
  // קו שכלול בתוספת דקות בלבד, בלי כסף — אין הצהרת עלות.
  assert.equal(phoneLineCostsExtra(withText("קו ביתי כלול בתוספת 1000 דקות")), false);
  assert.equal(phoneLineCostsExtra(withText("קו ביתי כלול במחיר")), false);
});

test("סבב 43: השער אינו פוסל את id 157 מהבריכה — הקו הוא תוספת אופציונלית", () => {
  assert.equal(isComparable(byId("157"), "home"), true);
});

test("סבב 43: הבריכה והבחירות לא זזו", () => {
  assert.deepEqual(
    live.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id)).sort(),
    ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"],
  );
  assert.deepEqual(
    live.filter((p) => isComparable(p, "home")).map((p) => String(p.id)).sort(),
    ["157", "3"],
  );
  const cell1 = computeSaving(live, "cellular", 1, 220);
  assert.equal(String(cell1.pick.id), "121");
  assert.equal(cell1.yearly, 2232);
  const home1 = computeSaving(live, "home", 1, 300);
  assert.equal(String(home1.pick.id), "157");
  assert.equal(home1.yearly, 1812);
});
