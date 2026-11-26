import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { compareRows, detailRows } from "../src/app/lp/catalog/format.ts";

const ALL = listable(basePackages());
const byId = (id) => {
  const p = ALL.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const rowOf = (id, label) => detailRows(byId(id)).find((r) => r.label === label);
const specOf = (id) => byId(id).spec ?? {};

/*
 * סבב 65, `format.ts`. `extraConverterCost` ו-`extraExtenderCost` היו
 * שתי השורות האחרונות בבלוק הציוד שנשארו בלי קורא פרוזה, בזמן ששלוש
 * אחיותיהן באותן שורות (`routerDetail`, `extenderIncludedInProse`,
 * `vodInProse`) כולן קוראות פרוזה כש-`null` יושב בדגל.
 */

test("סבב 65: עלות יחידה נוספת נקראת מהפרוזה כש-`spec` שותק", () => {
  /*
   * ids 71 ו-72 הם אותו מסלול של HOT, נבדלים ב-VOD בלבד. ל-71 יש את
   * שני הסכומים ב-`spec`; ל-72 `null` בשניהם, והפרוזה של אותה רשומה
   * נוקבת בהם מילה במילה.
   */
  assert.equal(specOf("72").extraConverterCost, null, "id 72 כבר נושאת את הסכום ב-spec");
  assert.equal(specOf("72").extraExtenderCost, null, "id 72 כבר נושאת את הסכום ב-spec");
  assert.match(
    `${byId("72").description ?? ""}`,
    /כל סטרימר נוסף בעלות 15 ש"ח,\s*כל מגדיל טווח נוסף בעלות של 11\.90/,
    "הנוסח שהבדיקה מקבעת אינו בנתון",
  );

  assert.deepEqual(rowOf("72", "ממיר נוסף"), { label: "ממיר נוסף", value: "₪15" });
  assert.deepEqual(rowOf("72", "מגדיל טווח נוסף"), { label: "מגדיל טווח נוסף", value: "₪11.9" });

  /* ושני המספרים הם בדיוק מה שהתאום מדפיס בעמודה שלידו. */
  assert.deepEqual(rowOf("72", "ממיר נוסף"), rowOf("71", "ממיר נוסף"));
  assert.deepEqual(rowOf("72", "מגדיל טווח נוסף"), rowOf("71", "מגדיל טווח נוסף"));

  /*
   * ⚠️ זה המשטח שבו הפגם נראה: `—` לצד המספר, על אותה שורה. הטבלה
   * הדפיסה `ממיר נוסף: — ‖ ₪15` ו-`מגדיל טווח נוסף: — ‖ ₪11.9`.
   */
  const table = compareRows([byId("72"), byId("71")]);
  const expected = { "ממיר נוסף": ["₪15", "₪15"], "מגדיל טווח נוסף": ["₪11.9", "₪11.9"] };
  for (const [label, values] of Object.entries(expected)) {
    const row = table.find((r) => r.label === label);
    assert.ok(row, `שורת "${label}" נעלמה מטבלת ההשוואה`);
    assert.deepEqual(
      row.values,
      values,
      `"${label}": הטבלה עוד מכחישה על id 72 מספר שהרשומה שלה נוקבת בו`,
    );
  }
});

test("סבב 65: גם ids 104 ו-158 מקבלות את שורת הממיר שהפרוזה שלהן מוסרת", () => {
  for (const id of ["104", "158"]) {
    assert.equal(specOf(id).extraConverterCost, null, `id ${id} כבר נושאת את הסכום ב-spec`);
    assert.match(
      `${byId(id).description ?? ""}`,
      /כל סטרימר נוסף נוסף בתוספת של 15שח לסטרימר/,
      `id ${id}: הנוסח שהבדיקה מקבעת אינו בנתון`,
    );
    assert.deepEqual(rowOf(id, "ממיר נוסף"), { label: "ממיר נוסף", value: "₪15" });
  }
});

test("סבב 65: העוגן `נוסף` משאיר בחוץ את שלושת המספרים שאינם זה", () => {
  /*
   * ⚠️ כל אחד מהשלושה נקרא בהרצה על ידי עוגן רופף על שם הציוד, וכל
   * אחד מהם הוא מספר אחר: ראה `extraUnitCostInProse`.
   */

  /* id 72 מצהירה שהמגדיל **כלול**, והמספר שליד השם הוא של הממיר. */
  assert.match(`${byId("72").description ?? ""}`, /מגדיל טווח: כלולים במחיר/);
  assert.notEqual(
    rowOf("72", "מגדיל טווח נוסף")?.value,
    "₪15",
    "שורת המגדיל של id 72 קוראת את מחיר הממיר",
  );

  /* id 124: `ראווטר בעלות 20` הוא מחיר הנתב, ושורת הנתב מדפיסה אותו. */
  assert.equal(specOf("124").extraExtenderCost, null);
  assert.equal(rowOf("124", "מגדיל טווח נוסף"), undefined, "id 124 קיבלה מחיר נתב בשורת המגדיל");

  /* id 123: חינם-ואז-בתשלום על היחידה הראשונה, לא יחידה נוספת. */
  assert.equal(specOf("123").extraExtenderCost, null);
  assert.equal(rowOf("123", "מגדיל טווח נוסף"), undefined, "id 123 קיבלה שורת יחידה נוספת");
});

test("סבב 65: ההכרעה הפתוחה של סבב 51 (ids 157, 3) לא נגעה", () => {
  /*
   * שתיהן אומרות `מגדיל טווח בתוספת …` **בלי** `נוסף`, כלומר על
   * היחידה הראשונה — וזו השאלה הפתוחה "ציוד חובה או אופציונלי?",
   * שאין לה כאן תשובה חדשה.
   */
  for (const id of ["157", "3"]) {
    assert.equal(specOf(id).extraExtenderCost, null);
    assert.match(`${byId(id).description ?? ""}`, /מגדיל טווח\s*(?:ב?תוספת)/);
    assert.equal(
      /מגדיל טווח[^.|\n\d]{0,20}?נוסף/.test(`${byId(id).description ?? ""}`),
      false,
      `id ${id}: הפרוזה כן אומרת "נוסף" — העוגן אינו מה שהבדיקה מתארת`,
    );
    assert.equal(
      rowOf(id, "מגדיל טווח נוסף"),
      undefined,
      `id ${id}: ההכרעה הפתוחה הוכרעה בשקט`,
    );
  }
});

test("סבב 65: אף שורת ציוד קיימת לא זזה, ואלה שנוספו הן ארבע בדיוק", () => {
  const fromProse = [];
  for (const p of ALL) {
    const s = p.spec ?? {};
    for (const r of detailRows(p)) {
      if (r.label !== "ממיר נוסף" && r.label !== "מגדיל טווח נוסף") continue;
      const flag = r.label === "ממיר נוסף" ? s.extraConverterCost : s.extraExtenderCost;
      if (flag == null) fromProse.push(`${p.id}:${r.label}=${r.value}`);
      /* שורה שהדגל מילא מדפיסה בדיוק את הדגל — הקורא אינו גובר עליו. */
      else assert.equal(r.value, flag === 0 ? "ללא עלות" : `₪${flag}`);
    }
  }
  assert.deepEqual(fromProse.sort(), [
    "104:ממיר נוסף=₪15",
    "158:ממיר נוסף=₪15",
    "72:מגדיל טווח נוסף=₪11.9",
    "72:ממיר נוסף=₪15",
  ].sort());
});
