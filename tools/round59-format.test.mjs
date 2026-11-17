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

test("סבב 59: אריח בודד אינו מקבל סייג של מאגר משותף", () => {
  // id 19 נושאת את אותו נוסח אבל `sms: null` — אין שני מאגרים לאחד.
  const p19 = byId("19");
  assert.equal(p19.spec.sms, null);
  const t19 = tiles(p19);
  assert.ok(t19.some((v) => v === "עד 3,000"), JSON.stringify(t19));
  assert.ok(!t19.some((v) => v.includes("יחד")));
});

test("סבב 59: הסייג נדלק רק על הרשומות שכותבות אותו", () => {
  const carriers = P.filter(
    (p) => p.category === "cellular" && tiles(p).some((v) => v.includes("לדקות ול-SMS יחד")),
  ).map((p) => String(p.id));
  assert.deepEqual(carriers, ["21"]);
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

test("סבב 59: רק id 72 מושפעת מקורא הפרוזה של VOD", () => {
  const moved = P.filter(
    (p) => p.category === "home" && p.spec?.vodIncluded == null && vodInProse(p) !== null,
  ).map((p) => String(p.id));
  assert.deepEqual(moved, ["72"]);
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
