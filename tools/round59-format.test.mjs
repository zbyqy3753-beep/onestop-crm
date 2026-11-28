import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { cardStats, compareRows, vodInProse } from "../src/app/lp/catalog/format.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const tiles = (p) => cardStats(p).map((s) => s.value);
const rowOf = (pkgs, label) =>
  compareRows(pkgs).find((r) => r.label === label) ?? null;

/*
 * סבב 59, `format.ts`.
 *
 * שלושה מקומות שבהם הדף אמר על הרשומה משהו שהרשומה לא אמרה.
 */

test("סבב 59: מאגר שימוש משותף אינו נקרא פעמיים כשני מאגרים", () => {
  // id 21 מוסרת "עד 5,000 יחידות שימוש **מכל סוג**" — מאגר אחד לדקות
  // ול-SMS. קודם הכרטיס הדפיס "עד 5,000" פעמיים, כלומר הבטיח 10,000.
  const p21 = byId("21");
  assert.equal(p21.spec.minutes, 5000);
  assert.equal(p21.spec.sms, 5000);
  const t21 = tiles(p21);
  assert.ok(
    t21.filter((v) => v.includes("לדקות ול-SMS יחד")).length === 2,
    `שני האריחים אמורים לשאת את הסייג: ${JSON.stringify(t21)}`,
  );
  // והמספר שהרשומה מסרה לא נמחק.
  assert.ok(t21.some((v) => v.startsWith("עד 5,000")));
});

test("סבב 59: שתי תקרות נפרדות באמת נשארות שתיים", () => {
  // id 17 כותבת "עד 5,000 דקות זמן אוויר" ו-"עד 5,000 הודעות" —
  // שני מאגרים, ולכן אסור שיקבלו את הסייג.
  const t17 = tiles(byId("17"));
  assert.ok(!t17.some((v) => v.includes("יחד")), JSON.stringify(t17));
});

/*
 * ⚠️ **התהפך בסבב 67.** הנימוק כאן היה "אין שני מאגרים לאחד" —
 * נימוק לא לכתוב `יחד` על אריח שאינו מרונדר, אבל לא נימוק להשתיק
 * את האריח שכן מרונדר. id 19 מצהירה מילה במילה את מה שid 21
 * מצהירה (`עד 3,000 יחידות שימוש מכל סוג לכל מחזור חיוב`), ולכן
 * האריח הדפיס `עד 3,000 דקות שיחה` כמאגר דקות משלה בזמן שהרשומה
 * חוסמת 3,000 שיחות **והודעות יחד**. ראה `tools/round67-format.test.mjs`.
 */
test("סבב 59→67: אריח בודד כן מקבל סייג של מאגר משותף", () => {
  const p19 = byId("19");
  assert.equal(p19.spec.sms, null, "הנתון שהממצא נמדד עליו");
  const t19 = tiles(p19);
  assert.ok(t19.some((v) => v === "עד 3,000 · לדקות ול-SMS יחד"), JSON.stringify(t19));
});

test("סבב 59: הסייג נדלק רק על הרשומות שכותבות אותו", () => {
  const carriers = P.filter(
    (p) => p.category === "cellular" && tiles(p).some((v) => v.includes("לדקות ול-SMS יחד")),
  ).map((p) => String(p.id));
  /*
   * ⚠️ id 19 נוספה בסבב 67 — היא **כותבת** את ההצהרה, וזה בדיוק מה
   * שהבדיקה הזו מודדת. הקבוצה נשארת שתי הרשומות היחידות בקטלוג
   * שנושאות את הנוסח `יחידות שימוש`.
   */
  assert.deepEqual(carriers.sort(), ["19", "21"]);
});

test("סבב 59: VOD שהרשומה שוללת בשמה אינו `—` בטבלה", () => {
  const p72 = byId("72");
  assert.match(String(p72.name), /ללא VOD/);
  assert.equal(p72.spec.vodIncluded, null, "הדגל ריק — הראיה היא בשם");
  assert.equal(vodInProse(p72), false);

  const row = rowOf([byId("71"), p72], "VOD");
  assert.ok(row, "שורת VOD אמורה להופיע");
  // קודם: ["כלול במחיר", "—"] — הטבלה הכחישה עובדה שהשם מוסר.
  assert.deepEqual(row.values, ["כלול במחיר", "אינו כלול במחיר"]);
});

test("סבב 59: הפרוזה אינה גוברת על דגל מוצהר, ואינה קוראת שלילה כהכללה", () => {
  // `ללא VOD` מכיל את המילה VOD — שער חיובי רופף היה הופך את השלילה.
  assert.equal(vodInProse({ name: "1000/100 ללא VOD" }), false);
  assert.equal(vodInProse({ name: "1000/100 כולל VOD" }), true);
  assert.equal(vodInProse({ name: "לא כולל VOD" }), false);
  assert.equal(vodInProse({ name: "סיבים 1000/100" }), null);

  // ואין בקטלוג רשומה שבה הפרוזה סותרת דגל מוצהר.
  const clashes = P.filter((p) => {
    const v = vodInProse(p);
    return p.spec?.vodIncluded != null && v !== null && v !== p.spec.vodIncluded;
  }).map((p) => String(p.id));
  assert.deepEqual(clashes, []);
});

/*
 * ⚠️ עודכן בסבב 60: היו `["72"]`, ועכשיו `["89", "72"]`.
 *
 * סבב 59 חיבר ל-`vodIncluded` קורא פרוזה, ובצד החיובי דרש שה-VOD
 * יהיה **צמוד** ל"כולל". id 89 כותבת את ההכללה כרשימה ("חבילת
 * טלוייזיה הכוללת ערוצים + vod") ולכן נשארה מחוץ לשער, ושורת
 * ה-VOD שלה הודפסה `—` בטבלה דווקא ליד id 71 ("כלול במחיר")
 * ו-id 72 ("אינו כלול במחיר"). סבב 60 התיר פריט ביניים אחד,
 * נקוב בשמו, בדיוק כמו `EXTENDER_INCLUDED_BARE`.
 *
 * המספר שזז הוא **תוספת** של שורה אחת ולא שינוי של שורה קיימת:
 * 72 ממשיכה להחזיר `false` (`VOD_EXCLUDED` נבדק ראשון), ו-70/71
 * ממשיכות לקרוא את השדה. ראה `round60-format.test.mjs`.
 */
test("סבב 59: רק ids 89 ו-72 מושפעות מקורא הפרוזה של VOD", () => {
  const moved = P.filter(
    (p) => p.category === "home" && p.spec?.vodIncluded == null && vodInProse(p) !== null,
  ).map((p) => String(p.id));
  assert.deepEqual(moved, ["89", "72"]);
});

test("סבב 59: `מחזורי חיוב` ו`מחזורי החיוב` הם אותו ביטוי בשני השערים", () => {
  // שתי האיותים חיים בקטלוג: id 36 עם ה', ids 1 ו-2 בלעדיה.
  const spell = (id) =>
    [byId(id).logicName, byId(id).description, byId(id).benefits, byId(id).priceAfterPromoNote]
      .filter(Boolean)
      .join(" ");
  assert.match(spell("36"), /מחזורי\s+החיוב/);
  assert.match(spell("2"), /מחזורי\s+חיוב/);
  // השער המאוחד קורא את שתיהן.
  const unified = /מחזורי\s+ה?חיוב/;
  assert.ok(unified.test("למשך 13 מחזורי החיוב הראשונים"));
  assert.ok(unified.test("למשך 24 מחזורי חיוב עבור כל מנוי"));
});
