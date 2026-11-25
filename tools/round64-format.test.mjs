import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { detailRows } from "../src/app/lp/catalog/format.ts";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const rowOf = (id, label) => detailRows(byId(id)).find((r) => r.label === label) ?? null;

/*
 * סבב 64, `format.ts`. שני שערים שהכירו צורה אחת של אותה הצהרה
 * ופספסו את השכנה — הדפוס החוזר של הקובץ. שניהם רדומים בנתון של
 * היום, ולכן אף שורה מרונדרת אינה משתנה; הבדיקה מקבעת את שתי
 * המחציות: שהשער קורא את הנוסח, ושהפלט לא זז.
 */

/* ההצהרות בפרוזה, כפי שהמחלץ כתב אותן. אם אלה זזות — התרחיש זז. */
test("סבב 64: הנוסחים שהבדיקה מקבעת נמצאים בנתון", () => {
  for (const id of ["3", "158", "104"]) {
    const p = byId(id);
    assert.match(
      `${p.name ?? ""} ${p.description ?? ""} ${p.benefits ?? ""}`,
      /ללא עלות בבניין/,
      `id ${id}: 'ללא עלות בבניין' (יו"ד + סדר הפוך) אינו בנתון`,
    );
  }
  assert.match(
    `${byId("82").description ?? ""}`,
    /בבנין\s*חינם/,
    "id 82: הנוסח שהשער הכיר מאז ומתמיד אינו בנתון",
  );
});

/*
 * ⚠️ `buildingInstallation` הוא פרטי, ולכן הוא נבדק דרך השורה
 * שהוא מזין — וזו גם הבדיקה החשובה: ההרחבה אסור שתזיז שורה.
 */
test("סבב 64: הרחבת 'בבניין' אינה מזיזה אף שורת התקנה", () => {
  /*
   * id 82: הנוסח שהשער תמיד הכיר. השורה נשארת בדיוק כפי שהייתה —
   * זו הרשומה שבשבילה השער נכתב (`cost` הוא המספר של הבית הפרטי,
   * ולכן בלי קריאת המילה צד הבניין נעלם לגמרי).
   */
  assert.deepEqual(rowOf("82", "עלות התקנה"), {
    label: "עלות התקנה",
    value: "ללא עלות בבניין · ₪499 לבית פרטי",
  });

  /*
   * ids 158, 104: שלהן `fiberConditionedInstallation` חוטף קודם —
   * התנאי האמיתי הוא קיום סיב וחל על שתי צורות המגורים — ולכן השער
   * המורחב נדלק עליהן ואינו נקרא.
   */
  for (const id of ["158", "104"]) {
    assert.deepEqual(
      rowOf(id, "עלות התקנה"),
      { label: "עלות התקנה", value: "ללא עלות כשיש סיב מותקן · ₪499 כשאין" },
      `id ${id}: שורת ההתקנה זזה`,
    );
  }

  /* id 3: יושבת בבריכת ההשוואה הביתית, ולכן זו שורה שמוצגת היום. */
  assert.deepEqual(rowOf("3", "עלות התקנה"), {
    label: "עלות התקנה",
    value: "ללא עלות בבניין · ₪499 לבית פרטי",
  });
});

test("סבב 64: הגרש העברי בקבוע אחד — והקטלוג של היום אינו נושא אותו", () => {
  /*
   * ⚠️ `SHEKEL_UNIT`. `ROUTER_MONEY` ו-`tierPricePeriod` הכירו `ש״ח`
   * (U+05F4) בזמן ש-`privateHomeInstallation` ו-
   * `includedRouterSurcharge` הכירו `ש"ח|שח|₪` לבדן — אותה אלטרנציה
   * בחמישה עותקים, בשתי גרסאות. הבדיקה מקבעת את הנימוק: אין היום
   * רשומה עם הגרש העברי, ולכן אף מספר אינו זז, והקבוע הוא מה שמונע
   * מהעותק הבא להתיישן.
   */
  const withGershayim = P.filter((p) =>
    /ש״ח/.test(`${p.name ?? ""} ${p.description ?? ""} ${p.benefits ?? ""}`),
  );
  assert.deepEqual(
    withGershayim.map((p) => String(p.id)),
    [],
    "הקטלוג התחדש ויש בו גרש עברי — מדדו מחדש את שורות ההתקנה והנתב",
  );

  /* ושורות הנתב וההתקנה שהקבוע נוגע בהן נשארות כמות שהן. */
  assert.deepEqual(rowOf("113", "נתב"), { label: "נתב", value: "כלול במחיר" });
  assert.deepEqual(rowOf("70", "עלות התקנה"), {
    label: "עלות התקנה",
    value: "₪125 לבית פרטי",
  });
});
