import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  familyPriceOnly,
  isComparable,
  perLinePrice,
  priceUnknownAtLines,
  proseFloorsAt,
} from "../src/app/lp/catalog/savings.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const pool = (track, lines) =>
  P.filter((p) => isComparable(p, track))
    .filter((p) => !priceUnknownAtLines(p, Math.min(lines, 10)))
    .filter((p) => track !== "cellular" || lines >= 2 || !familyPriceOnly(p));

/*
 * סבב 59, `savings.ts`.
 *
 * `proseFloorsAt` היה השער היחיד בקובץ שכתב לעצמו רשימת מטבע ומקף
 * (`(?:₪|ש"ח|שח|ש''ח)` ו-`מ-?`) במקום `SHEKEL`/`[-–־]` המשותפים, וקרא
 * צירוף מקומי של שלושה שדות במקום `gateText`. התוצאה: הוא הכיר צורה
 * אחת מתוך חמש שהקטלוג כותב בפועל, וביניהן דווקא את השדה שבו id 85 —
 * הרשומה שבשבילה השער נכתב — באמת נושא את המשפט.
 *
 * שתי הבדיקות הראשונות נועלות את חמש הצורות; השלישית נועלת את הכיוון
 * ההפוך (`ואילך` כמדרגת צריכה); האחרונות נועלות שהבריכה לא זזה.
 */

const prose = (text, value, field = "description") =>
  proseFloorsAt({ name: "חבילה", [field]: text }, value);

test("סבב 59: רצפה בפרוזה נקראת בכל סדר מטבע ובכל צורת מקף שהקטלוג כותב", () => {
  // הצורה החיה של id 85 — נתפסה גם קודם.
  assert.equal(prose("לאחר מכן מ-100 ₪ לחודש", 100), true);
  // ₪ לפני המספר — 13 מופעים בקטלוג, לא נתפס קודם.
  assert.equal(prose("לאחר מכן מ-₪100 לחודש", 100), true);
  // המילה המלאה — 3 מופעים בקטלוג, לא נתפס קודם.
  assert.equal(prose("לאחר מכן מ-100 שקלים לחודש", 100), true);
  // en-dash ו-maqaf — המקפים ששאר הקובץ מקבל, לא נתפסו קודם.
  assert.equal(prose("לאחר מכן מ–100 ₪ לחודש", 100), true);
  assert.equal(prose("לאחר מכן מ־100 ₪ לחודש", 100), true);
});

test("סבב 59: הרצפה נקראת גם מ-priceAfterPromoNote — השדה שבו id 85 נושא אותה", () => {
  const p85 = byId("85");
  assert.match(
    String(p85.priceAfterPromoNote ?? ""),
    /מ-100/,
    "id 85 אמורה לשאת את משפט הרצפה בהערה",
  );
  assert.equal(prose("לאחר מכן מ-100 ₪ לחודש", 100, "priceAfterPromoNote"), true);
  // והשער עדיין מחייב התאמה לאותו מספר.
  assert.equal(prose("לאחר מכן מ-100 ₪ לחודש", 99, "priceAfterPromoNote"), false);
});

test("סבב 59: `ואילך` היא מדרגת צריכה ולא רצפה — כמו `ומעלה` ו`ויותר`", () => {
  assert.equal(prose("מ-300 ₪ ומעלה", 300), false);
  assert.equal(prose("מ-300 ₪ ויותר", 300), false);
  // זו ההשמטה שתוקנה: קודם הוחזר true, כלומר רשומה בריאה הוצאה מהבריכה.
  assert.equal(prose("מ-300 ₪ ואילך", 300), false);
});

test("סבב 59: `מ` אחרי אות עברית עדיין אינה רצפה", () => {
  // "מחודש 4 99 ש\"ח" — ids 73, 153, 159.
  assert.equal(prose('מחודש 4 99 ש"ח', 99), false);
});

test("סבב 59: רווח קשיח אינו מסתיר הצהרה משערי הנוסח", () => {
  // NBSP בין `תקף` ל-`ל` — הצורה ששברה את `declaresRiseInText`.
  assert.equal(prose("לאחר מכן מ-100 ₪ לחודש", 100), true);
  // והקטלוג אכן נושא NBSP היום.
  const carriers = P.filter((p) =>
    / /.test(
      [p.name, p.logicName, p.description, p.benefits, p.priceAfterPromoNote]
        .filter(Boolean)
        .join(" "),
    ),
  ).map((p) => String(p.id));
  assert.deepEqual(carriers.sort(), ["125", "21"].sort());
});

test("סבב 59: הבריכה והבחירות לא זזו — התיקון הוא שער ולא מספר על המסך", () => {
  // נמדד לפני ואחרי התיקון, בכל מסלול ובכל כמות.
  assert.equal(pool("cellular", 1).length, 10);
  assert.equal(pool("cellular", 2).length, 11);
  assert.equal(pool("home", 1).length, 2);

  assert.equal(String(computeSaving(P, "cellular", 1, 500).pick?.id), "121");
  assert.equal(perLinePrice(byId("121"), 1), 34);
  assert.equal(String(computeSaving(P, "cellular", 2, 500).pick?.id), "117");
  assert.equal(perLinePrice(byId("117"), 2), 29.9);
  assert.equal(String(computeSaving(P, "home", 1, 500).pick?.id), "157");
  assert.equal(perLinePrice(byId("157"), 1), 149);
});
