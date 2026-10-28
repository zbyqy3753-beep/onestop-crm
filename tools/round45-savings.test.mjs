import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  declaresRiseInText,
  isComparable,
  monthlySurchargePerLine,
  parseSpend,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 45 — אותה הצהרה, נוסח שכן. שלושה שערים הכירו צורה אחת
 * והחמיצו את השכנה:
 *
 *   • `RISE_IN_TEXT` הכירה `לאחר שנה` וחמקה מ-`אחרי שנה`,
 *     מ-`לאחר/אחרי שנתיים` ומשגיאת הכתיב החיה `לאחר משנה` (id 87).
 *   • `MONTHLY_SURCHARGE_PER_LINE` הכירה `לכל קו` ולא `לכל מנוי`,
 *     בזמן שהקטלוג מנסח את אותה עובדה בשתי היחידות (id 53).
 *   • `AMOUNT` — השער שקורא את מה שהגולש **מקליד** — הכיר `₪` לבדו,
 *     בזמן שאותו קובץ מקדיש 45 שורות ל-`ש"ח`/`שח`/`שקלים`.
 *
 * שני הראשונים בכיוון השמרני (בריכה קטנה), השלישי נייטרלי (קלט
 * תקין שנפסל). המבחן האחרון מקבע שהבריכה והבחירות לא זזו בפועל.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));

/** רשומה סלולרית מלאה שעוברת היום את כל השערים, עם טקסט מוחלף. */
const withText = (text, over = {}) => ({ ...byId("121"), id: "t", description: text, ...over });

test("סבב 45: עלייה שנוסחה ב-`אחרי` ובשנתיים נקראת כעלייה", () => {
  for (const text of [
    'המחיר 24.90 ש"ח לחודש, לאחר שנה 69.90 ש"ח',
    'המחיר 24.90 ש"ח לחודש, אחרי שנה 69.90 ש"ח',
    "דמי שימוש בסך של 24.90 ₪ לחודש, אחרי שנתיים 69.9",
    "דמי שימוש בסך של 24.90 ₪ לחודש, לאחר שנתיים 69.9",
    // שגיאת הכתיב החיה של id 87.
    "המחיר לשנה לאחר משנה 69.90",
    "המחיר 24.90 ₪, אחרי 12 חודשים 69.90",
  ]) {
    assert.equal(declaresRiseInText(withText(text)), true, text);
  }
});

test("סבב 45: הצהרת עלייה פוסלת מהבריכה כשאין מחיר-אחרי-הטבה", () => {
  // אותה רשומה בדיוק, רק הניסוח השכן — שתיהן חייבות לצאת מהבריכה.
  for (const text of [
    'המחיר 24.90 ש"ח לחודש, לאחר שנה 69.90 ש"ח',
    'המחיר 24.90 ש"ח לחודש, אחרי שנה 69.90 ש"ח',
  ]) {
    const pkg = withText(text, { price: 24.9, priceAfterPromo: null });
    assert.equal(isComparable(pkg, "cellular"), false, text);
  }
});

test("סבב 45: תוספת חודשית נקראת בשתי היחידות — קו ומנוי", () => {
  for (const text of [
    'עלות הו"ק 40 ₪ , תוספת של 8 ש"ח לחודש לכל קו',
    'עלות הו"ק 40 ₪ , תוספת של 8 ש"ח לחודש לכל מנוי',
    // id 7 מילה במילה, ואותו משפט ביחידה השכנה.
    'עלות הו"ק 40 ₪ , תשלום חודשי 8 שקלים לרשומה',
    'עלות הו"ק 40 ₪ , תשלום חודשי 8 שקלים לכל מנוי',
  ]) {
    assert.equal(monthlySurchargePerLine(withText(text)), true, text);
  }
});

test("סבב 45: `למנוי` החשוף נשאר בחוץ — הוא מדרגת כמות ולא תוספת", () => {
  // ההכרעה המתועדת על id 36: "עד 2 מנויים כולל – ... 64.90 ₪ למנוי".
  const text = "עד 2 מנויים כולל - תשלום חודשי ע״ס 64.90 ₪ למנוי";
  assert.equal(monthlySurchargePerLine(withText(text)), false);
});

test("סבב 45: השער תופס בדיוק את אותן שלוש רשומות, בלי התאמות שגויות", () => {
  // הקבוצה שהשער תופס בקטלוג החי אינה זזה בעקבות היחידה הנוספת.
  const caught = live
    .filter((p) => monthlySurchargePerLine(p))
    .map((p) => String(p.id))
    .sort();
  assert.deepEqual(caught, ["10", "11", "7"]);
});

test("סבב 45: סכום שהוקלד עם `ש\"ח`/`שח`/`שקלים` נקרא, ולא נפסל", () => {
  for (const raw of ["₪220", "220 ₪", '220 ש"ח', "220 שח", "220 ש״ח", "220 שקלים", "220"]) {
    assert.equal(parseSpend(raw), 220, raw);
  }
  // הצורות שהשער פוסל בכוונה ממשיכות להיפסל — ראה ההערה על `AMOUNT`.
  for (const raw of ["1.200", "220,5", "2 20", "", "abc"]) {
    assert.equal(parseSpend(raw), 0, raw);
  }
  // והצורות שעבדו ממשיכות לעבוד.
  assert.equal(parseSpend("1,200"), 1200);
  assert.equal(parseSpend("₪ 1,200"), 1200);
  assert.equal(parseSpend("220.5"), 220.5);
});

test("סבב 45: הבריכה והבחירות לא זזו", () => {
  // ⚠️ שלושת השינויים נמדדו לפני ואחרי: אותה בריכה, אותה בחירה,
  // אותו מחיר לקו. שניים מהם שמרניים ולכן *יכלו* להקטין את הבריכה —
  // והרשומות שהם תופסים נפסלות כבר משער אחר, ולכן בפועל אפס תזוזה.
  assert.deepEqual(
    live
      .filter((p) => isComparable(p, "cellular"))
      .map((p) => String(p.id))
      .sort(),
    ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"],
  );
  assert.deepEqual(
    live
      .filter((p) => isComparable(p, "home"))
      .map((p) => String(p.id))
      .sort(),
    ["157", "3"],
  );

  // קו אחד → id 121 (₪34); 2–10 קווים → id 117 (₪29.9 לקו); בית → id 157.
  assert.equal(String(computeSaving(live, "cellular", 1, 200).pick.id), "121");
  assert.equal(computeSaving(live, "cellular", 1, 200).perLine, 34);
  for (let lines = 2; lines <= 10; lines++) {
    const s = computeSaving(live, "cellular", lines, 600);
    assert.equal(String(s.pick.id), "117", `lines=${lines}`);
    assert.equal(s.perLine, 29.9, `lines=${lines}`);
  }
  assert.equal(String(computeSaving(live, "home", 1, 350).pick.id), "157");
  assert.equal(computeSaving(live, "home", 1, 350).perLine, 149);
});
