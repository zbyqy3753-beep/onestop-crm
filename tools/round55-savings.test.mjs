import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  flatMonthlyFeeNotInPrice,
  isComparable,
  monthlySurchargePerLine,
} from "../src/app/lp/catalog/savings.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

/*
 * סבב 55, `savings.ts`. לא סדר מילים ולא מילה נרדפת אלא **משפחה
 * שלמה בלי שער**: חיוב חודשי שהמחיר אינו מכיל ושאינו נושא סמן "לקו".
 * שלוש החלופות של `monthlySurchargePerLine` דורשות `PER_LINE_UNIT`
 * — דרישה נכונה לשם הזה — והתאום שההערות שם מפנות אליו,
 * `routerPricedSeparately`, תופס דווקא חיוב **שטוח** (דמי נתב אינם
 * "לקו") ונקרא בענף הבית בלבד. בענף הסלולרי, שהוא זה שמוכפל בכמות
 * הקווים, לא נשאר לצורה הזו שום קורא.
 */

test("סבב 55: חיוב חודשי שטוח שהמחיר אינו מכיל נתפס (id 53)", () => {
  const p = byId(53);
  // "דמי טיפול בהוראת קבע חדש פעמי 40 ועלות חודשית של 7.9" — ₪7.90
  // בכל חודש, כלומר ₪94.80 בשנה שאינם בשום מספר על המסך.
  assert.match(String(p.description ?? ""), /עלות\s+חודשית\s+של\s+7\.9/);
  assert.equal(flatMonthlyFeeNotInPrice(p), true);
  // והשער ששמו "לקו" ממשיך לא לתפוס אותה — אין במשפט סמן כמות.
  assert.equal(monthlySurchargePerLine(p), false);
});

test("וסכום ששווה לכותרת אינו תוספת אלא החשבון", () => {
  const p = byId(53);
  assert.equal(flatMonthlyFeeNotInPrice({ ...p, price: 7.9 }), false);
  assert.equal(flatMonthlyFeeNotInPrice({ ...p, priceAfterPromo: 7.9 }), false);
});

test("ids 23/27 נשארות בחוץ: שם זה המחיר שאחרי ההטבה ולא תוספת עליו", () => {
  for (const id of [23, 27]) {
    assert.equal(flatMonthlyFeeNotInPrice(byId(id)), false);
  }
});

test("id 53 היא ההתאמה היחידה בכל הקטלוג", () => {
  const hits = P.filter((p) => flatMonthlyFeeNotInPrice(p)).map((p) => p.id);
  assert.deepEqual(hits.map(String), ["53"]);
});

test("והבריכה והבחירה אינן זזות — id 53 נפסלת ממילא", () => {
  // 11 בת-השוואה מ-2 קווים ומעלה, 10 בקו בודד (`familyPriceOnly`),
  // 2 בבית; הבחירה 121 בקו בודד, 117 ב-2–10, 157 בבית.
  assert.equal(isComparable(byId(53), "cellular"), false);
  assert.equal(P.filter((p) => isComparable(p, "cellular")).length, 11);
  assert.equal(P.filter((p) => isComparable(p, "home")).length, 2);
  assert.equal(String(computeSaving(P, "cellular", 1, 300).pick?.id), "121");
  for (let n = 2; n <= 10; n++) {
    assert.equal(String(computeSaving(P, "cellular", n, 300).pick?.id), "117");
  }
  assert.equal(String(computeSaving(P, "home", 1, 300).pick?.id), "157");
});
