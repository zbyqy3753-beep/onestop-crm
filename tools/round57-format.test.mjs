import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { compareRows, detailRows } from "../src/app/lp/catalog/format.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const row = (pkg, label) => detailRows(pkg).find((r) => r.label === label) ?? null;

/*
 * סבב 57, `format.ts`. `maxMonthlyBill` היה השדה היחיד בחשמל שלא עבר
 * דרך שום שער: מודפס ישר מ-`shekels`, בתווית "תקרת חשבונית חודשית".
 * שתי הרשומות שנושאות אותו מוסרות אותו כ**סגמנט זכאות** ("לקוח עסקי
 * קטן חשבונית ... חודשית עד 5000₪"), ולכן התווית הפכה תנאי לתכולה —
 * וב-`compareRows` ₪5,000 מול ₪2,500 נקרא "תקרה גבוהה = טוב יותר",
 * כשהמספר הגדול הוא בדיוק סגמנט הזכאות הרחב יותר.
 */

test("סבב 57: סגמנט הזכאות אינו מודפס כתקרה שהספק מבטיח", () => {
  const carriers = P.filter((p) => typeof p.spec?.maxMonthlyBill === "number");
  assert.equal(carriers.length, 2, "מספר הרשומות שנושאות את השדה השתנה");
  assert.deepEqual(
    carriers.map((p) => String(p.id)).sort(),
    ["141", "143"],
  );

  for (const p of carriers) {
    // הרשומה עצמה אומרת "עד" — זו ההצהרה שהערך חייב לשאת.
    assert.match(String(p.description ?? ""), /חודשית\s*עד/, `id ${p.id}: הנתון השתנה`);
    assert.equal(row(p, "תקרת חשבונית חודשית"), null, `id ${p.id}: התווית חזרה`);
    const r = row(p, "מיועד לחשבונית חודשית");
    assert.ok(r, `id ${p.id}: השורה נעלמה`);
    assert.match(r.value, /^עד ₪/, `id ${p.id}: ה-"עד" נשר מהערך (${r.value})`);
  }

  assert.equal(row(byId(143), "מיועד לחשבונית חודשית").value, "עד ₪5,000");
  assert.equal(row(byId(141), "מיועד לחשבונית חודשית").value, "עד ₪2,500");
});

test("סבב 57: שורת ההשוואה אומרת התאמה ולא תקרה", () => {
  const rows = compareRows([byId(143), byId(141)]);
  const r = rows.find((x) => x.label === "מיועד לחשבונית חודשית");
  assert.ok(r, "השורה אינה בטבלת ההשוואה");
  assert.ok(
    !rows.some((x) => x.label === "תקרת חשבונית חודשית"),
    "התווית שנקראת כהבטחת תקרה חזרה לטבלה",
  );
  assert.deepEqual(r.values, ["עד ₪5,000", "עד ₪2,500"]);
});
