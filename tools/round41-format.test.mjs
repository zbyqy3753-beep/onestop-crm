import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { detailRows } from "../src/app/lp/catalog/format.ts";
import { routerPricedSeparately } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 41, שורת הנתב בכרטיס — אותו חור של `ROUTER_PRICED_SEPARATELY`,
 *   רמה אחת למעלה ובשני צירים:
 *     • `routerDetail` הכירה את הצורה `עלות נתב <מספר>` לבדה, ולכן ids
 *       85 ("נתב פייבר בהשכרה **בתוספת** 25 ₪ לחודש") ו-124 ("**ראווטר
 *       בעלות** 20 שח לחודש") קיבלו אפס שורות על הנתב.
 *     • והקורא רץ רק על `routerIncluded === false`, בזמן ששתי הרשומות
 *       האלה נושאות `null` — כלומר גם רגקס מורחב לבדו לא היה משנה דבר.
 *
 * ההוכחה שזו אסימטריה ולא החלטה: `routerPricedSeparately` **כן** פוסלת
 * את id 85 מההשוואה, כלומר המנוע ידע על החיוב בדיוק כשהכרטיס שתק עליו.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));
const routerRow = (id) => detailRows(byId(id)).find((r) => r.label === "נתב")?.value ?? null;

test("סבב 41: שתי הרשומות שהפרוזה שלהן מסרה תוספת חודשית על הנתב אומרות אותה", () => {
  // id 85: סדר מילים הפוך (`נתב … בתוספת`), `routerIncluded: null`.
  assert.equal(byId("85").spec.routerIncluded, null);
  assert.equal(routerRow("85"), "₪25 בתוספת למחיר");

  // id 124: איות אחר של הציוד ו-"בעלות" במקום "עלות", `routerIncluded: null`.
  assert.equal(byId("124").spec.routerIncluded, null);
  assert.equal(routerRow("124"), "₪20 בתוספת למחיר");
});

test("סבב 41: הכרטיס אינו מאחורי המנוע על אותה רשומה", () => {
  // ⚠️ זה הנימוק לתיקון: המנוע פוסל את 85, והכרטיס היה שותק עליה.
  assert.equal(routerPricedSeparately(byId("85")), true);
  assert.notEqual(routerRow("85"), null);
});

test("סבב 41: שלוש השורות שהיו מודפסות לא השתנו, ואף שורה לא נעלמה", () => {
  // ⚠️ המספר **וגם** הטקסט: הרחבת הרגקס לא הזיזה אותם.
  assert.equal(routerRow("158"), "₪20 בתוספת למחיר · ללא עלות למשך שנה");
  assert.equal(routerRow("104"), "₪20 בתוספת למחיר · ללא עלות למשך שנה");
  assert.equal(routerRow("81"), "ללא עלות");

  // ⚠️ ו-`routerIncluded: true` ממשיך לומר "כלול במחיר" (ועם התוספת
  // שהרשומה תלתה בהכללה עצמה, כשיש כזו) — הצד שלא נגענו בו.
  assert.equal(routerRow("157"), "כלול במחיר");
  assert.equal(routerRow("92"), "כלול במחיר · בתוספת ₪4.9 לחודש");
});

test("סבב 41: רשימת הרשומות שמקבלות שורת נתב", () => {
  const withRouterRow = live
    .filter((p) => detailRows(p).some((r) => r.label === "נתב"))
    .map((p) => String(p.id))
    .sort();

  /*
   * ⚠️ סבב 42 הוסיף את id 114, ובמכוון: הרשומה מוסרת
   * "199 ש״ח לא כולל נתב … 220 שח כולל נתב" — אותה עובדה
   * בניסוח של הפרש בין שני מחירים, שאין בה אף אחת ממילות
   * העלות ש-`ROUTER_COST` מחפש. זה בדיוק הפער שהבדיקה
   * שמעל מתארת ("הכרטיס אינו מאחורי המנוע"), רק על רשומה
   * נוספת: `routerPricedSeparately(114)` הוא `true` ו-`savings.test.mjs`
   * מקבע אותו בשם, והכרטיס שתק.
   */
  assert.deepEqual(
    withRouterRow,
    ["102", "104", "107", "108", "109", "114", "124", "157", "158", "70", "71", "72", "81", "85", "92"].sort(),
  );

  // והשורה מצטטת את המחיר שהרשומה מסרה, ולא הפרש שחישבנו.
  assert.equal(routerRow("114"), "המחיר אינו כולל נתב · ₪220 לחודש עם נתב");
});
