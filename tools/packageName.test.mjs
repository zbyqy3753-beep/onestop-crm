import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, displayName, logicName } from "../src/app/lp/catalog/catalog.ts";
import { isComparable } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ הבדיקה רצה מול הקטלוג האמיתי ולא מול דוגמאות מומצאות: השמות
 * מגיעים ממחלץ שמריצים מחדש בכל רענון, והתקלות שנוקו כאן (`[line]`,
 * `*2*`, רווח כפול) הן שאריות שלו — כלומר בדיוק הדברים שחוזרים
 * מעצמם בפעם הבאה שמישהו ימשוך את הקטלוג.
 */

test("מפריד השורות של המחלץ אינו נשאר בכותרת", () => {
  assert.equal(
    displayName("סלקום משפחתי פלוס [line] חבילה זו מיועדת לבעלי כרטיס אשראי בלבד"),
    "סלקום משפחתי פלוס",
  );
});

test("סימון פנימי מספרי בכוכביות נמחק, אות נשארת בסוגריים", () => {
  assert.equal(displayName("Valentine's *2*"), "Valentine's");
  assert.equal(displayName("*2* 3 קווים ב99"), "3 קווים ב99");
  assert.equal(displayName("פייבר פלוס *IBC*"), "פייבר פלוס (IBC)");
});

test("רווח כפול מתכווץ", () => {
  assert.equal(displayName("BASIC דור 5  בחודשיים הראשונים"), "BASIC דור 5 בחודשיים הראשונים");
  assert.equal(displayName("עובדים  מבית 15%"), "עובדים מבית 15%");
});

test("שם שאין בו שאריות אינו משתנה", () => {
  assert.equal(displayName("גולן טלקום 100GB"), "גולן טלקום 100GB");
});

test("ניקוי שמוחק את כל השם מוותר ומחזיר את המקור", () => {
  assert.equal(displayName("*2*"), "*2*");
  assert.equal(displayName("[line] תנאים"), "[line] תנאים");
});

test("אף חבילה בקטלוג אינה מציגה שארית מחלץ", () => {
  const dirty = basePackages().filter((p) => /\[line\]|\*|\s{2,}/.test(p.name));
  assert.deepEqual(dirty.map((p) => `${p.id}:${p.name}`), []);
});

test("ניקוי התצוגה אינו מוחק את הראיה שלוגיקה צריכה", () => {
  /*
    ⚠️ הבדיקה הזו נכתבה אחרי שהניקוי הוחל בתוך
    `basePackages` ומחק את `*2*` — הסימון היחיד שמעיד ש-"4 ב 130"
    הוא מחיר של קו שני בחבילה של ארבעה. החבילה נכנסה לבריכת
    ההשוואה והכותרת נבנתה על ₪32 לקו בודד.
  */
  // שתי רשומות נקראות "4 ב 130"; רק לשנייה יש את הסימון.
  const four = basePackages().find((p) => logicName(p).includes("4 ב 130 *2*"));
  assert.ok(four, "לא נמצאה בקטלוג: 4 ב 130 *2*");
  assert.equal(four.rawName, "4 ב 130 *2*");
  assert.equal(four.name, "4 ב 130");
  assert.equal(isComparable(four, four.category), false);
});
