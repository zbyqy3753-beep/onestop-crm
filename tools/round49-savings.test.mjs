import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  isComparable,
  monthlySurchargePerLine,
  phoneLineCostsExtra,
  tierCapsAt,
  perLinePrice,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 49 — שלוש אסימטריות נוסח במנוע, כולן אותו דפוס: שער שמכיר
 * הצהרה בצורה אחת ומפספס את הצורה השכנה שחיה בקטלוג.
 *
 *   • `MONTHLY_SURCHARGE_PER_LINE` פספס את id 42 בשלושה מקומות באותו
 *     משפט אחד: `דמי שימוש` לא היה במילון הטריגרים של החלופה הזו,
 *     `בסך` לא נמנה לצד `של`, וסימן השקל **לפני** המספר לא נראה לאף
 *     קורא בקובץ — בזמן ש-`parseSpend` באותו קובץ מכיר את שני
 *     הסדרים מאז שנכתב.
 *   • `PHONE_LINE` מנה `קו ביתי` ולא את `טלפון ביתי` החשופה (id 71).
 *   • `tierCapsAt` — הקורא שמחליט אם מדרגה היא **תקרה** — נשאר עם
 *     `[-–]` ובלי `מנווים`, בזמן ששני השערים שנושאים את אותן רשימות
 *     קיבלו את המקף העברי ואת שגיאת הכתיב של id 53 בסבבים 46 ו-48.
 */

const PKGS = basePackages();
const byId = (id) => structuredClone(PKGS.find((p) => p.id === id));
/** נושא ניטרלי: החבילה הזולה בסלולר, בלי מדרגות ובלי הצהרות. */
const carrier = () => byId("121");

function probe(text, { price = 24.9, after = 24.9 } = {}) {
  const p = carrier();
  p.id = "TEST";
  p.name = "בדיקה";
  p.price = price;
  p.priceAfterPromo = after;
  p.description = text;
  return p;
}

test("סבב 49: `דמי שימוש`, `בסך` וסימן שקל מקדים — שלושתם במשפט של id 42", () => {
  // המשפט החי של id 42, מילה במילה.
  assert.equal(
    monthlySurchargePerLine(byId("42")),
    true,
    "id 42 מצהירה על ₪30 לחודש למנוי",
  );
  // ואותה הצהרה בכל ארבע צורות הכתיב של הסכום ושל המוביל.
  for (const text of [
    "דמי שימוש בסך של ₪30 לחודש למנוי",
    'דמי שימוש בסך של 30 ש"ח לחודש למנוי',
    "דמי שימוש של ₪30 לחודש לכל קו",
    "דמי שכירות בסך ₪30 לחודש למנוי",
    // והצורות שכבר עבדו ממשיכות לעבוד.
    'תוספת של 8 ש"ח לחודש לכל קו',
    "בתוספת ₪8 לחודש לקו",
  ]) {
    assert.equal(monthlySurchargePerLine(probe(text)), true, text);
  }
});

test("סבב 49: `למנוי` החשוף נוסף לחלופה אחת — ההכרעה של סבב 45 נשמרת", () => {
  /*
   * ⚠️ זו הבדיקה שמגדרת את התיקון. סבב 45 הוציא את `למנוי` החשוף
   * בכוונה, כי ב-id 36 הוא מסמן את מחיר המדרגה ולא תוספת. היחידה
   * נוספה רק לחלופה שבה היא באה **אחרי** `לחודש` שאחרי הסכום, צורה
   * שמחירון מדרגות אינו נושא.
   */
  assert.equal(
    monthlySurchargePerLine(probe("עד 2 מנויים כולל - תשלום חודשי ע״ס 64.90 ₪ למנוי")),
    false,
  );
  assert.equal(monthlySurchargePerLine(byId("36")), false, "id 36 נשארת בחוץ");
  // והקבוצה בקטלוג החי היא בדיוק ארבע הרשומות.
  assert.deepEqual(
    PKGS.filter(monthlySurchargePerLine)
      .map((p) => String(p.id))
      .sort(),
    ["10", "11", "42", "7"],
  );
});

test("סבב 49: `טלפון ביתי` החשופה היא אותה יחידה כמו `קו ביתי`", () => {
  const head = "אינטרנט 1000 מגה. ";
  for (const unit of ["קו ביתי", "קו טלפון", "קו הטלפון", "טלפון ביתי", "טלפוניה"]) {
    const p = probe(`${head}${unit} כלול בתוכנית בתוספת 20 ש"ח`);
    assert.equal(phoneLineCostsExtra(p), true, unit);
  }
  // id 71 מצהירה "כולל טלפון ביתי ללא הגבלה" — בלי עלות, ולכן בלי
  // הסתייגות. היחידה הנוספת אינה מייצרת התאמה שגויה.
  assert.equal(phoneLineCostsExtra(byId("71")), false);
});

test("סבב 49: תקרת מדרגה מזוהה גם במקף עברי וגם ב-`מנווים`", () => {
  /*
   * תצורת id 57: מדרגה אחת שנגמרת בשלושה מנויים, ומחיר מדרגה של ₪25
   * (המספר של id 53). תקרה שאינה מזוהה מוחלת על עשרה קווים.
   */
  const base = () => {
    const p = carrier();
    p.id = "TEST";
    p.price = 39.9;
    p.priceAfterPromo = 39.9;
    p.spec = { ...p.spec, lineTiers: [{ lines: 3, price: 25 }] };
    return p;
  };
  for (const quantity of ["2-3 מנויים", "2–3 מנויים", "2־3 מנויים", "2-3 מנווים"]) {
    const p = base();
    p.description = `39.9 ₪ למנוי. למצרפים ${quantity} – 25 ₪`;
    assert.equal(tierCapsAt(p, 3), true, quantity);
    // והמחיר של עשרה קווים אינו מחיר המדרגה שנגמרה בשלושה.
    assert.equal(perLinePrice(p, 10), 39.9, quantity);
  }
});

test("סבב 49: הבריכה והבחירות לא זזו", () => {
  /*
   * ⚠️ נמדד לפני ואחרי כל ארבעת השינויים. שלושה מהם שמרניים (מוציאים
   * מהבריכה) ואחד מרחיב הסתייגות, והרשומות שהם תופסים נפסלות כבר
   * משער אחר — ולכן בפועל אפס תזוזה.
   */
  assert.deepEqual(
    PKGS.filter((p) => isComparable(p, "cellular"))
      .map((p) => String(p.id))
      .sort(),
    ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"],
  );
  assert.deepEqual(
    PKGS.filter((p) => isComparable(p, "home"))
      .map((p) => String(p.id))
      .sort(),
    ["157", "3"],
  );
});
