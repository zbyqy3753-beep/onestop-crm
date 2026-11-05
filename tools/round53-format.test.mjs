import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  heroRiseLine,
  priceNote,
  promoNoteLabel,
  promoNoteRises,
  PROMO_NOTE_LABEL,
  PROMO_NOTE_QUOTE_LABEL,
} from "../src/app/lp/catalog/format.ts";

const P = basePackages();
const byId = (id) => P.find((p) => String(p.id) === String(id));

/*
 * סבב 53, `format.ts`. שני שערים, אותו דפוס: שער שמכיר הצהרה בצורה
 * אחת ומפספס את הצורה השכנה. שתי רשומות זזות על המסך — ids 2 ו-23 —
 * ואף אחת אחרת, וזה מקובע כאן פריט-פריט.
 */

test("round53: ₪35 שהרשומה מייחסת למנוי אחד אינו 'מחיר מותנה בכמות'", () => {
  /*
   * id 2 (`כשר ולדבר יותר`, ₪35) כותבת "מנוי 1 תשלום חודשי בסך 35 ₪
   * ... שני מנויים ומעלה תשלום חודשי בסך30 ₪" — כלומר ₪35 הוא המחיר
   * למנוי אחד ו-₪30 הוא המותנה בכמות. `headlinePriceIsSingleUnit`
   * קרא צורה אחת בלבד (`מנוי|קו בודד – N`), `lineTiers` ריק ולכן
   * ה-escape הכמותי לא יכול לעזור, ו-`requiresMultipleLines` (שנדלק
   * על "שני מנויים ומעלה") גבר: הכרטיס וטבלת ההשוואה הדפיסו
   * "המחיר מותנה בכמות המנויים בחבילה" על מספר שהרשומה מכחישה.
   */
  assert.equal(priceNote(byId(2)), null);
});

test("round53: שתי הרשומות שכן מסייגות את אותו מספר נשארו מסויגות", () => {
  /*
   * הצד השני של אותו שער, וזו הסיבה שהוא נקרא מהטקסט ולא מושלם:
   * ב-id 110 הרשומה כותבת "עבור מנוי בודד 39.90 ₪" בזמן שהמחיר על
   * הכרטיס הוא ₪35 — כלומר ₪35 הוא **כן** המחיר המותנה. ב-id 68
   * "קו בודד – 49.90 ₪" מול ₪39.9 שעל הכרטיס, אותו דבר.
   */
  for (const id of [110, 68]) {
    assert.deepEqual(priceNote(byId(id)), {
      label: "תנאי המחיר",
      value: "המחיר מותנה בכמות המנויים בחבילה",
    });
  }
});

test("round53: 'למנוי אחד' בלי 'בסך' אינו נקרא כמחיר לבודד", () => {
  /*
   * אותה רשומה (id 2) כותבת בהמשך "בתום התקופה: 55 ₪ למנוי אחד" —
   * וזו הסיבה ש-`בסך` נדרש בצורה השנייה ובמרחק קצר. בלעדיו הצורה
   * הזו הייתה נקראת כהצהרה על מחיר לבודד.
   */
  assert.match(byId(2).description, /בתום התקופה: 55 ₪ למנוי אחד/);
  assert.equal(heroRiseLine(byId(2)), "ואחרי ההטבה ₪50");
});

test("round53: עלייה 25→59 שהרשומה מסרה מיוחסת ולא מצוטטת", () => {
  /*
   * id 23 (`כשר`, ₪25) מוסרת "25 ש"ח ... ל-12 חודשים ראשונים. לאחר
   * מכן התשלום על החבילה יהיה 59 ₪" — עלייה חד-משמעית. `nums` יצא
   * [25, 12, 59]: ה-25 הוא המחיר שהכרטיס עצמו מדפיס וה-12 הוא מספר
   * חודשים, ושניהם הפילו את ה-`every`. ⚠️ המספר על המסך לא זז —
   * מה שזז הוא התווית מעליו, מציטוט ("נוסח המבצע:") להצהרה שלנו.
   */
  const p = byId(23);
  assert.equal(promoNoteRises(p, p.priceAfterPromoNote), true);
  assert.equal(promoNoteLabel(p, p.priceAfterPromoNote), PROMO_NOTE_LABEL);
  assert.match(heroRiseLine(p), /^בתום ההטבה: 25 ש"ח/);
});

test("round53: שלוש הרשומות שפותחות במחיר המבצע נשארו ציטוט", () => {
  /*
   * ids 58/81/132 נמנו בהערה יחד עם id 23, אבל בשלושתן `price` הוא
   * כבר **מחיר הקבע** (49.9 / 99 / 59) ואילו הנוסח פותח במחיר המבצע
   * (39.9 / 39 / 39). אחרי נשירת המספר ששווה ל-`price` נשאר בהן רק
   * מחיר המבצע, שנמוך ממנו — ולכן הן נשארות ציטוט, בדיוק כפי
   * שההערה דורשת. זה מה שמבדיל אותן מ-id 23.
   */
  for (const id of [58, 81, 132]) {
    const p = byId(id);
    assert.equal(promoNoteRises(p, p.priceAfterPromoNote), false, `id ${id}`);
    assert.equal(promoNoteLabel(p, p.priceAfterPromoNote), PROMO_NOTE_QUOTE_LABEL);
  }
});

test("round53: 'לאחר מכן מ-100 ₪' על חבילה ב-₪100 אינה עלייה", () => {
  /*
   * id 85: הנוסח מוסר מספר אחד, והוא **שווה** ל-`price`. אחרי
   * הנשירה לא נשאר מספר כלל, ו-`nums.length > 0` חוסם — כלומר
   * הנשירה אינה יכולה להמציא הצהרה על רשומה שלא הצהירה.
   */
  const p = byId(85);
  assert.equal(promoNoteRises(p, p.priceAfterPromoNote), false);
});

test("round53: מספר חודשים נושר, 'לחודש' אחרי סימן מטבע אינו נושר", () => {
  /*
   * הנשירה דורשת צמידות: "12 חודשים" נושר, ואילו "119 ₪ לחודש"
   * (id 92) אינו — בין הספרה למילה יש " ₪ ל". זו הסיבה ש-ids
   * 92/108/109, שבהן העלייה השנייה (הנתב) נבלעת, אינן זזות כאן:
   * הן הכרעה פתוחה ([[lp-open-decisions-round47]]) ולא נוסח.
   */
  const p = byId(92);
  assert.match(p.priceAfterPromoNote, /119 ₪ לחודש \+ 10 ₪ נתב/);
  assert.equal(promoNoteRises(p, p.priceAfterPromoNote), false);
});

test("round53: מלבד ids 2 ו-23 אף רשומה לא זזה בשני השערים", () => {
  /*
   * הקיבוע שמחליף מדידה בהנחה: שתי הרשומות שזזות נמנות בשם, וכל
   * 107 האחרות נמדדות מול הטביעה שנמדדה לפני השינוי.
   */
  const noted = P.filter((p) => priceNote(p) !== null).map((p) => String(p.id)).sort();
  assert.ok(!noted.includes("2"));
  /* נמדד 20 לפני השינוי ו-19 אחריו — id 2 בלבד ירדה. */
  assert.equal(noted.length, 19);

  const attributed = P.filter(
    (p) => p.priceAfterPromoNote && promoNoteRises(p, p.priceAfterPromoNote),
  )
    .map((p) => String(p.id))
    .sort();
  assert.deepEqual(attributed, ["23", "42", "61"]);
});
