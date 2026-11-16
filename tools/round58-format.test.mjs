import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, logicName } from "../src/app/lp/catalog/catalog.ts";
import { compareRows, detailRows, priceNote } from "../src/app/lp/catalog/format.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const row = (pkg, label) => detailRows(pkg).find((r) => r.label === label) ?? null;

/*
 * סבב 58, `format.ts`. בשורת הציוד של חבילת בית שלושה פריטים: נתב,
 * מגדיל טווח וממיר. לנתב יש קורא פרוזה (`routerDetail`) ולהתקנה יש
 * קורא פרוזה (`installationDetail`), ולמגדיל הטווח — אף אחד: הוא
 * עבר דרך `included(s.extenderIncluded)` לבדו, ולכן `null` (הצורה
 * שהמחלץ מייצר לשדה שלא קרא) הפיל את השורה כולה.
 *
 * id 115 נושאת בשם עצמו "כולל נתב+מגדיל טווח", ובטבלת ההשוואה מול
 * id 70 השורה הדפיסה "כלול במחיר ‖ —" — הטבלה הכחישה עובדה שכותרת
 * אותה עמודה מבטיחה, על ציוד שהשורה שמתחתיה מתמחרת ב-₪14.9 לחודש.
 */

test("סבב 58: הכללת מגדיל טווח שהרשומה מצהירה בפרוזה אינה מוכחשת בטבלה", () => {
  const p = byId("115");
  assert.equal(p.spec.extenderIncluded, null, "הדגל של id 115 השתנה בקטלוג");
  assert.match(
    logicName(p),
    /כולל\s*נתב\s*\+\s*מגדיל\s*טווח/,
    "הניסוח שהשער נבנה עליו אינו בשם של id 115 יותר",
  );

  const extender = row(p, "מגדיל טווח");
  assert.ok(extender, "השורה נעלמה — זה בדיוק המצב שהסבב הזה תיקן");
  assert.equal(extender.value, "כלול במחיר");

  // ⚠️ והשורה היקרה שמתחתיה נשארת: "מגדיל טווח נוסף" הוא פריט אחר.
  assert.equal(row(p, "מגדיל טווח נוסף")?.value, "₪14.9");

  const cmp = compareRows([byId("70"), p]);
  assert.deepEqual(
    cmp.find((r) => r.label === "מגדיל טווח")?.values,
    ["כלול במחיר", "כלול במחיר"],
    "הטבלה ממשיכה להכחיש את מה שכותרת העמודה מבטיחה",
  );
});

/*
 * ⚠️ השער מצמצם ואינו מרחיב: הוא נקרא רק כש-`extenderIncluded` הוא
 * `null`, והוא דורש את המילה "כולל" לפני מגדיל הטווח. ids 157 ו-3 —
 * שתי החבילות שתוספת מגדיל הטווח שלהן היא הכרעה פתוחה מסבב 51 —
 * כותבות "מגדיל טווח **בתוספת**" ולכן אינן נתפסות, ושום רשומה אחרת
 * אינה מקבלת שורה חדשה.
 */

test("סבב 58: הקורא החדש מוסיף שורה אחת בלבד בכל הקטלוג", () => {
  const withRow = P.filter((p) => p.category === "home" && row(p, "מגדיל טווח") != null).map((p) =>
    String(p.id),
  );
  assert.deepEqual(
    withRow.sort(),
    ["115", "154", "70", "71", "72"].sort(),
    "מספר הרשומות שנושאות את שורת מגדיל הטווח זז",
  );

  // ארבע מהן נשענות על הדגל ולא על הפרוזה — הקורא החדש לא נגע בהן.
  for (const id of ["70", "71", "72", "154"]) {
    assert.equal(byId(id).spec.extenderIncluded, true, `id ${id} אינו נשען על הדגל יותר`);
  }

  // ושתי הרשומות של הכרעת סבב 51 אינן מקבלות הכללה שהן לא הצהירו.
  for (const id of ["157", "3"]) {
    assert.equal(
      row(byId(id), "מגדיל טווח"),
      null,
      `id ${id} קיבל הכללה — זה היפוך ההכרעה הפתוחה של סבב 51`,
    );
  }
});

/*
 * סבב 58, העברת `proseFloorsAt` ל-`savings.ts`. ההעברה נעשתה כדי
 * שהמנוע יחלוק את הקריאה עם הכרטיס, והבדיקה הזו מקבעת שהנוסח
 * **שעל הכרטיס** לא זז בעקבותיה.
 */

test("סבב 58: הסתייגות מחיר-התחלתי על הכרטיס לא זזה אחרי ההעברה", () => {
  assert.deepEqual(priceNote(byId("85")), {
    label: "תנאי המחיר",
    value: "המחיר הוא מחיר התחלתי ולא מחיר אחיד",
  });

  // ⚠️ ואף רשומה אחרת אינה נושאת את ההסתייגות הזו — היא הייתה והיא
  // נשארה הרשומה היחידה בקטלוג שמצהירה על רצפת מחיר.
  const floored = P.filter(
    (p) => priceNote(p)?.value === "המחיר הוא מחיר התחלתי ולא מחיר אחיד",
  ).map((p) => String(p.id));
  assert.deepEqual(floored, ["85"]);
});
