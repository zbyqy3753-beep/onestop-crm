import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { detailRows, heroRiseLine, priceNote, promoNoteRises, promoRise } from "../src/app/lp/catalog/format.ts";
import { addonFreeThenPaid, requiresMultipleLines, routerPricedSeparately } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 42 — שלושה משטחים שאמרו על הרשומה משהו שהיא לא מסרה:
 *
 *   • שורת הנתב שתקה על id 114, שמוסרת את עלות הנתב כהפרש
 *     בין שני מחירים במקום במילת עלות — בזמן שהמנוע פוסל אותה
 *     מהמחשבון בגלל אותה עלות בדיוק.
 *   • "המחיר מותנה בכמות המנויים" הודפס על id 42, שהרשומה
 *     שלו אומרת במפורש ש-₪39.9 הוא דווקא המחיר למנוי בודד.
 *   • "בתום ההטבה" הודפס על id 83, שהנוסח שלו מדבר על חבילת
 *     דקות אופציונלית, ומספר הדקות (200) התחזה לכסף.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));
const routerRow = (id) => detailRows(byId(id)).find((r) => r.label === "נתב")?.value ?? null;

test("סבב 42: הכרטיס אומר את עלות הנתב שהרשומה מסרה כהפרש בין מחירים", () => {
  const p = byId("114");
  assert.ok(p, "id 114 חיה בקטלוג");
  // זה הנימוק: המנוע יודע, והכרטיס שתק.
  assert.equal(routerPricedSeparately(p), true);
  assert.equal(routerRow("114"), "המחיר אינו כולל נתב · ₪220 לחודש עם נתב");

  // המספר מצוטט ולא מחושב: ההפרש (₪21) אינו מופיע בשורה.
  assert.equal(routerRow("114").includes("21"), false);

  /*
   * והאחות שהמחיר שלה **כן** כולל נתב לא קיבלה שורה מומצאת.
   *
   * ⚠️ סבב 44 שינה כאן `null` ל-"כלול במחיר". הכוונה המקורית נשמרת
   * במלואה — "לא לייצר מספר שהרשומה לא מסרה" — והיא מקובעת בשורה
   * שמתחת: השורה של 113 אינה נוקבת בשום סכום. מה שהשתנה הוא שהשתיקה
   * עצמה התגלתה כפגם ולא כזהירות: 113 כותבת "179ש״ח כולל נתב"
   * במפורש, וה-`null` הזה הודפס בטבלת ההשוואה כ-`"—"` דווקא ליד
   * 114 שכן מקבלת שורה מלאה — כלומר הגולש קרא פער של ₪20 בין
   * שתיהן, בזמן שהפער כששתיהן עם נתב הוא ₪41 (179 מול 220). ראה
   * `ROUTER_INCLUDED_PRICE` ב-`format.ts` ו-`tools/round44-format.test.mjs`.
   */
  assert.equal(routerPricedSeparately(byId("113")), false);
  assert.equal(routerRow("113"), "כלול במחיר");
  assert.equal(/\d/.test(routerRow("113")), false, "אין מספר מומצא בשורה");
});

test("סבב 42: הסתייגות הכמות נאמרת רק כשהתנאי חל על המחיר שלידו", () => {
  // id 42: ₪39.9 הוא מחיר המנוי הבודד — המחיר המותנה הוא ₪30.
  const p42 = byId("42");
  assert.equal(p42.price, 39.9);
  assert.ok(p42.description.includes("מנוי בודד 39.90"));
  assert.equal(priceNote(p42), null);
  // השער המנועי לא נגע: הרשומה עדיין מתמחרת לפי כמות.
  assert.equal(requiresMultipleLines(p42), true);

  // id 110: אותה הצהרה בדיוק, אבל ₪35 הוא המחיר המותנה — הסתייגות נשארת.
  const p110 = byId("110");
  assert.equal(p110.price, 35);
  assert.ok(p110.description.includes("מנוי בודד 39.90"));
  assert.equal(priceNote(p110)?.value, "המחיר מותנה בכמות המנויים בחבילה");

  // id 68: הבודד הוא 49.90 ו-`price` הוא 39.9 — גם כאן הסתייגות במקומה.
  assert.notEqual(priceNote(byId("68")), null);
});

test("סבב 42: נוסח של תוסף אינו מיוחס למחיר שאחרי ההטבה", () => {
  const p = byId("83");
  const note = promoRise(p).note;
  assert.ok(note.includes("200 דקות"));
  // המנוע כבר יודע שזה תוסף.
  assert.equal(addonFreeThenPaid(p), true);
  assert.equal(promoNoteRises(p, note), false);
  // המידע לא נמחק — הוא מצוטט במלואו.
  const line = heroRiseLine(p);
  assert.ok(line.includes(note));
  assert.equal(line.startsWith("בתום ההטבה"), false);
});
