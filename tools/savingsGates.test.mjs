import assert from "node:assert/strict";
import { test } from "node:test";

import { computeSaving, isComparable } from "../src/app/lp/catalog/savings.ts";
import { basePackages, logicName } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ הבדיקות כאן אינן על הקטלוג כפי שהוא (זה תפקידו של
 * `savings.test.mjs`) אלא על **עמידות המנוע בפני רשומה בצורה אחרת**.
 * הקטלוג נכנס לקוד דרך `as unknown as Catalog` בלי ולידציה בזמן ריצה,
 * ולכן כל שדה שהמחלץ ממלא מטקסט חופשי יכול לחזור ברענון הבא בצורה
 * מנורמלת אחרת. שתי הצורות שנבדקות כאן הן צורות שהקטלוג **כבר משתמש
 * בהן** בשדות אחרים (`null` לשדה שלא נקרא, `badges` כהצהרה מנורמלת),
 * ולכן כישלון כאן פירושו "הרענון האחרון החזיר חבילה שאסור להשוות
 * מולה לבריכה", לא "מישהו שבר את הקוד".
 */

const PACKAGES = basePackages();

/** הרשומה האמיתית שעליה הבדיקה רצה — ולא אובייקט שהומצא כאן. */
function real(id) {
  const p = PACKAGES.find((x) => x.id === id);
  assert.ok(p, `רשומה ${id} אינה בקטלוג — הבדיקה איבדה את המקרה שלה`);
  return p;
}

test("בית: שירות סטרימינג נפסל גם כשהצהרת ה-TV יושבת ב-badges ולא ב-type", () => {
  // סטינג "החבילה המושלמת" — `hasInternet: true` בטעות (המחלץ קרא את
  // המילה "אינטרנט" בתיאור של שירות סטרימינג), ₪49, כלומר הזולה
  // בקטגוריה. היא נפסלת היום **רק** על `type === "TV"`.
  const sting = real("4");
  assert.equal(isComparable(sting, "home"), false);

  // אותה רשומה בדיוק, עם ההצהרה בצורה המנורמלת השנייה שהקטלוג
  // מכיר: `type` שלא נקרא ותג. היא חייבת להישאר בחוץ.
  const moved = { ...sting, type: null, badges: ["TV"] };
  assert.equal(isComparable(moved, "home"), false);

  // ולא רק "נפסלת" — היא גם לא נבחרת. ₪49 מול חשבון טריפל של ₪300
  // הוא חיסכון מוצג של ₪3,012 בשנה מול מוצר שאינו אינטרנט.
  const saving = computeSaving([...PACKAGES, moved], "home", 1, 300);
  assert.notEqual(saving.pick?.id, "4");
  assert.ok(
    saving.pick == null || saving.perLine >= 149,
    `נבחרה חבילת בית ב-${saving.perLine} ₪ — זולה מהזולה האמיתית בבריכה`,
  );
});

test("בית: הטיפוסים האמיתיים בקטלוג אינם נפסלים בגלל השער החדש", () => {
  // `includes("TV")` רחב מהשוואה מדויקת, ולכן השער הזה מוכיח שהוא לא
  // לוקח איתו את הבריכה: שתי חבילות הבית שעוברות היום ממשיכות לעבור.
  const pool = PACKAGES.filter((p) => isComparable(p, "home"));
  assert.ok(pool.length >= 2, `בריכת הבית התרוקנה — ${pool.length} חבילות`);
});

test("רשומה בלי שם קריא אינה בת-השוואה — חמשת שערי הנוסח מתעוורים עליה", () => {
  // הבסיס הוא **הבחירה האמיתית** של המנוע, ולכן רשומה שנגזרת ממנה
  // עוברת בוודאות את כל שערי הנוסח, המחיר וה-`spec` — ומה שנשאר
  // להיבדק הוא השם לבדו.
  const base = computeSaving(PACKAGES, "cellular", 1, 300).pick;
  assert.ok(base, "המנוע לא בחר חבילת סלולר — הבדיקה איבדה את הבסיס שלה");
  assert.equal(isComparable(base, "cellular"), true);

  // כל הצורות שהמחלץ יכול להחזיר לשדה טקסטואלי שלא נקרא, ועוד שתיים
  // שהן מחרוזת ריקה בפועל. `rawName` מאופס כדי שהבדיקה תתייחס ל-`name`
  // עצמו, כפי ש-`logicName` קוראת אותו.
  for (const name of [null, undefined, 5, 0, false, {}, [], "", "   "]) {
    const broken = { ...base, name, rawName: undefined };
    assert.equal(
      isComparable(broken, "cellular"),
      false,
      `name=${JSON.stringify(name)} עבר את isComparable`,
    );
  }

  // והמקרה שחשוב באמת: רשומה כזו במחיר הזול ביותר בקטלוג לא נבחרת,
  // כי אחרת הנציג מקבל "מול <ספק> — null".
  const cheapBroken = { ...base, name: null, rawName: undefined, id: "broken", price: 1 };
  assert.equal(base.priceAfterPromo, null, "הבסיס שונה ממה שהבדיקה מניחה");
  const saving = computeSaving([...PACKAGES, cheapBroken], "cellular", 1, 300);
  assert.ok(saving.pick == null || typeof logicName(saving.pick) === "string");
  assert.notEqual(saving.perLine, 1);
});
