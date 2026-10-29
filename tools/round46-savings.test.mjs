import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  afterPriceDependsOnLines,
  computeSaving,
  isComparable,
  monthlySurchargePerLine,
  priceForExistingCustomers,
} from "../src/app/lp/catalog/savings.ts";

const pkgs = basePackages();
const byId = (id) => pkgs.find((p) => String(p.id) === id);
const base = byId("121");
const withProse = (description, extra = {}) => ({
  ...base,
  description,
  benefits: null,
  priceAfterPromo: 79,
  ...extra,
});

/*
 * ⚠️ סבב 46 — שלושה שערים שהכירו הצהרה בצורה אחת ופספסו את הצורה
 * השכנה, הדפוס החוזר של הקובץ הזה. שלושתם בכיוון ההבטחה: בלעדיהם
 * רשומה זולה-למראה נכנסת לבריכה ומנפחת את הכותרת.
 *
 * אפס תזוזה במספרים של היום — הבריכה, הבחירות וכל ערך שמוצג נמדדו
 * לפני ואחרי והם זהים (ראה הבדיקה האחרונה בקובץ). מה שנסגר הוא
 * הרענון הבא.
 */

test("סבב 46: `ומעל` (בלי ה״א) נקרא כמחירון לפי כמות, כמו שלוש אחיותיה", () => {
  for (const form of ["ויותר", "ומעלה", "ואילך", "ומעל"]) {
    assert.equal(
      afterPriceDependsOnLines(withProse(`למצרפים 4 מנויים ${form} 22 ₪`)),
      true,
      `הצורה ${form}`,
    );
  }
  /*
   * ⚠️ `ומעל` היא הצורה שחיה בקטלוג, ועם שגיאת הכתיב החיה: id 53
   * כותבת "25 ש''ח לחודש ל-2 מנווים ומעל" — מחירון מדורג לצד
   * `priceAfterPromo` יחיד, בדיוק התצורה שהשער נכתב בשבילה.
   * נדרשות **שתי** התוספות (`ומעל` ו-`מנווים`) כדי שהשער יידלק.
   */
  assert.equal(afterPriceDependsOnLines(byId("53")), true);
});

test("סבב 46: חיוב חודשי לקו נקרא גם בניסוחי `עלות`/`בעלות`/`דמי שימוש`", () => {
  // הצורה שכבר נתפסה — id 7 מילה במילה.
  assert.equal(monthlySurchargePerLine(withProse("תשלום חודשי 8 שקלים לרשומה")), true);
  // שלוש הצורות השכנות, שכולן חיות בקטלוג (ids 53, 81/124, 69).
  for (const form of [
    'עלות חודשית של 8 ש"ח לכל קו',
    'בעלות 8 ש"ח לחודש לכל קו',
    'דמי שימוש חודשיים בסך 8 ש"ח לכל קו',
    'דמי שימוש חודשיים: 8 ש"ח לכל קו',
  ]) {
    assert.equal(monthlySurchargePerLine(withProse(form)), true, form);
  }
  // הרשומות החיות שהשער נדלק עליהן לא זזו.
  for (const id of ["7", "10", "11"]) {
    assert.equal(monthlySurchargePerLine(byId(id)), true, `id ${id}`);
  }
});

test("סבב 46: מחיר ללקוחות קיימים נקרא גם ביחידת `מנוי` ובלמ״ד אחת", () => {
  for (const form of [
    "דמי שימוש חודשיים: 24.90 ₪ ללקוחות קיימים",
    "דמי שימוש חודשיים: 24.90 ₪ למנויים קיימים",
    "דמי שימוש חודשיים: 24.90 ₪ למנוי קיים",
    "מחיר לקוחות קיימים: 24.90 ₪",
    "דמי שימוש חודשיים: 24.90 ₪ ללקוחות ממשיכים",
  ]) {
    assert.equal(priceForExistingCustomers(withProse(form)), true, form);
  }
  /*
   * ⚠️ והסמיכות למספר נשמרה: "הטבה ללקוחות קיימים" בלי מחיר אינה
   * הצהרה על המחיר שבכותרת אלא על הטבה נוספת, ופסילה עליה הייתה
   * אומרת על החבילה דבר שאינו נכון עליה.
   */
  assert.equal(priceForExistingCustomers(withProse("הטבה ללקוחות קיימים")), false);
  // id 69 נפסלת היום רק בשער הזה, והצורה החיה שלה נתפסת כמו קודם.
  assert.equal(priceForExistingCustomers(byId("69")), true);
});

/*
 * ⚠️ המספרים שעל המסך — נמדדו לפני השינוי והם המספרים האלה בדיוק.
 * כל תזוזה בבריכה או בבחירה כאן היא רגרסיה, לא שיפור: שלושת השערים
 * שלמעלה נוסחו כך שהצורות החיות בקטלוג נשארות בדיוק כפי שהיו.
 */
test("סבב 46: הבריכה והבחירות לא זזו", () => {
  const cell = pkgs.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id));
  const home = pkgs.filter((p) => isComparable(p, "home")).map((p) => String(p.id));
  assert.deepEqual(cell, ["91", "65", "66", "90", "93", "116", "117", "121", "25", "30", "35"]);
  assert.deepEqual(home, ["157", "3"]);

  const pool = pkgs.filter((p) => isComparable(p, "cellular"));
  assert.equal(String(computeSaving(pool, "cellular", 1, 200).pick.id), "121");
  for (const units of [2, 3, 5, 10]) {
    assert.equal(String(computeSaving(pool, "cellular", units, 200).pick.id), "117");
  }
  const homePool = pkgs.filter((p) => isComparable(p, "home"));
  const h = computeSaving(homePool, "home", 1, 200);
  assert.equal(String(h.pick.id), "157");
  assert.equal(h.monthly, 51);
  assert.equal(h.yearly, 612);
});
