import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { detailRows, heroRiseLine, PROMO_PERIOD_TEXT } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ סבב 37 — שני שערים שחוברו לשדה אחד ולא לשדה שלידו, ושני נוסחים
 * של אותו ענף שהתפצלו בין המשטחים:
 *   • `routerIncluded: false` הודפס "אינו כלול במחיר" בזמן שהפרוזה
 *     מסרה את מחיר הנתב (0 ב-id 81, 20 ועם הטבה ב-ids 158/104) —
 *     בדיוק הפגם שתוקן לשורת ההתקנה, על השדה שמתחתיה.
 *   • `lineTiers` הדפיס סקלר כשוויון בזמן שכל ארבע הרשומות מוסרות
 *     טווח ("2-3 מנויים", "4 מנויים ויותר", "עד 2 מנויים כולל").
 *   • `heroRiseLine` ו-`CompareTray` ניסחו את ענף `period` בשני נוסחים
 *     משלהם, בזמן ש-`PROMO_PERIOD_TEXT` מצהיר על עצמו כנוסח היחיד.
 *
 * ⚠️ חלק מהבדיקות על הקטלוג החי (כל הפגמים חיים ב-14.8.2026) וחלק על
 * רשומות מסונתזות — מלכודות לרענון הבא, שהקטלוג של היום נקי מהן.
 */

const live = listable(basePackages());
const byId = (id) => {
  const p = live.find((x) => x.id === id);
  assert.ok(p, `id ${id} אינו בקטלוג החי — עדכן את הבדיקה, לא את הקוד`);
  return p;
};
const rowValue = (id, label) => detailRows(byId(id)).find((r) => r.label === label)?.value;

test("נתב: 0 ש״ח בפרוזה אינו 'אינו כלול במחיר'", () => {
  assert.equal(rowValue("81", "נתב"), "ללא עלות");
});

test("נתב: מחיר והטבה — שני הצדדים, כמו שורת ההתקנה", () => {
  for (const id of ["158", "104"]) {
    assert.equal(rowValue(id, "נתב"), "₪20 בתוספת למחיר · ללא עלות למשך שנה");
  }
});

test("נתב: בלי מספר בפרוזה השלילה נשארת — לא ממציאים מחיר", () => {
  const pkg = {
    ...byId("158"),
    description: "חבילת אינטרנט ביתי",
    benefits: "",
    spec: { ...byId("158").spec, routerIncluded: false },
  };
  assert.equal(
    detailRows(pkg).find((r) => r.label === "נתב")?.value,
    "אינו כלול במחיר",
  );
});

test("נתב: `true` ממשיך לומר 'כלול במחיר'", () => {
  const withRouter = live.find((p) => p.spec?.routerIncluded === true);
  assert.ok(withRouter, "אין בקטלוג רשומה עם נתב כלול — עדכן את הבדיקה");
  assert.equal(
    detailRows(withRouter).find((r) => r.label === "נתב")?.value,
    "כלול במחיר",
  );
});

test("מדרגות קווים: הטווח שהרשומה מסרה, ולא שוויון", () => {
  /*
   * ⚠️ סבב 46 הוסיף את מגדיר ה**זמן** לשתי הרשומות שהפרוזה שלהן
   * מגבילה את מחירי המדרגות בתקופה: id 57 ("למשך שנה") ו-id 36
   * ("למשך 13 מחזורי החיוב הראשונים", שגם מוסרת במפורש ₪64.90 לאותה
   * מדרגה אחרי שנה). השורה הדפיסה מחירי מבצע כמחירון קבע, ולכן
   * המחרוזת כאן התארכה — המדרגות והמספרים עצמם לא זזו.
   *
   * ids 37 ו-68 הן הבקרה ונשארו כפי שהיו: 37 אינה מגבילה בזמן,
   * ו-68 מצהירה "המחיר קבוע – לכל החיים!".
   */
  assert.equal(rowValue("57", "מחיר לפי מספר קווים"), "2–3 קווים ₪33 · 4 קווים ומעלה ₪30 (למשך שנה)");
  assert.equal(rowValue("36", "מחיר לפי מספר קווים"), "עד 2 קווים ₪39.9 · 3 קווים ומעלה ₪34.9 (למשך 13 מחזורי החיוב הראשונים)");
  assert.equal(rowValue("37", "מחיר לפי מספר קווים"), "עד 2 קווים ₪59.9 · 3 קווים ומעלה ₪54.9");
  assert.equal(rowValue("68", "מחיר לפי מספר קווים"), "2 קווים ₪44.9 · 3 קווים ומעלה ₪39.9");
});

test("מדרגות קווים: בלי תבנית בפרוזה — שוויון, לא ניחוש", () => {
  const pkg = { ...byId("68"), description: "תוכנית סלולר", benefits: "" };
  assert.equal(detailRows(pkg).find((r) => r.label === "מחיר לפי מספר קווים")?.value, "2 קווים ₪44.9 · 3 קווים ₪39.9");
});

test("מדרגות קווים: 'קו אחד ומעלה' ולא '1 קווים ומעלה'", () => {
  const base = byId("68");
  const pkg = {
    ...base,
    description: "קו אחד ומעלה – 44.90 ₪",
    benefits: "",
    spec: { ...base.spec, lineTiers: [{ lines: 1, price: 44.9 }] },
  };
  assert.equal(detailRows(pkg).find((r) => r.label === "מחיר לפי מספר קווים")?.value, "קו אחד ומעלה ₪44.9");
});

test("מדרגות קווים: מספר שיושב בתוך מחיר אינו נקרא כמדרגה", () => {
  const base = byId("68");
  const pkg = {
    ...base,
    description: "המחיר 33 ₪ לקו",
    benefits: "",
    spec: { ...base.spec, lineTiers: [{ lines: 3, price: 33 }] },
  };
  assert.equal(detailRows(pkg).find((r) => r.label === "מחיר לפי מספר קווים")?.value, "3 קווים ₪33");
});

test("ענף `period`: פס ההירו מצטט את הנוסח היחיד", () => {
  const periodPkg = live.find((p) => heroRiseLine(p) === PROMO_PERIOD_TEXT);
  assert.ok(periodPkg, "אין בקטלוג רשומה בענף `period` — עדכן את הבדיקה");
  assert.equal(heroRiseLine(periodPkg), PROMO_PERIOD_TEXT);
});
