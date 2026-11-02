import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { cardStats, detailRows, dataLabel } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ סבב 50 — שלוש הסתייגויות שהרשומה מסרה ושלא הודפסו, כולן אותו
 * דפוס: מגדיר אחד במשפט הודפס והמגדיר השכן שיושב באותו משפט נעלם.
 *
 *   • דקות חו״ל: ההערה על האריח מצטטת את משפט id 110 **כולל**
 *     `(אופציונלי)`, ותיקנה ממנו רק את חצי ה-"עד".
 *   • נפח id 27: `עד` הודפס, `לשלושת הקווים יחד` נעלם.
 *   • `spec.allHours` נקרא כטרות'יני, בניגוד לאחות שבאותו סבב
 *     ביקורת (`electricityRank`) שההערה שלה מצביעה על הקוראת הזו.
 */

const PKGS = listable(basePackages());
const byId = (id) => PKGS.find((p) => String(p.id) === id);
const intlRow = (p) => detailRows(p).find((r) => /חו/.test(r.label));

/** שבע הרשומות שמוכרות את דקות חו״ל כתוסף בתשלום. */
const OPTIONAL_INTL = ["110", "42", "54", "64", "65", "66", "69"];

test("דקות חו״ל שהרשומה מוכרת כתוסף מסויגות כתוסף", () => {
  for (const id of OPTIONAL_INTL) {
    const row = intlRow(byId(id));
    assert.ok(row, `id ${id} אינו מדפיס שורת דקות חו״ל`);
    assert.match(row.value, / · בתוספת תשלום$/, `id ${id} מדפיס את הדקות כתכולה`);
  }
});

test("דקות שכן כלולות אינן מסויגות — אפס false positives", () => {
  /*
   * ⚠️ `אופציונלי`/`מותנה בשימוש` בלבד, ולא `בתוספת עלות` לבדה:
   * השנייה חיה בקטלוג גם על נתב ועל דמי שימוש לקו.
   */
  for (const id of ["129", "31", "91", "67", "68", "26", "28", "34", "35", "40"]) {
    const row = intlRow(byId(id));
    assert.ok(row, `id ${id} אינו מדפיס שורת דקות חו״ל`);
    assert.doesNotMatch(row.value, /בתוספת תשלום/, `id ${id} סויג בלי שהרשומה הצהירה`);
  }
});

test("השוואת 110 מול 28 אינה מציגה שתי עובדות שונות כזהות", () => {
  /*
   * שתי הרשומות מוסרות 100 דקות חו״ל, אבל ב-28 (₪34) הן כלולות
   * וב-110 (₪35) הן תוסף של ₪5.90 לחודש. הטבלה הדפיסה
   * `"עד 100" ‖ "100"`.
   */
  assert.equal(intlRow(byId("110")).value, "עד 100 · בתוספת תשלום");
  assert.equal(intlRow(byId("28")).value, "100");
});

const dataTile = (p) => cardStats(p).find((s) => s.caption === "גלישה בישראל");

test("נפח שהרשומה מסרה לכל הקווים יחד אינו מודפס כנפח החבילה", () => {
  /*
   * id 27 (`3 קווים ב99`) אומרת "ועד 1500GB גלישה לשלושת הקווים
   * יחד" — כלומר 500GB לקו — בזמן שב-id 37 אותם 1500GB הם לכל קו.
   */
  assert.equal(dataTile(byId("27")).value, "עד 1,500GB · לכל הקווים יחד");
  assert.equal(dataTile(byId("37")).value, "1,500GB");
});

test("`dataLabel` נשארת המספר החשוף — אינווריאנט 22 התווים של הסטודיו", () => {
  /*
   * ⚠️ ההסתייגות מוצמדת באריח ולא ב-`dataLabel`, כי אותה פונקציה
   * מוזנת לסטודיו הפוסטים ושם `renderSlide` מצייר את הערך ב-`fillText`
   * יחיד בלי `wrap` — 27 תווים היו יוצאים מהכרטיס בשקף.
   * `round34-format` אוכף את התקרה הזו על כל הקטלוג.
   */
  assert.equal(dataLabel(byId("27"), byId("27").spec), "עד 1,500GB");
  for (const p of PKGS) {
    const l = p.category === "cellular" ? dataLabel(p, p.spec) : null;
    if (l) assert.ok(l.length <= 22, `id ${p.id}: "${l}"`);
  }
});

test("זה הניסוח היחיד מסוגו — הסיומת אינה נתלית באף רשומה אחרת", () => {
  const tagged = PKGS.filter(
    (p) => p.category === "cellular" && /יחד/.test(dataTile(p)?.value ?? ""),
  ).map((p) => String(p.id));
  assert.deepEqual(tagged, ["27"]);
});

test("`allHours` נקרא כבוליאן, כמו באחות ב-`electricityRank`", () => {
  /*
   * ⚠️ רדום: כל 19 רשומות החשמל נושאות בוליאנים אמיתיים. השער הוא
   * לרענון הבא — `"false"` כמחרוזת הוא **אמת** ב-JS, ואז הכרטיס
   * הכריז "ההנחה חלה כל השעות" על מסלול לילה, המחרוזת שהרשומה כן
   * מסרה נעלמה משני המשטחים (`hoursTiled` חוסם את השורה כשהאריח
   * נדלק), ו-`electricityRank` המשיך לקנוס אותה כחלקי-שעות.
   */
  const p = structuredClone(byId("150"));
  p.spec.allHours = "false";
  const stats = cardStats(p);
  assert.ok(
    !stats.some((s) => s.value === "כל השעות"),
    "דגל שאינו בוליאן הדליק את אריח 'כל השעות'",
  );
  assert.ok(
    stats.some((s) => s.value === p.spec.hoursText),
    "שעות ההנחה שהרשומה מסרה נעלמו",
  );
});
