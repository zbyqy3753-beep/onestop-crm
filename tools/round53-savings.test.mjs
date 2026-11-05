import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  declaresRiseInText,
  isComparable,
  monthlySurchargePerLine,
  phoneLineCostsExtra,
  priceForExistingCustomers,
  requiresMultipleLines,
  routerPricedSeparately,
} from "../src/app/lp/catalog/savings.ts";

const P = basePackages();

/*
 * סבב 53, `savings.ts`. לא ניסוח שכן אלא **סדר** שכן: סימן המטבע
 * לפני המספר. סבב 49 תיקן בדיוק את זה — ההערה שם כותבת "סימן השקל
 * לפני המספר לא נראה לאף קורא בקובץ בזמן ש-`parseSpend` באותו קובץ
 * מכיר את שני הסדרים מאז שנכתב" — אבל התיקון הוחל על **חלופה אחת**
 * ולא על אחיותיה ולא על אף שער אחר. הצורה `₪20` חיה בקטלוג היום
 * (id 42 `בסך של ₪30`, ids 24/25/30/35 `עלות SIM: ₪0`, id 28
 * `₪32.00`), ולכן זה סדר שהמחלץ מייצר ולא חור תיאורטי.
 */

/** רשומה סינתטית — ההוכחה היא הפיכת הסדר באותו משפט, בלי שינוי אחר. */
const withProse = (description, extra = {}) => ({
  id: 999,
  name: "t",
  provider: "x",
  category: "cellular",
  priceModel: "monthly",
  price: 69.9,
  description,
  ...extra,
});

const BOTH_ORDERS = [
  ["monthlySurchargePerLine", 'עלות הו״ק 40 ₪ , תשלום חודשי {M} לרשומה', monthlySurchargePerLine],
  ["priceForExistingCustomers", "דמי שימוש חודשיים: {M} ללקוחות קיימים", priceForExistingCustomers],
  [
    "phoneLineCostsExtra",
    "קו ביתי כלול בתוכנית עם 1000 דקות בתוספת {M}",
    phoneLineCostsExtra,
  ],
  ["routerPricedSeparately", "ראווטר בעלות {M} לחודש", routerPricedSeparately],
  ["declaresRiseInText", 'מחיר 169 ש"ח כולל נתב חודשיים {M}', declaresRiseInText],
];

test("round53: ששת השערים קוראים סכום בשני הסדרים", () => {
  for (const [name, template, gate] of BOTH_ORDERS) {
    assert.equal(gate(withProse(template.replace("{M}", '20 ש"ח'))), true, `${name} / 20 ש"ח`);
    /* ⚠️ זה הצד שהחזיר `false` לפני הסבב — בכל חמשת השערים. */
    assert.equal(gate(withProse(template.replace("{M}", "₪20"))), true, `${name} / ₪20`);
  }
  /* השביעי, דרך הקבוצה הנתפסת ולא דרך `test`. */
  assert.equal(
    requiresMultipleLines(withProse("* קו בודד – ₪49.90 * 3 קווים – ₪69.90 לקו")),
    true,
  );
  assert.equal(
    requiresMultipleLines(withProse('* קו בודד – 49.90 ש"ח * 3 קווים – 69.90 ש"ח לקו')),
    true,
  );
});

test("round53: 'נתב בהשכרה ללא עלות' עדיין אינו חיוב נפרד", () => {
  /*
   * דרישת הספרה שאינה אפס נשמרה: `MONEY_NONZERO` מחליף
   * `[1-9]\d*…${SHEKEL}` ולא `\d[\d.,]*`, ולכן ההצהרה השלילית
   * שההערה בשער מגנה עליה ממשיכה לא להיתפס.
   */
  assert.equal(routerPricedSeparately(withProse("נתב בהשכרה ללא עלות")), false);
  assert.equal(routerPricedSeparately(withProse("נתב בהשכרה ₪0")), false);
});

test("round53: אף שער לא שינה פסק דין על הקטלוג של היום", () => {
  /*
   * הכיוון שמרני בכל ששת המקומות (פסילה מהבריכה או הצגת הסתייגות),
   * ולכן הסיכון היחיד הוא תזוזה לא מכוונת. נמדד פריט-פריט לפני
   * השינוי ואחריו ויצא זהה: אף רשומה שהסדר הזה מזיז אינה נושאת
   * אותו בפרוזה שלה היום.
   */
  const fire = (gate) => P.filter(gate).map((p) => String(p.id)).sort();
  assert.deepEqual(fire(priceForExistingCustomers), ["69"]);
  assert.deepEqual(fire(monthlySurchargePerLine), ["10", "11", "42", "7"]);
  assert.deepEqual(fire(phoneLineCostsExtra), ["102", "107", "108", "109", "157", "81", "92"]);
  assert.deepEqual(fire(routerPricedSeparately), [
    "102", "104", "107", "108", "109", "114", "124", "158", "85", "92",
  ]);
  assert.deepEqual(fire(requiresMultipleLines), [
    "110", "16", "18", "2", "22", "27", "28", "29", "42", "51", "57", "68",
  ]);
  assert.equal(fire(declaresRiseInText).length, 50);
});

test("round53: בריכת ההשוואה לא זזה", () => {
  const pool = (track) =>
    P.filter((p) => isComparable(p, track))
      .map((p) => String(p.id))
      .sort();
  assert.deepEqual(pool("cellular"), ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"]);
  assert.deepEqual(pool("home"), ["157", "3"]);
});

test("round53: החבילה שנבחרת בכל מסלול וכמות לא זזה", () => {
  /* אותם מספרים של סבב 52 בדיוק — קו אחד id 121 ב-₪34, משניים id 117 ב-₪29.9, הבית id 157. */
  const pick = (track, units, spend) => {
    const s = computeSaving(P, track, units, spend);
    return `${s.pick ? s.pick.id : "null"}|${s.monthly}|${s.yearly}|${s.worthwhile}|${s.lines}|${s.perLine}`;
  };
  assert.equal(pick("cellular", 1, 100), "121|66|792|true|1|34");
  assert.equal(pick("cellular", 3, 200), "117|110|1320|true|3|29.9");
  assert.equal(pick("cellular", 5, 500), "117|350|4200|true|5|29.9");
  assert.equal(pick("cellular", 10, 500), "117|201|2412|true|10|29.9");
  assert.equal(pick("home", 1, 200), "157|51|612|true|1|149");
  assert.equal(pick("home", 3, 200), "157|51|612|true|3|149");
  assert.equal(pick("home", 5, 500), "157|351|4212|true|5|149");
});
