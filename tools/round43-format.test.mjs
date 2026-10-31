import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { detailRows, specOf, speedLabel } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ סבב 43 — שני ממצאים בפירסור, שניהם "אותה הצהרה, נוסח שכן":
 *
 *   • תקרת מהירות שנכתבה כ**טווח** (`0.01-1000Mbps`, הצורה
 *     הרגולטורית) מול המילה "עד" — ושלוש רשומות HOT נשאו את
 *     הטווח לבדו והדפיסו את הקצה העליון כעובדה שטוחה, בזמן
 *     שארבע אחיותיהן עם אותו טווח בדיוק הודפסו עם "עד".
 *   • "בבנין **חינם**" מול "בבנין **0** שח" — צד הבניין נשמט
 *     לגמרי מהשורה של id 82, בזמן ששתי אחיותיה מדפיסות אותו.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));
const label = (id) => speedLabel(byId(id), specOf(byId(id)));
const installRow = (id) => detailRows(byId(id)).find((r) => /התקנה/.test(r.label))?.value;

test("סבב 43: טווח מהירות מוצהר נקרא כתקרה", () => {
  // שלוש הרשומות שהדפיסו את הקצה העליון כעובדה.
  for (const id of ["70", "71", "72"]) {
    assert.equal(label(id), "עד 1,000/100Mbps", `id ${id}`);
  }
});

test("סבב 43: אחיותיהן שכבר נשאו 'עד' בפרוזה לא זזו", () => {
  assert.equal(label("73"), "עד 1,000/100Mbps");
  assert.equal(label("153"), "עד 600/100Mbps");
  assert.equal(label("154"), "עד 600/100Mbps");
  assert.equal(label("159"), "עד 2,000/250Mbps");
});

test("סבב 43: שבע רשומות HOT נושאות את אותו טווח ומודפסות זהה", () => {
  const ranged = live.filter((p) =>
    /(?:\d+(?:\.\d+)?)\s*[-–]\s*\d[\d,]*\s*Mbps/i.test(
      `${p.rawName ?? p.name} ${p.description ?? ""} ${p.benefits ?? ""}`,
    ),
  );
  assert.equal(ranged.length, 7);
  for (const p of ranged) {
    assert.match(speedLabel(p, specOf(p)), /^עד /, `id ${p.id}`);
  }
});

test("סבב 43: הקורא מוגבל למהירות ואינו שער כללי לטווחים", () => {
  // ⚠️ רשומה בלי טווח מהירות אינה מקבלת "עד" משום מקום.
  assert.equal(label("81"), "100Mbps");
  assert.equal(label("123"), "100/10Mbps");
});

test("סבב 43: 'בבנין חינם' נקרא כמחיר בניין 0, כמו 'בבנין 0שח'", () => {
  assert.equal(installRow("82"), "ללא עלות בבניין · ₪499 לבית פרטי");
  // שתי האחיות שכותבות את אותו דבר בספרה — לא זזו.
  assert.equal(installRow("113"), "ללא עלות בבניין · ₪499 לבית פרטי");
  assert.equal(installRow("115"), "ללא עלות בבניין · ₪499 לבית פרטי");
});

test("סבב 43: שורות התקנה שאינן מצהירות 'בבנין חינם' לא זזו", () => {
  assert.equal(installRow("112"), "₪200 בבניין · ₪499 לבית פרטי");
  assert.equal(installRow("114"), "₪200 בבניין · ₪499 לבית פרטי");
  assert.equal(installRow("71"), "₪49 בבניין · ₪125 לבית פרטי");
  /*
   * ⚠️ id 3 הייתה כאן `"ללא עלות בבניין"` עד סבב 48, ולא בגלל
   * שהרשומה שותקת על הבית הפרטי: היא כותבת "התקנה ללא עלות בבניין
   * בית פרטי 499" — **בלי** סימן מטבע — ו-`privateHomeInstallation`
   * דרשה מטבע בצורה שאחרי המילה, כך שהצד הפרטי נשמט. הכרטיס הצהיר
   * "ללא עלות בבניין" ולא אמר מילה על ₪499 שייגבו ממי שגר בבית פרטי,
   * ו-id 3 יושבת בבריכת ההשוואה הביתית ({3, 157}). הבדיקה הזו קיבעה
   * את ההסתרה; הערך המעודכן הוא מה שהרשומה מסרה.
   * ראה `tools/round48-format.test.mjs`.
   */
  assert.equal(installRow("3"), "ללא עלות בבניין · ₪499 לבית פרטי");
  assert.equal(installRow("158"), "ללא עלות כשיש סיב מותקן · ₪499 כשאין");
});

test("סבב 43: הנוסח המילולי חי ברשומה אחת בלבד", () => {
  const worded = live.filter((p) =>
    /בבנין\s*(חינם|ללא עלות|בחינם)/.test(
      `${p.rawName ?? p.name} ${p.description ?? ""} ${p.benefits ?? ""}`,
    ),
  );
  assert.deepEqual(worded.map((p) => String(p.id)), ["82"]);
});
