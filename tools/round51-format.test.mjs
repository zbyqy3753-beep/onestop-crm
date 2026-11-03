import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { compareRows, dataLabel, detailRows } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ סבב 51, הפרסור — `esim: false` הוא נתון ולכן נאמר.
 *
 * `types.ts:29` מצהיר `esim: boolean` חשוף — בלי `null` — ולכן `false`
 * הוא ודאות ולא היעדר נתון. השורה שדחפה רק את המצב החיובי הפכה את
 * הוודאות ל-"—" בטבלת ההשוואה, כלומר ל-"אין לנו נתון": 250 מזוגות
 * ההשוואה בלשונית הסלולר הדפיסו את השורה עם "—" בצד אחד. זו בדיוק
 * מחלקת הפגם שההערה על `included` באותו קובץ מתעדת כתוקנה לשלושת
 * השדות התלת-מצביים — ולא הוחלה על השדה הדו-מצבי.
 */

const PKGS = basePackages();
const byId = (id) => structuredClone(PKGS.find((p) => p.id === id));
const rowOf = (rows, label) => rows.find((r) => r.label === label);

test("eSIM: `true` ו-`false` שניהם נאמרים, ואין `—`", () => {
  const a = byId("93"); // esim: true
  const b = byId("129"); // esim: false
  assert.equal(a.spec.esim, true);
  assert.equal(b.spec.esim, false);

  const row = rowOf(compareRows([a, b]), "eSIM");
  assert.deepEqual(row.values, ["נתמך", "אינו נתמך"]);
});

test("ובכרטיס — השורה קיימת בשני הכיוונים", () => {
  assert.equal(rowOf(detailRows(byId("93")), "eSIM").value, "נתמך");
  assert.equal(rowOf(detailRows(byId("129")), "eSIM").value, "אינו נתמך");
});

test("אף רשומת סלולר אינה מדפיסה `—` בשורת ה-eSIM", () => {
  const cellular = PKGS.filter((p) => p.spec && typeof p.spec.esim === "boolean");
  assert.ok(cellular.length > 50, "השדה חי בקטלוג");
  for (const p of cellular) {
    const row = rowOf(detailRows(p), "eSIM");
    assert.ok(row && row.value !== "—", `${p.id}: eSIM שתק`);
  }
});

test("שדה שאינו בוליאני אינו ממציא שורה", () => {
  // ⚠️ `typeof` ולא `!= null`: המחלץ מייצר `"false"` כמחרוזת, והיא אמת.
  const p = byId("129");
  p.spec.esim = null;
  assert.equal(rowOf(detailRows(p), "eSIM"), undefined);
});

/*
 * ⚠️ והשער שעליו — `unlimitedData === true` — הוא שער לרענון ואינו
 * מזיז מספר על המסך: כל רשומות הסלולר נושאות היום בוליאן אמיתי.
 */
test("`unlimitedData` טקסטואלי אינו מוחק את מספר הנפח", () => {
  const p = byId("129");
  p.spec.unlimitedData = "false";
  p.spec.dataGb = 300;
  assert.equal(dataLabel(p, p.spec), "300GB");

  p.spec.unlimitedData = true;
  assert.equal(dataLabel(p, p.spec), "גלישה חופשית");
});
