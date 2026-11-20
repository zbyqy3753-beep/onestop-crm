import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { computeSaving, declaresRiseInText, isComparable } from "../src/app/lp/catalog/savings.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

/*
 * סבב 61, `savings.ts`. שלוש צורות שכנות של אותה הצהרה ב-`RISE_IN_TEXT`
 * — הדפוס החוזר של הקובץ: שער שמכיר הצהרה בצורה אחת ומפספס את הצורה
 * שלידה.
 */

/** קלון של רשומת בית עם משפט יחיד, כדי לבחון שער אחד בלי שכנים. */
const clone = (txt) => {
  const base = byId(153);
  return {
    ...base,
    name: "x",
    rawName: null,
    benefits: [],
    priceAfterPromo: null,
    priceAfterPromoNote: null,
    notes: txt,
    description: txt,
    spec: { ...base.spec },
  };
};

test("סבב 61: מדרגת החודשים נתפסת גם כשהטווח יושב בין היחידה למחיר", () => {
  /*
   * ⚠️ הקטלוג כותב את אותה מדרגה בשני סדרים: `1-3 חודשים 144 ש"ח`
   * (id 159) — שנתפס — ו-`חודש 1-3 69 ש"ח` (id 153), `חודש 1-3 79ש"ח`
   * (id 73), `חודש 1-2 59 ש"ח` (id 70) — שנפלו לגמרי, כי החלופה דרשה
   * את סיומת הרבים צמודה למחיר.
   */
  for (const txt of ['חודש 1-3 69 ש"ח', 'חודש 1-2 59 ש"ח', 'חודש 1-3 79ש"ח']) {
    assert.equal(declaresRiseInText(clone(txt)), true, txt);
  }
  // והצורה שכבר נתפסה ממשיכה להיתפס.
  assert.equal(declaresRiseInText(clone('1-3 חודשים 144 ש"ח')), true);
});

test("סבב 61: שיעור ההנחה באמצע המשפט אינו מבריח את הצהרת תקופת ההטבה", () => {
  /*
   * ⚠️ id 70 כותבת מילה במילה `מחיר החבילה חודשיים ב50% ב59שח`, ו-
   * `ב50%` שבין `חודשיים` ל-`MONEY` מחק את ההתאמה — אותו משפט בלי
   * האחוז הוחזר `true`.
   */
  assert.equal(declaresRiseInText(clone("מחיר החבילה חודשיים ב50% ב69שח")), true);
  assert.equal(declaresRiseInText(clone("מחיר החבילה חודשיים ב69שח")), true);
  // ⚠️ המשפט יושב ב-`notes` של id 70 ולא ב-`description` — לכן כל הרשומה.
  assert.match(JSON.stringify(byId(70)), /חודשיים ב50% ב59שח/);
});

test("סבב 61: `מחיר <סכום> לשנה` נתפס, כמו `מחיר קבוע לשנה` שלידו", () => {
  /*
   * ⚠️ השער מנה `למשך שנה` ו-`(?:מובטח|תקף|קבוע) ל...שנה`, ולא את מה
   * שהקטלוג כותב: `מחיר 209 לשנה` (158), `המחיר לשנה` (87),
   * `מחיר לשנה` (82, 115) ו-`מחיר קבוע של 49 לשנה` (4) — כלומר
   * `של <סכום>` שנדחף בין `קבוע` ל-`לשנה` הפיל את ההתאמה.
   */
  for (const txt of ["מחיר 209 לשנה", "המחיר לשנה", "מחיר קבוע של 49 לשנה", "מחיר לשנה ואז"]) {
    assert.equal(declaresRiseInText(clone(txt)), true, txt);
  }
});

test("סבב 61: שלוש הצורות אינן תופסות טקסט שאינו מצהיר על תקופה", () => {
  for (const txt of [
    "חבילה נהדרת במחיר מעולה",
    "שלושה חודשים של שירות",
    "מחיר מעולה לכל המשפחה",
  ]) {
    assert.equal(declaresRiseInText(clone(txt)), false, txt);
  }
});

test("והבריכה והבחירות אינן זזות ולו ברשומה אחת", () => {
  /*
   * ⚠️ הכיוון של שלושת התיקונים שמרני (מוציא מהבריכה), ולכן המידה
   * החשובה היא שאף רשומה חיה אינה זזה: כל תשע הרשומות שהצורות האלה
   * תופסות נפסלות כבר היום דרך חצי משפט שכן (`מחודש 4` / `ואז` /
   * `לאחר שנה` / `שנה שניה` / `חודש ראשון`), או שיש להן
   * `priceAfterPromo` מספרי ואז השער אינו נקרא עליהן ב-`isComparable`.
   */
  const rise = P.filter(declaresRiseInText)
    .map((p) => Number(p.id))
    .sort((a, b) => a - b);
  assert.equal(rise.length, 50);
  for (const id of [70, 73, 153, 87, 158, 104, 82, 115, 4]) assert.ok(rise.includes(id), `${id}`);

  const pool = (track) =>
    P.filter((p) => isComparable(p, track))
      .map((p) => Number(p.id))
      .sort((a, b) => a - b);
  assert.deepEqual(pool("cellular"), [25, 30, 35, 65, 66, 90, 91, 93, 116, 117, 121]);
  assert.deepEqual(pool("home"), [3, 157]);

  // והבחירה בכל כמות, בשני המסלולים.
  for (let n = 1; n <= 10; n++) {
    const cell = computeSaving(P, "cellular", n, 500);
    assert.equal(String(cell.pick?.id), n === 1 ? "121" : "117");
    assert.equal(cell.perLine, n === 1 ? 34 : 29.9);
    const home = computeSaving(P, "home", n, 500);
    assert.equal(String(home.pick?.id), "157");
    assert.equal(home.perLine, 149);
  }
});

test("והצורות האלה כן פוסלות כשהן המשפט היחיד", () => {
  /*
   * ⚠️ הראיה שהתיקון אינו קוסמטי: קלון של id 153 שבו `חודש 1-3 69 ש"ח`
   * הוא המשפט היחיד עבר לפני התיקון את **כל** השערים, הפך לבחירת
   * מסלול הבית והכריז ₪2,772 בשנה על חשבון של ₪300 — במקום ₪1,812 —
   * בזמן שאותה רשומה מצהירה שהמחיר תקף לשלושה חודשים.
   */
  const bad = clone('חודש 1-3 69 ש"ח');
  assert.equal(isComparable(bad, "home"), false);

  // ובמידה שעל המסך: הכותרת נשארת זו של id 157.
  const withBad = computeSaving([...P, bad], "home", 1, 300);
  assert.equal(String(withBad.pick?.id), "157");
  assert.equal(withBad.yearly, 1812);
});
