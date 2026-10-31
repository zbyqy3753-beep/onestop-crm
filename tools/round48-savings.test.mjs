import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  isComparable,
  afterPriceDependsOnLines,
  requiresMultipleLines,
  declaresRiseInText,
  computeSaving,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 48 — שלוש אסימטריות נוסח במנוע, כולן אותו דפוס: שער שמכיר
 * הצהרה בצורה אחת ומפספס את הצורה השכנה שחיה בקטלוג.
 *
 *   • `למצרפים` / `למצטרפים` לא נמנו לצד `בהצטרפות` / `בצירוף`
 *     באף אחד משלושת שערי הקווים — בזמן ש-`למצרפים` הוא הניסוח של
 *     id 57 מילה במילה ו-`למצטרפים` חי ב-id 54. גם הכמות לא הייתה
 *     טווח, ו-id 57 מנסחת את המדרגה הראשונה כ-"2-3 מנויים".
 *   • `מנווים` — שגיאת הכתיב החיה ב-id 53 — נוספה ל-`PRICED_BY_LINE_COUNT`
 *     בסבב 46 ולא לשני השערים האחרים שנושאים את אותה רשימת יחידות.
 *     אותו דבר על `ומעל`, הצורה הרביעית של `ומעלה`.
 *   • `לתקופה של` נשאר עם ספרה לבדה, בזמן ש-`למשך` ו-
 *     `(?:מובטח|תקף|קבוע) ל` קיבלו גם `שנה` ו-`שנתיים`.
 */

const PKGS = basePackages();
/** נושא ניטרלי: החבילה הזולה בסלולר, בלי מדרגות ובלי הצהרות. */
const carrier = () => structuredClone(PKGS.find((p) => p.id === "121"));

function probe(text, { price = 24.9, after = 24.9 } = {}) {
  const p = carrier();
  p.id = "TEST";
  p.name = "בדיקה";
  p.price = price;
  p.priceAfterPromo = after;
  p.description = text;
  return p;
}

test("סבב 48: `למצרפים` ו-`למצטרפים` הן אותה הצהרה כמו `בהצטרפות`", () => {
  // התצורה של id 57: המדרגה נקובה במספר **אחר** מהכותרת, ולכן
  // `headlineIsLineTierPrice` אינו תופס אותה והחלופה הזו היא היחידה.
  const head = "24.9 ₪ למנוי. ";
  for (const word of ["בהצטרפות", "בצירוף", "למצרפים", "למצטרפים"]) {
    const p = probe(`${head}${word} 4 מנויים 22 ₪`);
    assert.equal(afterPriceDependsOnLines(p), true, word);
    assert.equal(isComparable(p, "cellular"), false, word);
  }
});

test("סבב 48: הכמות היא טווח — `למצרפים 2-3 מנויים`, הניסוח של id 57", () => {
  for (const q of ["2-3", "2 - 3", "2–3"]) {
    const p = probe(`24.9 ₪ למנוי. למצרפים ${q} מנויים – 22 ₪`);
    assert.equal(afterPriceDependsOnLines(p), true, q);
    assert.equal(isComparable(p, "cellular"), false, q);
  }
});

test("סבב 48: `מנווים` נקרא כיחידה בכל שלושת שערי הקווים", () => {
  // "4 מנויים ב 130" — מחיר חבילת ארבעה שנרשם כמחיר קו בודד.
  for (const unit of ["קווים", "מנויים", "מנווים"]) {
    const p = probe(`4 ${unit} ב 130`, { price: 32, after: null });
    assert.equal(requiresMultipleLines(p), true, unit);
    assert.equal(isComparable(p, "cellular"), false, unit);
  }
});

test("סבב 48: `ומעל` היא אותה מילה כמו `ומעלה` — הניסוח של id 53", () => {
  for (const w of ["ומעלה", "ומעל", "ויותר", "ואילך"]) {
    const p = probe(`קו בודד 49.9 ₪. 3 מנויים ${w} – 24.9 ₪ לקו`, { after: null });
    assert.equal(requiresMultipleLines(p), true, w);
  }
});

test("סבב 48: `לתקופה של שנה` היא הצהרת עלייה כמו `לתקופה של 12 חודשים`", () => {
  for (const period of ["12 חודשים", "שנה", "שנתיים"]) {
    const p = probe(`מחיר 24.9 לתקופה של ${period}`, { after: null });
    assert.equal(declaresRiseInText(p), true, period);
    assert.equal(isComparable(p, "cellular"), false, period);
  }
});

test("סבב 48: שלוש ההרחבות אינן מזיזות את הבריכה ואת הבחירות", () => {
  // נמדד לפני ולאחרי כל שינוי במנוע: שני המסלולים × 1..10 קווים.
  assert.deepEqual(
    PKGS.filter((p) => isComparable(p, "cellular")).map((p) => p.id),
    ["91", "65", "66", "90", "93", "116", "117", "121", "25", "30", "35"],
  );
  assert.deepEqual(
    PKGS.filter((p) => isComparable(p, "home")).map((p) => p.id),
    ["157", "3"],
  );
  // קו אחד מגיע ל-121 ב-₪34, ושניים ומעלה ל-117 ב-₪29.9.
  assert.equal(computeSaving(PKGS, "cellular", 1, 220).pick.id, "121");
  assert.equal(computeSaving(PKGS, "cellular", 1, 220).perLine, 34);
  for (let lines = 2; lines <= 10; lines++) {
    const s = computeSaving(PKGS, "cellular", lines, 400);
    assert.equal(s.pick.id, "117", `lines=${lines}`);
    assert.equal(s.perLine, 29.9, `lines=${lines}`);
  }
  assert.equal(computeSaving(PKGS, "home", 1, 400).pick.id, "157");
  assert.equal(computeSaving(PKGS, "home", 1, 400).perLine, 149);
});
