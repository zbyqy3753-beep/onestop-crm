import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  afterPriceDependsOnLines,
  computeSaving,
  declaresRiseInText,
  isComparable,
  requiresMultipleLines,
} from "../src/app/lp/catalog/savings.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
/** רשומה נקייה שאפשר להזריק לתוכה משפט אחד ולבדוק שער בבידוד. */
const withProse = (desc, extra = {}) => ({
  ...byId(121),
  id: "TEST",
  name: "בדיקה",
  description: desc,
  benefits: null,
  priceAfterPromoNote: null,
  ...extra,
});

/*
 * סבב 56, `savings.ts`. שני שערים שהכירו הצהרה בצורה אחת ופספסו את
 * הצורה השכנה — אותו דפוס שהקובץ הזה מתעד בעשרה מקומות:
 *
 *   1. שלושת אחיו של `הנחה ל-N` מתארים את המחיר ש**נשאר** ("מובטח
 *      ל-12 חודשים"), והנוסח השכן מתאר את ההנחה ש**נגמרת**. ב-
 *      `RISE_IN_TEXT` לא היה אף טוקן של `הנחה`.
 *   2. `PRICED_BY_LINE_COUNT` דרש שהכמות תבוא מיד אחרי הטריגר ובלי
 *      למ"ד, ולכן `להצטרפות משפחתית לשלושה קווים` נפל בין שני שערי
 *      הכמות.
 *
 * שתי הרשומות החיות שנושאות את הנוסחים האלה נפסלות היום דרך שכנים
 * מקריים בלבד, ולכן אף מספר על המסך אינו זז — ראה הבדיקה האחרונה.
 */

test("סבב 56: `הנחה ל-N חודשים` היא הצהרת עלייה, כמו `מובטח ל-N חודשים`", () => {
  // שני חצאי העובדה של id 124, בשתי שורות סמוכות בתיאור שלה:
  // ההנחה שנגמרת ומחיר החבילה שמתחתיה.
  const p = byId(124);
  assert.match(String(p.description ?? ""), /הנחה\s*ל12\s*חודשים/);
  assert.match(String(p.description ?? ""), /מחיר\s*חבילה\s*245/);
  assert.equal(p.price, 235);
  assert.equal(p.priceAfterPromo, null);

  // הנוסח בבידוד — לפני התיקון הוחזר false בזמן שאחיו הוחזרו true.
  assert.equal(declaresRiseInText(withProse("10 ש''ח הנחה ל12 חודשים")), true);
  assert.equal(declaresRiseInText(withProse("הנחה לשנה")), true);
  assert.equal(declaresRiseInText(withProse("הנחה לשנתיים")), true);
  // האח שתמיד עבד, כעוגן.
  assert.equal(declaresRiseInText(withProse("מחיר מובטח ל-12 חודשים")), true);
});

test("והצורה הרחבה נשארת מחוץ לשער במכוון", () => {
  /*
   * `הנחה[^.•\n]{0,20}ל` הייתה תופסת גם כמות שאינה חודשים — והשער
   * הזה מאכיל את `promoRise`, שמדפיס שבב `period` על הכרטיס. כלומר
   * הרחבה כזו מדפיסה הצהרת עלייה על מסלול שאינו עולה.
   */
  assert.equal(declaresRiseInText(withProse("הנחה של 7% ל-4 שעות ביום")), false);
  assert.equal(declaresRiseInText(withProse("הנחה של 10 ₪ ל-12 חודשים")), false);
  // ו-`הנחה` בלי כמות אינה הצהרה על דבר.
  assert.equal(declaresRiseInText(withProse("חבילה עם הנחה למצטרפים חדשים")), false);
});

test("סבב 56: תואר ולמ\"ד בין הטריגר לכמות אינם מבטלים מחיר שמותנה בכמות", () => {
  // id 16 כותבת את המחיר לשלושה קווים במשפט שהשער פספס.
  const p = byId(16);
  assert.match(String(p.description ?? ""), /להצטרפות\s+משפחתית\s+לשלושה\s+קווים/);

  // שלוש הצורות — התואר, הלמ"ד, ושתיהן יחד — נתפסות כעת.
  const dep = (s) => afterPriceDependsOnLines(withProse(s, { priceAfterPromo: 99 }));
  assert.equal(dep("95 ₪ לחודש להצטרפות משפחתית לשלושה קווים"), true);
  assert.equal(dep("95 ₪ לחודש להצטרפות לשלושה קווים"), true);
  // הנוסחים השכנים שתמיד עבדו, כעוגן.
  assert.equal(dep("95 ₪ לחודש להצטרפות 3 קווים"), true);
  assert.equal(dep("95 ₪ לחודש בהצטרפות שלושה קווים"), true);
});

test("ואותה צורה שכנה גם בשער התאום", () => {
  // `REQUIRES_MULTIPLE_LINES` מחזיק את אותה **צורה** עם אוצר טריגרים
  // אחר (`לרוכשים`), והוא קיבל את התיקון יחד איתו.
  assert.equal(requiresMultipleLines(withProse("130 לרוכשים משפחתית לארבעה מנויים")), true);
  assert.equal(requiresMultipleLines(withProse("130 לרוכשים 4 מנויים")), true);
});

test("סבב 56: הבריכה והבחירות לא זזו — אפס שינוי במספר המוצג", () => {
  /*
   * ⚠️ שני התיקונים מכוונים לרשומה ה**באה** ולא לנתון של היום: id 124
   * נפסלת דרך `+3 חודשים ראשונים ב59 שח` ודרך `routerPricedSeparately`,
   * ו-id 16 נשמרת דרך שמה שנושא מספר. אומת שסטי שלושת השערים על כל
   * 109 הרשומות זהים לפני ואחרי התיקון; הבדיקה הזו מקבעת את התוצאה.
   */
  const pool = (track) =>
    P.filter((p) => isComparable(p, track))
      .map((p) => String(p.id))
      .sort()
      .join(",");
  assert.equal(pool("cellular"), "116,117,121,25,30,35,65,66,90,91,93");
  assert.equal(pool("home"), "157,3");

  const pick = (track, lines, spend) => {
    const s = computeSaving(P, track, lines, spend);
    return `${s.pick ? s.pick.id : "null"}/${s.monthly}/${s.yearly}/${s.worthwhile}`;
  };
  assert.equal(pick("cellular", 1, 100), "121/66/792/true");
  assert.equal(pick("cellular", 1, 300), "121/266/3192/true");
  assert.equal(pick("cellular", 2, 300), "117/240/2880/true");
  assert.equal(pick("cellular", 3, 500), "117/410/4920/true");
  assert.equal(pick("home", 1, 300), "157/151/1812/true");
  assert.equal(pick("home", 1, 100), "157/-49/-588/false");
  assert.equal(pick("home", 3, 500), "157/351/4212/true");
});
