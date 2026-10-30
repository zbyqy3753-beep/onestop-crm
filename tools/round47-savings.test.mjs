import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { isComparable, routerPricedSeparately } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 47 — אסימומטריית `תוספת` בשער הנתב, והגדר שמנע את ההרחבה
 * מלהיות רחבה מדי:
 *
 *   • `ROUTER_PRICED_SEPARATELY` דרש את ה-ב' של `בתוספת`, בזמן ששני
 *     השערים התאומים — `MONTHLY_SURCHARGE_PER_LINE` ו-`PHONE_LINE_SURCHARGE`
 *     — מאייתים `ב?תוספת` מאותו נימוק בדיוק ("אסימטריה שכבר תוקנה
 *     בשער התאום ולא הוחלה כאן"). ההערות בקובץ מתעדות את שלושת
 *     השערים כתאומים במפורש.
 *
 *   • ההרחבה הוחלה **רק על סדר המילים שבו הציוד מקדים** לתוספת.
 *     בסדר ההפוך (`תוספת … <ציוד>`) המילה "ראוטר" יכולה לשבת
 *     בפסוקית פטור ולא בחיוב עצמו: id 123 כותבת "מגדיל טווח לנחושת
 *     – 4 חודשים חינם, לאחר מכן תוספת של 15 ₪ (למי שלא לקח ראוטר)",
 *     כלומר חיוב על **מגדיל טווח** — ציוד ש-`ROUTER_EQUIP` מחריג
 *     במכוון — שהמילה "ראוטר" מופיעה בו רק כדי לומר למי זה לא חל.
 *     הרחבה דו-כיוונית תפסה אותה והייתה פוסלת חבילה על חיוב שאינו
 *     שלה. הבדיקה הזו מקבעת את שני הכיוונים.
 *
 * הבריכה והבחירות אינן זזות: רשימת הפגיעות בקטלוג נשארת עשר רשומות.
 */

const PACKAGES = basePackages();
const live = listable(PACKAGES);

const fake = (text) => ({
  id: "999",
  name: "בדיקה",
  description: text,
  benefits: "",
  rawPriceField: "",
  priceAfterPromoNote: "",
});

test("שער הנתב מקבל `תוספת` בלי ב' — כמו שני השערים התאומים", () => {
  for (const text of [
    'נתב תוספת של 20 ש"ח לחודש',
    'נתב תוספת 20 ש"ח לחודש',
    "ראוטר תוספת של 15 ₪ לחודש",
    'ראווטר תוספת 25 ש"ח לחודש',
  ]) {
    assert.equal(
      routerPricedSeparately(fake(text)),
      true,
      `הצורה חסרת ה-ב' נשארה בלתי מזוהה: ${text}`,
    );
  }
});

test("הצורה עם ב' ממשיכה להיתפס, בשני סדרי המילים", () => {
  for (const text of [
    'נתב בתוספת 20 ש"ח לחודש',
    'בתוספת 20 ש"ח לחודש עבור הנתב',
    "נתב פייבר בהשכרה בתוספת 25 ₪ לחודש",
  ]) {
    assert.equal(routerPricedSeparately(fake(text)), true, text);
  }
});

test("`תוספת` בסדר ההפוך אינה נתפסת — המילה `ראוטר` יכולה להיות פסוקית פטור", () => {
  /*
   * זו ההחלטה ולא פער: בסדר ההפוך אין מי שיבטיח שהציוד הוא נושא
   * החיוב. id 123 היא ההוכחה החיה, והיא נשארת מחוץ לשער.
   */
  assert.equal(
    routerPricedSeparately(
      fake("מגדיל טווח לנחושת – 4 חודשים חינם, לאחר מכן תוספת של 15 ₪ (למי שלא לקח ראוטר)"),
    ),
    false,
    "חיוב על מגדיל טווח נתפס כחיוב על נתב",
  );

  const p123 = PACKAGES.find((p) => String(p.id) === "123");
  assert.ok(p123, "id 123 נעלמה מהקטלוג — הבדיקה הזו איבדה את העוגן שלה");
  assert.equal(
    routerPricedSeparately(p123),
    false,
    "id 123 נפסלת על חיוב של מגדיל טווח ולא של נתב",
  );
});

test("רשימת הפגיעות בקטלוג לא זזה — ההרחבה רדומה", () => {
  const hits = PACKAGES.filter(routerPricedSeparately)
    .map((p) => String(p.id))
    .sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(hits, ["85", "92", "102", "104", "107", "108", "109", "114", "124", "158"]);
});

test("בריכת ההשוואה לא זזה", () => {
  const ids = (track) =>
    live
      .filter((p) => isComparable(p, track))
      .map((p) => String(p.id))
      .sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(ids("cellular"), ["25", "30", "35", "65", "66", "90", "91", "93", "116", "117", "121"]);
  assert.deepEqual(ids("home"), ["3", "157"]);
});
