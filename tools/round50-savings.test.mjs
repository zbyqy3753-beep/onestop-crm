import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  isComparable,
  requiresMultipleLines,
  computeSaving,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 50, המנוע — **לא** תוקן, ומקובע כאן כדי שהסבב הבא לא
 * "יתקן" אותו בשוגג.
 *
 * שתי רשימות הטריגר של שערי הקווים התאומים אינן זהות: `בהצטרפות`
 * ו-`בצירוף` נמנים רק ב-`PRICED_BY_LINE_COUNT`, ו-`לרוכשים` רק
 * ב-`REQUIRES_MULTIPLE_LINES`. זה נראה כפער נוסח — הדפוס החוזר
 * בקובץ — אבל איחוד הרשימות הופך הכרעה שסבב 40 קיבע במפורש:
 * `requiresMultipleLines` שואל אם **המחיר שבכותרת** זמין רק מכמה
 * קווים, ושני הנוסחים האלה חיים בקטלוג דווקא ברשומות שהכותרת שלהן
 * היא מחיר הקו הבודד. ההכרעה אם `לרוכשים` יצטרף לתאום היא של בעל
 * המערכת.
 */

const PKGS = basePackages();
const byId = (id) => PKGS.find((p) => String(p.id) === id);

test("הכותרת של ids 129 ו-59 היא מחיר הקו הבודד, ולכן השער שותק", () => {
  /*
   * id 129: "קו ראשון 39 , בצירוף 2 קווים ומעלה 35 לקו", price 39.
   * id 59: "39.90 לחודש בהצטרפות מנוי אחד … 35 לחודש בהצטרפות 2
   * מנויים", price 39.9. בשתיהן המחיר שמתפרסם הוא מחיר קו אחד,
   * כלומר אין הבטחה מנופחת — וזו ההכרעה של `round40-savings`.
   */
  assert.equal(requiresMultipleLines(byId("129")), false);
  assert.equal(requiresMultipleLines(byId("59")), false);
  assert.equal(Number(byId("129").price), 39);
  assert.equal(Number(byId("59").price), 39.9);
});

test("ושתיהן נשמרות בחוץ בכל זאת, דרך התאום", () => {
  assert.equal(isComparable(byId("129"), "cellular"), false);
  assert.equal(isComparable(byId("59"), "cellular"), false);
});

test("`לרוכשים` נקרא כאן ולא בתאום — האסימטריה שנשארה פתוחה", () => {
  const clone = structuredClone(byId("121"));
  clone.id = "TEST";
  clone.price = 29;
  clone.priceAfterPromo = 29;
  clone.description = "29 ₪ לחודש לרוכשים 2 מנויים";
  assert.equal(requiresMultipleLines(clone), true);
  const neighbour = structuredClone(clone);
  neighbour.description = "29 ₪ לחודש בהצטרפות 2 מנויים";
  assert.equal(
    requiresMultipleLines(neighbour),
    false,
    "אם זה התהפך — זו הכרעה שצריכה להישען על `round40-savings`, לא תיקון נוסח",
  );
});

test("הבריכה והבחירה בכל מסלול וכמות — מצב הבסיס של סבב 50", () => {
  /*
   * ⚠️ אף אחד מתיקוני הסבב אינו נוגע במנוע, ולכן המספרים האלה
   * חייבים להישאר כפי שהם. הם נמדדו לפני העבודה ואחריה.
   */
  const pool = PKGS.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id)).sort();
  assert.deepEqual(pool, ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"]);
  assert.deepEqual(
    PKGS.filter((p) => isComparable(p, "home")).map((p) => String(p.id)).sort(),
    ["157", "3"],
  );

  const cell1 = computeSaving(PKGS, "cellular", 1, 300);
  assert.equal(String(cell1.pick.id), "121");
  assert.equal(cell1.monthly, 266);
  assert.equal(cell1.yearly, 3192);
  for (const [units, monthly] of [[2, 240], [3, 210], [4, 180], [5, 150]]) {
    const s = computeSaving(PKGS, "cellular", units, 300);
    assert.equal(String(s.pick.id), "117");
    assert.equal(s.monthly, monthly);
  }
  for (const units of [1, 2, 3, 4, 5]) {
    const s = computeSaving(PKGS, "home", units, 300);
    assert.equal(String(s.pick.id), "157");
    assert.equal(s.monthly, 151);
  }
});
