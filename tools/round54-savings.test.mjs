import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  addonFreeThenPaid,
  computeSaving,
  declaresRiseInText,
  isComparable,
} from "../src/app/lp/catalog/savings.ts";

const P = basePackages();

/*
 * סבב 54, `savings.ts`. לא ניסוח שכן אלא **סדר** שכן, בדיוק כמו סבב 53
 * — רק שהפעם הסדר הוא בין הסכום לתקופת החינם. `ADDON_FREE_THEN_PAID`
 * דורשת בשתי חלופותיה את סימן החינם קודם והסכום אחריו ("חינם אח"כ
 * 49.9"), והקטלוג כותב גם את ההיפך: id 54 — "בעלות 7.90 ש"ח (הטבה של
 * חודש ראשון ללא עלות)". שני השערים התאומים כבר סוגרים את החור הזה
 * במפורש (`ROUTER_PRICED_SEPARATELY` עם שני סדרים, `PHONE_LINE_SURCHARGE`
 * עם שלושה), וכאן הלקח לא הוחל.
 */

const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

test("סבב 54: תוסף שהסכום שלו נכתב לפני תקופת החינם נתפס (id 54)", () => {
  const p54 = byId(54);
  assert.match(
    String(p54.description),
    /בעלות 7\.90 ש"ח \(הטבה של חודש ראשון ללא עלות\)/,
    "הטקסט שהשער נכתב עליו השתנה בקטלוג — יש לעדכן את הבדיקה",
  );
  assert.equal(addonFreeThenPaid(p54), true);
});

/** ההוכחה היא הפיכת הסדר באותו משפט, בלי שינוי אחר. */
const withProse = (description, extra = {}) => ({
  id: 999,
  name: "t",
  provider: "x",
  category: "cellular",
  priceModel: "monthly",
  price: 52.9,
  description,
  ...extra,
});

test("סבב 54: שני סדרי המילים מחזירים אותה תשובה", () => {
  const paidThenFree = withProse('שירות Cyber - בעלות 7.90 ש"ח (הטבה של חודש ראשון ללא עלות)');
  const freeThenPaid = withProse('שירות Cyber - הטבה של חודש ראשון ללא עלות, אח"כ 7.90 ש"ח');
  assert.equal(addonFreeThenPaid(freeThenPaid), true, "הסדר שתמיד נתפס");
  assert.equal(addonFreeThenPaid(paidThenFree), true, "הסדר ההפוך — אותה הצהרה");
});

test("סבב 54: סכום ששווה לכותרת הוא החשבון ולא תוסף עליו", () => {
  /*
   * `ב?עלות` הוא גם הנוסח שבו הקטלוג מציג את מחיר החבילה עצמו —
   * id 157 כותבת "בעלות של 149 ש"ח". בלי השוואת הסכום לכותרת, משפט
   * שמצרף למחיר הזה חודש ראשון חינם היה נפסל כתוספת חודשית.
   */
  const headline = withProse('החבילה בעלות של 52.90 ש"ח, חודש ראשון ללא עלות');
  assert.equal(addonFreeThenPaid(headline), false);
  const afterPromo = withProse('החבילה בעלות של 69 ש"ח, חודש ראשון ללא עלות', {
    priceAfterPromo: 69,
  });
  assert.equal(addonFreeThenPaid(afterPromo), false);
  const addon = withProse('תוסף בעלות של 14.90 ש"ח, חודש ראשון ללא עלות');
  assert.equal(addonFreeThenPaid(addon), true, "סכום שאינו הכותרת הוא תוסף");
});

test("סבב 54: עליית מחיר רגילה אינה נקראת כתוספת", () => {
  /*
   * אותו נימוק שבגללו החלופה השנייה לא הורחבה: id 58 כותבת "מחיר
   * מוזל של 39.90 לחודשיים ראשונים ולאחר מכן 49.90" — עליית מחיר,
   * ולזה יש `priceAfterPromo`. בלי דרישת סימן חינם אחרי מילת
   * התקופה, הסמיכות לבדה הייתה מסמנת אותה כתוספת.
   */
  const rise = withProse("מחיר מוזל של 39.90 לחודשיים ראשונים ולאחר מכן 49.90");
  assert.equal(addonFreeThenPaid(rise), false);
});

test("סבב 54: החלופה אינה מזיזה את בריכת ההשוואה ואת הבחירה", () => {
  /*
   * id 54 היא הרשומה היחידה שהחלופה מוסיפה, והיא נפסלת כבר היום
   * ב-`declaresRiseInText` — ולכן אין מספר מוצג שזז. השער הוא לרענון
   * הבא, שבו `priceAfterPromo` מספרי משתיק את שער העלייה.
   */
  const p54 = byId(54);
  assert.equal(declaresRiseInText(p54), true, "הפסילה הקיימת של id 54");
  assert.equal(isComparable(p54, "cellular"), false);

  const cellular = P.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id));
  const home = P.filter((p) => isComparable(p, "home")).map((p) => String(p.id));
  assert.deepEqual(cellular.sort(), ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"].sort());
  assert.deepEqual(home.sort(), ["157", "3"].sort());

  assert.equal(String(computeSaving(P, "cellular", 1, 220).pick?.id), "121");
  assert.equal(String(computeSaving(P, "cellular", 2, 220).pick?.id), "117");
  assert.equal(String(computeSaving(P, "home", 1, 350).pick?.id), "157");
});
