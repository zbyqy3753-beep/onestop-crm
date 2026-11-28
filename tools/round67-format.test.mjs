import assert from "node:assert/strict";
import { test } from "node:test";

const { basePackages } = await import("../src/app/lp/catalog/catalog.ts");
const { cardStats, compareRows, detailRows } = await import("../src/app/lp/catalog/format.ts");

const ALL = basePackages();
const byId = (id) => ALL.find((p) => String(p.id) === String(id));

/*
 * סבב 67, `format.ts`. הסייג "לדקות ול-SMS יחד" היה מותנה בקיום
 * **שני** האריחים (`isCount(spec.sms) && minutes === sms`), ולכן
 * רשומה שמצהירה על מאגר משותף בפרוזה אבל `sms` שלה `null` קיבלה
 * אריח דקות שקרא את המאגר כמאגר דקות משלה. ראה `sharedUsageCapAt`.
 */
test("מאגר שימוש משותף מסומן גם כשאין אריח SMS (id 19)", () => {
  const p = byId("19");
  assert.equal(p.spec.sms, null, "הנתון שהממצא נמדד עליו");
  assert.equal(p.spec.minutes, 3000);
  const minutes = cardStats(p).find((s) => s.caption === "דקות שיחה");
  assert.equal(minutes.value, "עד 3,000 · לדקות ול-SMS יחד");
});

/* התאום שכבר היה נכון אינו זז — שני האריחים נושאים את הסייג. */
test("id 21 (שני האריחים) נשאר כשהיה", () => {
  const stats = cardStats(byId("21"));
  for (const caption of ["דקות שיחה", "הודעות SMS"]) {
    assert.equal(stats.find((s) => s.caption === caption).value, "עד 5,000 · לדקות ול-SMS יחד");
  }
});

/*
 * כל אריח נשאל על **המספר שלו**: מאגר משותף על הדקות אינו מדביק את
 * הסייג לאריח SMS שמחזיק מספר אחר. ראה ההערה על `sharedAt`.
 */
test("הסייג אינו זולג לאריח SMS שמחזיק מספר אחר", () => {
  const clone = { ...byId("19"), spec: { ...byId("19").spec, sms: 500 } };
  const sms = cardStats(clone).find((s) => s.caption === "הודעות SMS");
  assert.ok(sms, "אריח SMS מרונדר");
  assert.ok(!sms.value.includes("יחד"), `אריח SMS קיבל סייג מאגר: ${sms.value}`);
});

/*
 * סבב 67, `format.ts`. `detailRows` קרא פרוזת התקנה רק מתוך
 * `if (isCount(s.installationCost))`, ולכן ארבע רשומות Partner
 * שמסרו את שני צדי ההתקנה בפרוזה בלבד הציגו `עלות התקנה: —` —
 * הכחשה של ₪499 שהרשומה כן מסרה. ראה `apartmentTierInstallation`.
 */
test("שני צדי ההתקנה נקראים מהפרוזה כש-installationCost הוא null", () => {
  for (const id of ["85", "86", "98", "99"]) {
    const p = byId(id);
    assert.equal(p.spec.installationCost, null, `id ${id}: הנתון שהממצא נמדד עליו`);
    const row = detailRows(p).find((r) => r.label === "עלות התקנה");
    assert.equal(
      row?.value,
      "ללא עלות בבניין מ-5 דירות · ₪499 בבניין 1-4 דירות",
      `id ${id}`,
    );
  }
});

test("טבלת ההשוואה אינה מכחישה את ₪499 (98 מול 112)", () => {
  const row = compareRows([byId("98"), byId("112")]).find((r) => r.label === "עלות התקנה");
  assert.equal(row.values[0], "ללא עלות בבניין מ-5 דירות · ₪499 בבניין 1-4 דירות");
  // הצד השני אינו זז — הוא קורא את הפרוזה מענף המספר כשהיה.
  assert.equal(row.values[1], "₪200 בבניין · ₪499 לבית פרטי");
});

/*
 * **שני** הצדדים או כלום: בלי צד משלם מהטקסט זה היה נקרא "ללא עלות"
 * גורף, בדיוק מה ש-`installationIsConditional` נכתב נגדו.
 */
test("צד חינמי לבדו אינו מדפיס שורה", () => {
  const p = byId("98");
  const clone = {
    ...p,
    name: "x",
    benefits: [],
    description: "דמי פריסת סיב לדירה במבנה מגורים הכולל 5 דירות ומעלה 0 ש\"ח. התקנה",
  };
  // `fee` משמיטה את השורה כשאין מספר, ולכן ההיעדר הוא ההתנהגות
  // הקודמת שנשמרת — וטבלת ההשוואה היא שמציירת "—" במקומה.
  const row = detailRows(clone).find((r) => r.label === "עלות התקנה");
  assert.equal(row, undefined);
});

/*
 * השורה נוספת **רק** בענף שבו השדה אינו מספר: אף רשומה אחרת בקטלוג
 * אינה מקבלת שורת התקנה חדשה.
 */
test("אף רשומה אחרת אינה מקבלת שורת התקנה חדשה", () => {
  const added = ALL.filter((p) => {
    if (p.spec?.installationCost != null) return false;
    const row = detailRows(p).find((r) => r.label === "עלות התקנה");
    return row != null && row.value !== "—";
  }).map((p) => String(p.id));
  assert.deepEqual(added.sort(), ["85", "86", "98", "99"]);
});
