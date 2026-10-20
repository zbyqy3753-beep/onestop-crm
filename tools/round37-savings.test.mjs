import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { computeSaving, declaresRiseInText, isComparable } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 37 — ארבעה חורים במנוע, כולם באותו כיוון: טקסט שהמנוע לא
 * קרא, או מספר שהוא קיפל, הפכו למחיר "לנצח" ולכותרת מנופחת.
 *   • חלון `לאחר מכן` נעצר ב-20 תווים, והניסוח המלא של id 23 ("לאחר
 *     מכן התשלום על החבילה יהיה 59 ₪") ארוך ממנו.
 *   • "חודשיים 149 שח" / "12 חודשים 95 ₪" — מבצע לתקופה בצורה החשופה,
 *     בלי "ראשונים" ובלי "אח״כ" (ids 112, 16, 159).
 *   • `units` לא-שלם התקפל ל-1 — ושם 1 הוא הפחות שמרני, כי הוא גם
 *     מכפיל העלות.
 *   • `description` שנקטע ב-"…" נקרא כראיה שלמה שלא הוצהרה עלייה.
 *
 * הבדיקות על רשומות מסונתזות **וגם** על הקטלוג החי: בריכה שזזה בלי
 * שהמספרים שעל המסך יזוזו היא בדיוק מה שהסבב הזה שינה, ושני הצדדים
 * צריכים להישאר מקובעים.
 */

const live = listable(basePackages());
const pool = (track) => live.filter((p) => isComparable(p, track));
const fake = (description) => ({ name: "x", description, benefits: null });

test("חלון `לאחר מכן` מכיל את הניסוח המלא, לא רק את הקצר", () => {
  assert.ok(
    declaresRiseInText(
      fake('25 ש"ח (כולל מע"מ) לחודש ל-12 חודשים. לאחר מכן התשלום על החבילה יהיה 59 ₪ לחודש בלבד'),
    ),
  );
  assert.ok(declaresRiseInText(fake("לאחר מכן 59 ₪")));
});

test("הבוילרפלייט של שימוש הוגן אינו הצהרת מחיר — גם ב-60 תווים", () => {
  assert.equal(
    declaresRiseInText(fake("לאחר מכן נהיה רשאים לחסום את הגלישה או להאט את מהירותה")),
    false,
  );
  for (const id of ["40"]) {
    const p = live.find((x) => x.id === id);
    assert.ok(p, `id ${id} אינו בקטלוג — עדכן את הבדיקה`);
  }
});

test("`חודשים <מחיר>` בצורה החשופה הוא הצהרת מבצע", () => {
  for (const text of [
    "169 ש\"ח כולל נתב\n\nחודשיים 149 שח",
    "תוקף מבצע 12 חודשים\n\n95 ₪ לחודש",
    '1-3 חודשים 144 ש"ח',
  ]) {
    assert.ok(declaresRiseInText(fake(text)), `לא זוהה: ${text}`);
  }
});

test("`חודשים` בלי מחיר אינו הצהרה — ולא נגרר דרך פסקה שלמה", () => {
  assert.equal(declaresRiseInText(fake("התחייבות ל-12 חודשים")), false);
  assert.equal(declaresRiseInText(fake("גלישה ל-12 חודשים\n\n\n\n\n\n95 ₪ לחודש")), false);
});

test("שלוש הרשומות החיות שהצורה החשופה תופסת", () => {
  for (const id of ["112", "16", "159"]) {
    const p = live.find((x) => x.id === id);
    assert.ok(p, `id ${id} אינו בקטלוג — עדכן את הבדיקה`);
    assert.ok(declaresRiseInText(p), `id ${id}`);
  }
});

test("כמות קווים לא-שלמה מתעגלת למטה ואינה מתקפלת ל-1", () => {
  const at = (units) => computeSaving(live, "cellular", units, 1000);
  assert.equal(at(3.5).lines, 3);
  assert.equal(at(3.5).yearly, at(3).yearly);
  assert.equal(at(10.5).lines, 10);
  assert.notEqual(at(10.5).yearly, at(1).yearly);
  // ועל 0 ועל שלילי 1 נשאר השמרני — העלות אינה מתאפסת.
  assert.equal(at(0).lines, 1);
  assert.equal(at(-3).lines, 1);
  assert.equal(at(NaN).lines, 1);
});

test("טקסט קטוע אינו ראיה — שמונה רשומות יצאו מהבריכה, המספרים לא זזו", () => {
  // ⚠️ 14 → 12 בסבב 39: ids 7 ו-10 יצאו על `monthlySurchargePerLine`
  // ("תשלום חודשי 8 שקלים לרשומה" — חיוב שהמחיר אינו מכיל). הכותרות
  // שמתחת לא זזו: 7/10 היו ₪69.9/₪59.9 ולא היו הנבחרת באף כמות.
  assert.equal(pool("cellular").length, 12);
  for (const id of ["52", "19", "21", "26", "37", "38", "39", "40"]) {
    const p = live.find((x) => x.id === id);
    assert.ok(p, `id ${id} אינו בקטלוג — עדכן את הבדיקה`);
    assert.match(p.description, /…\s*$/, `id ${id} אינו קטוע יותר — עדכן את הבדיקה`);
    assert.equal(isComparable(p, "cellular"), false, `id ${id}`);
  }
  // הנבחרת והכותרת של היום — אותם מספרים בדיוק שהיו לפני השער.
  const at = (units) => computeSaving(live, "cellular", units, 220);
  assert.equal(at(1).pick?.id, "121");
  assert.equal(at(1).yearly, 2232);
  for (const units of [2, 3, 5, 10]) {
    assert.equal(at(units).pick?.id, "117", `קווים: ${units}`);
  }
  assert.equal(at(3).yearly, 1560);
});

test("רשומה שלמה אינה נפסלת — השער קורא את סוף הטקסט בלבד", () => {
  const p = live.find((x) => x.id === "121");
  assert.ok(p, "id 121 אינו בקטלוג — עדכן את הבדיקה");
  assert.equal(isComparable(p, "cellular"), true);
  assert.equal(isComparable({ ...p, description: "100GB… ואחרי זה עוד טקסט" }, "cellular"), true);
  assert.equal(isComparable({ ...p, description: "100GB …" }, "cellular"), false);
});
