import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { routerPricedSeparately } from "../src/app/lp/catalog/savings.ts";
import { cardStats, compareRows, detailRows } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ סבב 38 — שכבת הניסוח, שני שערים שחוברו לצד אחד של שדה דו-מצבי:
 *
 *   • `routerIncluded: true` הודפס "כלול במחיר" כעובדה גורפת על חמש
 *     רשומות שהפרוזה שלהן תולה בהכללה עצמה תוספת חודשית ("בתוכניות
 *     שבהן הנתב כלול במחיר החבילה , תתווסף עלות על הנתב על סך 4.9 ₪").
 *     זה הצד **החיובי** של הפגם שסבב 37 סגר על `false`, והמנוע כבר
 *     הכריע אותו לכיוון ההפוך: `routerPricedSeparately` מונה את אותו
 *     משפט במפורש ופוסל את חמשתן מהמחשבון. הבדיקה קושרת את שתי
 *     השכבות זו לזו, כדי שלא תיפתח שוב סתירה בין מה שהכרטיס מבטיח
 *     לבין מה שהמנוע מסרב להשוות בגללו.
 *
 *   • `channels` היה השדה האחרון בכרטיס שמודפס בלי שער "עד". רדום
 *     בקטלוג של היום (ids 70 ו-71 מוסרות ערוצים שטוח), ולכן זה שער
 *     לרענון הבא ונבדק על רשומה מסונתזת — ועם היחידה, כדי שתקרה של
 *     שדה אחר לא תזלוג לאריח הערוצים.
 */

const live = listable(basePackages());
const byId = (id) => {
  const p = live.find((x) => x.id === id);
  assert.ok(p, `id ${id} אינו בקטלוג החי — עדכן את הבדיקה, לא את הקוד`);
  return p;
};
const rowValue = (pkg, label) => detailRows(pkg).find((r) => r.label === label)?.value;

/* ── הנתב: הכללה שהרשומה מתנה בתוספת חודשית ─────────────────────── */

const SURCHARGED = ["92", "102", "107", "108", "109"];

test("נתב: תוספת שהרשומה תולה בהכללה עצמה נאמרת, ולא רק 'כלול במחיר'", () => {
  for (const id of SURCHARGED) {
    assert.equal(rowValue(byId(id), "נתב"), "כלול במחיר · בתוספת ₪4.9 לחודש");
  }
});

test("נתב: מה שהמנוע פוסל בגללו — הכרטיס אינו מבטיח בחינם", () => {
  /*
   * אותו משפט, שתי שכבות: כל רשומת בית שהמנוע פוסל כ"נתב מתומחר
   * בנפרד" **ומצהירה** `routerIncluded: true` חייבת לשאת את התוספת
   * בשורה. בלי השער הזה "כלול במחיר" היה סותר את `isComparable`.
   */
  const contradicting = live.filter(
    (p) => p.category === "home" && p.spec?.routerIncluded === true && routerPricedSeparately(p),
  );
  assert.deepEqual(
    contradicting.map((p) => p.id).sort(),
    [...SURCHARGED].sort(),
    "אוכלוסיית הסתירה השתנתה — בדוק את הקטלוג לפני שתעדכן את המספרים",
  );
  for (const p of contradicting) {
    assert.match(rowValue(p, "נתב"), /בתוספת/, `${p.id}: "כלול במחיר" בלי התוספת שהרשומה מסרה`);
  }
});

test("נתב: הכללה בלי התניה בפרוזה נשארת 'כלול במחיר' — לא ממציאים תוספת", () => {
  for (const id of ["70", "71", "72", "157"]) {
    assert.equal(rowValue(byId(id), "נתב"), "כלול במחיר");
  }
});

test("נתב: 'תתווסף עלות' בלי סכום אינו מספר שמותר להדפיס", () => {
  const base = byId("92");
  const pkg = {
    ...base,
    rawName: "טריפל",
    description: "בתוכניות שבהן הנתב כלול במחיר החבילה תתווסף עלות על הנתב בנוסף לעלות התוכנית",
    benefits: "",
  };
  assert.equal(rowValue(pkg, "נתב"), "כלול במחיר");
});

test("נתב: ענפי `false` של סבב 37 לא זזו", () => {
  assert.equal(rowValue(byId("81"), "נתב"), "ללא עלות");
  for (const id of ["158", "104"]) {
    assert.equal(rowValue(byId(id), "נתב"), "₪20 בתוספת למחיר · ללא עלות למשך שנה");
  }
});

/* ── ערוצים: השדה האחרון שנותר בלי שער "עד" ──────────────────────── */

const withChannels = (prose, channels = 60) => {
  const base = byId("70");
  return {
    ...base,
    rawName: prose,
    description: "",
    benefits: "",
    spec: { ...base.spec, channels, converters: null, installationCost: null },
  };
};
const channelTile = (pkg) => cardStats(pkg).find((s) => /ערוצ/.test(s.caption));

test("ערוצים: 'עד 60 ערוצים' אינו מודפס כ-60 עובדתי", () => {
  assert.deepEqual(channelTile(withChannels("חבילה עד 60 ערוצים")), {
    value: "עד 60",
    caption: "ערוצים",
  });
});

test("ערוצים: תקרה של שדה אחר אינה זולגת לאריח הערוצים", () => {
  assert.equal(channelTile(withChannels("חבילה עד 60 דקות שיחה לחו\"ל")).value, "60");
  assert.equal(channelTile(withChannels("חבילה עד 60GB גלישה")).value, "60");
});

test("ערוצים: הרשומות החיות ממשיכות להדפיס את המספר שטוח", () => {
  assert.equal(channelTile(byId("70")).value, "60");
  assert.equal(channelTile(byId("71")).value, "180");
});

test("ערוצים: 'עד' אינו מוסיף תווית שלישית לטבלת ההשוואה", () => {
  const capped = withChannels("חבילה עד 60 ערוצים");
  const rows = compareRows([capped, byId("71")]);
  const labels = rows.filter((r) => /ערוצ/.test(r.label)).map((r) => r.label);
  assert.deepEqual(labels, ["ערוצים"], "אותה עובדה נפרשה לשתי שורות");
  assert.deepEqual(rows.find((r) => r.label === "ערוצים").values, ["עד 60", "180"]);
});
