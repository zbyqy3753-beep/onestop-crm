import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseSpendRaw, MAX_TYPED_SPEND } from "../src/app/lp/catalog/savings.ts";

const CALC = readFileSync(new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url), "utf8");

/** ה-`maxLength` שהשדה מכריז עליו בפועל, כמספר. */
function fieldMaxLength() {
  const m = CALC.match(/maxLength=\{(\d+)\}/);
  assert.ok(m, "לא נמצא `maxLength` בשדה הסכום");
  return Number(m[1]);
}

const RLM = "‏";

/*
 * ⚠️ הצורות האלה אינן היפותטיות: כולן מה שהדבקה מחשבונית, מוואטסאפ או
 * מדף עברי מייצרת, וכולן מתקבלות ב-`parseSpendRaw`. הבדיקה מודדת את
 * ה-`maxLength` מול הפרסור ולא מול מספר קבוע, כדי שההרחבה הבאה של
 * `SHEKEL` תיתפס כאן ולא במסך של גולש.
 */
const PASTED = [
  "1,200.50 שקלים",
  "100,000.00 שקלים",
  `${RLM}100,000.00 ש״ח${RLM}`,
  `${RLM}שקלים 100,000.00${RLM}`,
  `${RLM}₪ 100,000.00${RLM}`,
  "220 שח",
  '1,200.50 ש"ח',
  `${RLM}₪ 5,000.00${RLM}`,
];

test("maxLength אינו חותך אף צורה שהפרסור מקבל", () => {
  const max = fieldMaxLength();
  for (const raw of PASTED) {
    const full = parseSpendRaw(raw);
    assert.ok(full > 0, `${JSON.stringify(raw)} אמור להתקבל בפרסור`);
    const afterField = parseSpendRaw(raw.slice(0, max));
    assert.equal(
      afterField,
      full,
      `maxLength=${max} חותך ${JSON.stringify(raw)} (${raw.length} תווים) ל-${afterField} במקום ${full}`,
    );
  }
});

/*
 * ⚠️ האינווריאנט שההערה בשדה מצהירה עליו, נמדד ולא מצוטט: 13 היה
 * נכון כש-`AMOUNT` הכיר את `₪` לבדו, והתיישן כש-`SHEKEL` הורחב
 * ל-`שח`/`ש"ח`/`שקלים` בשני הסדרים. זו הבדיקה שמונעת את הדריפט הבא.
 */
test("maxLength מחזיק את הפורמט הארוך ביותר שהפרסור מקבל", () => {
  let longest = 0;
  for (const amount of ["100,000.00", "99,999.99", "5,000.00", "1,200.50"]) {
    for (const sh of ["₪", "שח", 'ש"ח', "ש״ח", "שקל", "שקלים"]) {
      for (const form of [`${sh} ${amount}`, `${amount} ${sh}`, `${sh}${amount}`]) {
        const withBidi = `${RLM}${form}${RLM}`;
        if (parseSpendRaw(withBidi) > 0) longest = Math.max(longest, withBidi.length);
      }
    }
  }
  assert.equal(longest, 18, "הפורמט הארוך ביותר שהפרסור מקבל השתנה — יש למדוד את maxLength מחדש");
  assert.ok(
    fieldMaxLength() >= longest,
    `maxLength=${fieldMaxLength()} קטן מהפורמט הארוך ביותר שנתמך (${longest} תווים)`,
  );
});

/*
 * ⚠️ מה שהרחבת ה-`maxLength` **אינה** עושה: היא אינה פותחת מסלול
 * לסכום אבסורדי. השומר על גודל הוא `absurdSpend` ב-`MAX_TYPED_SPEND`,
 * ולא ספירת תווים — זו בדיוק הסיבה שאפשר להרחיב את התקרה.
 */
test("השומר על גודל הוא MAX_TYPED_SPEND ולא ספירת התווים", () => {
  const nines = "9".repeat(fieldMaxLength());
  assert.ok(parseSpendRaw(nines) > MAX_TYPED_SPEND, "סכום באורך התקרה חייב להיפסל כאבסורדי");
  assert.ok(parseSpendRaw("100000") <= MAX_TYPED_SPEND, "₪100,000 הוא תקרת הקבלה ולא מעליה");
});

/*
 * ⚠️ ההודעה שמתחת לשדה נוקבת ב-`MAX_TYPED_SPEND` כתקרת הקבלה, ולכן
 * כל צורה של הסכום הזה חייבת להיכנס לשדה. זה היה החור הרחב ביותר
 * שהתקרה הקודמת ייצרה.
 */
test("כל צורה של תקרת הקבלה נכנסת לשדה", () => {
  const max = fieldMaxLength();
  for (const sh of ["₪", "שח", 'ש"ח', "ש״ח", "שקל", "שקלים"]) {
    for (const form of [`${sh} 100,000.00`, `100,000.00 ${sh}`]) {
      assert.equal(
        parseSpendRaw(form.slice(0, max)),
        MAX_TYPED_SPEND,
        `${JSON.stringify(form)} נחתך ב-maxLength=${max}`,
      );
    }
  }
});
