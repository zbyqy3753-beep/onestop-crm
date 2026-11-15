import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  declaresRiseInText,
  isComparable,
  requiresMultipleLines,
  tierCapsAt,
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
 * סבב 57, `savings.ts`. שלושה שערים שהכירו הצהרה בצורה אחת ופספסו את
 * הצורה השכנה — אותו דפוס שהקובץ מתעד בעשרה מקומות:
 *
 *   1. `headlineIsLineTierPrice` קרא רק סדר מילים אחד (כמות→מחיר),
 *      בזמן שהקטלוג כותב גם מחיר→כמות.
 *   2. חמש חלופות ב-`RISE_IN_TEXT` מנו `[-־]` ולא `–`, והאן-דש חי
 *      בקטלוג 28 פעמים בעוד המקף העברי מופיע אפס פעמים.
 *   3. `tierCapsAt` קרא כל `עד N` כתקרת קווים, בכל הקשר.
 */

test("סבב 57: מדרגת כמות נתפסת גם בסדר מחיר→כמות", () => {
  const sentence = "25 ש''ח לחודש ל-2 מנווים ומעל";
  const mirrored = "ל-2 מנווים ומעל 25 ש''ח לחודש";
  // הסדר שהקטלוג כתב — id 53 נושאת אותו מילה במילה.
  assert.match(byId(53).description, /25 ש''ח לחודש ל-2 מנווים ומעל/);

  for (const prose of [sentence, mirrored]) {
    const p = withProse(prose, { price: 25, priceAfterPromo: null });
    assert.ok(requiresMultipleLines(p), `הסדר "${prose}" אינו נתפס`);
    assert.ok(!isComparable(p, "cellular"), "הרשומה נכנסה לבריכה");
  }

  // הניפוח שהשער מונע: ₪3,300 בשנה על קו אחד במקום ₪3,192.
  const inflating = withProse(sentence, { price: 25, priceAfterPromo: null });
  const withIt = computeSaving([...P, inflating], "cellular", 1, 300);
  const without = computeSaving(P, "cellular", 1, 300);
  assert.equal(String(withIt.pick?.id), String(without.pick?.id));
  assert.equal(withIt.yearly, without.yearly);
  assert.equal(without.yearly, 3192);
});

test("סבב 57: מחיר הקו הבודד המפורש של id 129 אינו מדרגת כמות", () => {
  /*
   * ההכרעה שמקובעת בסבב 40: `קו ראשון 39 , בצירוף 2 קווים ומעלה 35
   * לקו` מוסר מחיר מפורש לקו בודד. הלמ׳ד החובה בצורה החדשה היא זו
   * ששומרת עליה — בלעדיה `39 ... 2 קווים` היה נתפס.
   */
  const p = byId(129);
  assert.match(p.description ?? "", /קו ראשון/);
  assert.ok(requiresMultipleLines(p) === false || !isComparable(p, "cellular"));
  const bare = withProse("קו ראשון 39 , בצירוף 2 קווים ומעלה 35 לקו", {
    price: 39,
    priceAfterPromo: null,
  });
  assert.ok(!requiresMultipleLines(bare), "id 129 נתפסה כמדרגת כמות");
});

test("סבב 57: הצהרת תקופה עם אן-דש נקראת כעלייה", () => {
  const forms = [
    "מחיר מובטח ל-12 חודשים",
    "מחיר מובטח ל־12 חודשים",
    "מחיר מובטח ל–12 חודשים",
    "10 ש''ח הנחה ל–12 חודשים",
    "החל מחודש ה–13: 79 ש''ח לכל מנוי",
  ];
  for (const f of forms) {
    assert.ok(declaresRiseInText(withProse(f)), `הצורה "${f}" אינה נקראת כעלייה`);
  }
  // והאן-דש אכן חי בקטלוג, בעוד המקף העברי אינו.
  const prose = P.map((p) =>
    [p.name, p.description, p.benefits, p.priceAfterPromoNote].filter(Boolean).join(" "),
  ).join(" ");
  assert.ok((prose.match(/–/g) ?? []).length >= 20, "האן-דש נעלם מהקטלוג");
  assert.equal((prose.match(/־/g) ?? []).length, 0);
});

test("סבב 57: \"עד N\" הוא תקרת קווים רק כשהיחידה נאמרת", () => {
  // שתי הרשומות שבאמת מצהירות על תקרת כמות — היחידה נאמרת.
  for (const id of [36, 37]) {
    assert.ok(tierCapsAt(byId(id), 2), `id ${id}: תקרת שני המנויים נעלמה`);
    assert.ok(!tierCapsAt(byId(id), 3));
  }
  // id 57 נתפסת בענף הטווחי ("למצרפים 2-3 מנויים").
  assert.ok(tierCapsAt(byId(57), 3));
  assert.ok(!tierCapsAt(byId(57), 4));

  /*
   * ושתים-עשרה הרשומות שהחזירו תקרה על כמות שהרשומה אינה מזכירה.
   * המפתח הוא הכמות שה-`עד` שלהן נקרא בה בטעות.
   */
  const spurious = [
    [17, 5], [19, 3], [19, 5], [21, 5], [158, 2], [158, 7], [104, 2], [104, 7],
    [89, 7], [150, 7], [147, 7], [142, 10], [140, 5], [137, 7], [135, 10],
  ];
  for (const [id, lines] of spurious) {
    assert.ok(
      !tierCapsAt(byId(id), lines),
      `id ${id}: "עד ${lines}" חזר להיקרא כתקרת קווים`,
    );
  }

  // ובבידוד, על הניסוחים עצמם.
  assert.ok(tierCapsAt(withProse("עד 2 מנויים כולל - 39.9 ₪"), 2));
  assert.ok(!tierCapsAt(withProse("עד 2,500 GB גלישה"), 2));
  assert.ok(!tierCapsAt(withProse("עד 5,000 יחידות שימוש מכל סוג"), 5));
  assert.ok(!tierCapsAt(withProse("עד 7:00 בבוקר"), 7));
  assert.ok(!tierCapsAt(withProse("עד 10% הנחה"), 10));
  assert.ok(!tierCapsAt(withProse("עד 7 ממירים ללקוח"), 7));
});

test("סבב 57: הבריכה והבחירות לא זזו", () => {
  assert.deepEqual(
    P.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id)).sort(),
    ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"],
  );
  assert.deepEqual(
    P.filter((p) => isComparable(p, "home")).map((p) => String(p.id)).sort(),
    ["157", "3"],
  );
  assert.equal(String(computeSaving(P, "cellular", 1, 200).pick?.id), "121");
  assert.equal(String(computeSaving(P, "cellular", 3, 200).pick?.id), "117");
  assert.equal(String(computeSaving(P, "home", 1, 200).pick?.id), "157");
});
