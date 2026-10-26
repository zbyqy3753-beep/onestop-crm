import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  isComparable,
  monthlySurchargePerLine,
  phoneLineCostsExtra,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 44 — שני חורי-נוסח בשערים, שניהם "אותה הצהרה בניסוח השכן",
 * ושניהם **רדומים היום**: אף מספר שעל המסך אינו זז.
 *
 *   • `PHONE_LINE_SURCHARGE` הכיר "בתוספת" ולא "בעלות", בזמן שהשער
 *     התאום (`ROUTER_PRICED_SEPARATELY`) הוסיף את החלופה הזו במפורש
 *     בנימוק ש"זה חור בסדר המילים ולא רק באיות הציוד".
 *   • `MONTHLY_SURCHARGE_PER_LINE` דרש למ"ד לפני "קו", בזמן שהניסוח
 *     החי בקטלוג הוא "כל קו" — כלומר ההגנה שההערה מעל השער מתארת
 *     על ids 31/38/39/40 לא הייתה קיימת בכלל.
 *
 * המבחן האחרון מקבע שהבריכה והבחירות לא זזו בפועל.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));
const gateText = (p) => [p.name, p.description, p.benefits, p.priceAfterPromoNote].filter(Boolean).join("\n");

test("savings: 'קו טלפון … בעלות 20 ש״ח' נקרא כתוספת, כמו 'בתוספת'", () => {
  // id 81: "קו טלפון ביתי 1000 דקות בעלות 20 ש"ח"
  const p = byId("81");
  assert.match(gateText(p), /קו טלפון ביתי 1000 דקות בעלות 20/);
  assert.equal(phoneLineCostsExtra(p), true);
});

test("savings: id 157 — הניסוח ב'בתוספת' ממשיך להידלק", () => {
  // ⚠️ הבחירה החיה במסלול הבית. היא הסיבה שההסתייגות מוצגת בכלל.
  assert.equal(phoneLineCostsExtra(byId("157")), true);
});

test("savings: שער קו הטלפון אינו שער בריכה — הוא אינו מזיז מספר", () => {
  /*
   * ⚠️ מתועד על השער עצמו: הקו הביתי הוא תוספת אופציונלית ו-₪149
   * מחיר שטוח אמיתי, ולכן `isComparable` אינה קוראת אותו. המבחן
   * הזה הוא מה שמונע ממנו להפוך לשער בריכה בטעות בסבב הבא.
   */
  assert.equal(isComparable(byId("157"), "home"), true);
  assert.deepEqual(
    live.filter((p) => isComparable(p, "home")).map((p) => String(p.id)).sort(),
    ["157", "3"].sort(),
  );
});

test("savings: 'בסך N ₪ כל קו' נקרא כסימן כמות גם בלי למ\"ד", () => {
  /*
   * ⚠️ נבדק על הניסוח החי **בתוך** רשומה אמיתית, עם סכום שאינו
   * המחיר. בארבע רשומות סלקום החיות הסכום שווה ל-`price` ולכן
   * בדיקת הסכום מתה אותן — זו בדיוק הסיבה שהחור היה בלתי נראה.
   */
  const base = byId("31");
  const withOtherAmount = {
    ...base,
    price: 24.9,
    description: "+ תשלום חודשי בסך 8 ₪ כל קו סלולר.",
  };
  assert.equal(monthlySurchargePerLine(withOtherAmount), true);
  // ואותה הצהרה עם למ"ד נתפסה גם קודם — שתי הצורות שוות עכשיו.
  assert.equal(
    monthlySurchargePerLine({ ...withOtherAmount, description: "+ תשלום חודשי בסך 8 ₪ לכל קו סלולר." }),
    true,
  );
});

test("savings: ארבע רשומות סלקום לא זזו — הסכום שווה למחיר ולכן השער כבוי", () => {
  /*
   * ⚠️ זה הכיוון השמרני שההערה על השער מצהירה עליו: סכום שהוא
   * המחיר עצמו אינו תוספת. ids 31/38/39/40 ממילא אינן בת-השוואה.
   */
  for (const id of ["31", "38", "39", "40"]) {
    const p = byId(id);
    assert.match(gateText(p), /כל קו סלולר/);
    assert.equal(monthlySurchargePerLine(p), false, `id ${id}`);
    assert.equal(isComparable(p, "cellular"), false, `id ${id}`);
  }
});

test("savings: הבריכה והבחירות זהות לבסיס שלפני הסבב", () => {
  assert.deepEqual(
    live.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id)).sort(),
    ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"].sort(),
  );
  // קו אחד → 121 ב-₪34; שניים ומעלה → 117 ב-₪29.9; בית → 157 ב-₪149.
  const cases = [
    ["cellular", 1, 1000, "121", 966, 34],
    ["cellular", 3, 1000, "117", 910, 29.9],
    ["cellular", 10, 300, "117", 1, 29.9],
    ["home", 1, 350, "157", 201, 149],
    ["home", 5, 150, "157", 1, 149],
  ];
  for (const [track, lines, spend, id, monthly, perLine] of cases) {
    const s = computeSaving(live, track, lines, spend);
    assert.equal(String(s.pick.id), id, `${track}/${lines}/${spend}`);
    assert.equal(s.monthly, monthly, `${track}/${lines}/${spend}`);
    assert.equal(s.perLine, perLine, `${track}/${lines}/${spend}`);
    assert.equal(s.yearly, monthly * 12);
  }
});
