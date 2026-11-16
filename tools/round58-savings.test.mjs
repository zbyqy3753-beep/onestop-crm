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
 * סבב 58, `savings.ts`. `proseFloorsAt` נכתב בסבב קודם בשביל הכרטיס
 * בלבד: id 85 אומרת פעמיים "לאחר מכן מ-100 ₪ לחודש" ו-`price` שלה
 * הוא 100, ולכן הכרטיס הודה "המחיר הוא מחיר התחלתי ולא מחיר אחיד".
 * המנוע לא קיבל את אותה קריאה — `isComparable` התייחסה לאותו ₪100
 * כמחיר חודשי מוצק — כלומר אותו עמוד אמר על אותו מספר שתי אמירות
 * סותרות, וההבטחה המספרית נבנתה על הגורפת מהן.
 *
 * זו אותה אסימטריה ש-`tierCapsAt` מתעדת בכיוון ההפוך, ולכן הקריאה
 * עברה ל-`savings.ts` ו-`format.ts` מייבא אותה.
 */

test("סבב 58: מחיר שהרשומה מצהירה עליו כהתחלתי אינו בר-השוואה", () => {
  const p = byId("85");
  assert.equal(p.price, 100);
  assert.ok(proseFloorsAt(p, 100), "הרשומה אינה מצהירה על רצפה יותר");
  assert.equal(isComparable(p, "home"), false);
});

test("סבב 58: רצפת מחיר היא ההצהרה היחידה בקטלוג, והשער מצמצם בלבד", () => {
  const floored = P.filter((p) => {
    for (const v of [p.price, p.priceAfterPromo]) {
      if (typeof v === "number" && Number.isFinite(v) && proseFloorsAt(p, v)) return true;
    }
    return false;
  }).map((p) => String(p.id));
  assert.deepEqual(floored, ["85"], "רשומה נוספת נכנסה או יצאה מהשער");

  /*
   * ⚠️ ids 73, 153 ו-159 כותבות "מחודש 4 99 ש״ח" — ה-`מ` שאחרי אות
   * עברית — ו-id 135 כותבת "מ-300 ₪ ומעלה", מדרגת צריכה. אף אחת
   * מהארבע אינה רצפת מחיר, וזה מה שמחזיק את השער מצמצם.
   */
  for (const id of ["73", "153", "159", "135"]) {
    const p = byId(id);
    assert.equal(
      proseFloorsAt(p, p.price ?? 0),
      false,
      `id ${id} נקרא כרצפת מחיר — השער הפך למרחיב`,
    );
  }
});

/*
 * ⚠️ והשער אינו מזיז אף מספר על המסך. id 85 נפסלת היום בארבעה שערים
 * אחרים ממילא, ולכן הבריכה והבחירה בכל מסלול וכמות זהות למה שסבב 57
 * קיבע. זו הבדיקה שמגנה על ההבטחה ש"אפס תזוזה" — אם היא תישבר,
 * השער החדש בחר מישהו אחר.
 */

test("סבב 58: הבריכה והבחירה בכל מסלול וכמות לא זזו", () => {
  const expected = {
    cellular: [
      [1, 10, "121", 34],
      [2, 11, "117", 29.9],
      [3, 11, "117", 29.9],
      [4, 11, "117", 29.9],
      [5, 11, "117", 29.9],
      [6, 11, "117", 29.9],
      [7, 11, "117", 29.9],
      [8, 11, "117", 29.9],
      [9, 11, "117", 29.9],
      [10, 11, "117", 29.9],
    ],
    home: [[1, 2, "157", 149]],
  };

  for (const [track, rows] of Object.entries(expected)) {
    for (const [lines, size, pickId, perLine] of rows) {
      assert.equal(pool(track, lines).length, size, `${track} ${lines}: גודל הבריכה זז`);
      const s = computeSaving(P, track, lines, 500);
      assert.equal(String(s.pick?.id), pickId, `${track} ${lines}: הבחירה זזה`);
      assert.equal(s.perLine, perLine, `${track} ${lines}: המחיר לקו זז`);
      assert.equal(perLinePrice(s.pick, Math.min(lines, 10)), perLine);
    }
  }
});
