import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  flatMonthlyFeeNotInPrice,
  isComparable,
  routerPricedSeparately,
} from "../src/app/lp/catalog/savings.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

/*
 * סבב 64, `savings.ts`. `FLAT_MONTHLY_FEE` נכתב בשביל "חיוב חודשי
 * שהמחיר אינו מכיל, בלי סמן לקו" והכיר ניסוח אחד (`עלות חודשית`).
 * הניסוח השכן — סכום שהרשומה עצמה מכנה תוספת **על** מחיר התוכנית —
 * חי בקטלוג בחמש רשומות ולא נקרא. הדפוס החוזר של הקובץ.
 */

/** חמש הרשומות שכותבות את ההצהרה מילה במילה. */
const FIVE = ["92", "102", "107", "108", "109"];

test("סבב 64: תוספת חודשית מוצהרת 'בנוסף לעלות התוכנית' נקראת על ידי השער", () => {
  for (const id of FIVE) {
    const p = byId(id);
    assert.match(
      `${p.description ?? ""}`,
      /על סך 4\.9 ₪ לחודש בנוסף לעלות התוכנית/,
      `id ${id}: הנוסח שהבדיקה מקבעת אינו בנתון`,
    );
    assert.equal(
      flatMonthlyFeeNotInPrice(p),
      true,
      `id ${id}: הרשומה מצהירה על ₪4.90 בחודש מעל המחיר והשער אינו קורא אותה`,
    );
  }
});

test("סבב 64: החלופה החדשה אינה נדלקת על אף רשומה אחרת", () => {
  /*
   * ⚠️ `בנוסף ל<עלות|מחיר>` ולא "בנוסף" לבדה. הרשומה אומרת במפורש
   * שזה סכום מעל החשבון, ולכן הוא אינו יכול להיות מחיר התוכנית
   * עצמה — זה ההבדל מ-`דמי שימוש`/`תשלום חודשי` של ids 23/27,
   * שההסתייגות בקובץ מנמקת למה לא הורחבו.
   */
  const lit = P.filter((p) => flatMonthlyFeeNotInPrice(p)).map((p) => String(p.id)).sort();
  assert.deepEqual(
    lit,
    [...FIVE, "53"].sort(),
    "השער נדלק על רשומה שאינה אחת מחמש החדשות או id 53 הוותיקה",
  );
  for (const id of ["23", "27"]) {
    assert.equal(
      flatMonthlyFeeNotInPrice(byId(id)),
      false,
      `id ${id}: 'דמי השימוש הקבועים' הוא המחיר שאחרי ההטבה, לא תוספת עליו`,
    );
  }
});

test("סבב 64: הסכום שנקרא אינו מחיר החבילה עצמה", () => {
  for (const id of FIVE) {
    const p = byId(id);
    assert.notEqual(4.9, p.price, `id ${id}: הסכום שווה למחיר — השער היה אומר דבר שאינו נכון`);
    assert.notEqual(4.9, p.priceAfterPromo, `id ${id}: הסכום שווה למחיר שאחרי ההטבה`);
  }
});

test("סבב 64: הבריכה והבחירה אינן זזות — חמשתן נפסלו ממילא", () => {
  /*
   * ⚠️ חמש הרשומות מוחזקות מחוץ לבריכה גם דרך `routerPricedSeparately`,
   * כלומר דרך המילה "נתב" ובענף הבית. זה מה שהפך את השער החסר לרדום
   * ולא לכותרת שגויה — ולכן התיקון הוא שער לרענון הבא, באפס תזוזה.
   */
  for (const id of FIVE) {
    const p = byId(id);
    assert.equal(routerPricedSeparately(p), true, `id ${id}: גם שער הנתב פוסל אותה`);
    assert.equal(isComparable(p, "home"), false, `id ${id}: אינה בבריכת ההשוואה`);
  }

  const pool = (track) => P.filter((p) => isComparable(p, track)).map((p) => String(p.id)).sort();
  assert.deepEqual(
    pool("cellular"),
    ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"].sort(),
    "בריכת הסלולר זזה",
  );
  assert.deepEqual(pool("home"), ["157", "3"].sort(), "בריכת הבית זזה");

  /* והבחירה בכל מסלול וכמות — המספר שבאמת מגיע לכותרת. */
  for (const [track, units, id, monthly] of [
    ["cellular", 1, "121", 266],
    ["cellular", 2, "117", 240],
    ["cellular", 3, "117", 210],
    ["home", 1, "157", 151],
    /* ⚠️ הבית שטוח: ₪149 אינו מוכפל בכמות, ולכן אותו חיסכון בכל כמות. */
    ["home", 3, "157", 151],
  ]) {
    const s = computeSaving(P, track, units, 300);
    assert.equal(String(s.pick?.id), id, `${track}/${units}: החבילה שנבחרה זזה`);
    assert.equal(s.monthly, monthly, `${track}/${units}: החיסכון החודשי זז`);
  }
});
