import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import { basePackages, listable, providerName } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ אותו stub שבראש `tools/lpBrowse.test.mjs` — ראה ההערה שם.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { compareLabel } = await import("../src/app/lp/ui/CompareTray.tsx");
const { SORTS } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

/*
 * ⚠️ סבב 44 — שלושה פגמים במשטח העיון, כולם "תווית שאומרת משהו
 * שהמשטח מתחתיה אינו מקיים":
 *
 *   • תווית המיון של החשמל הבטיחה "בכל השעות", בזמן ש-`electricityRank`
 *     מקבצת לפי **היעדר הצהרה** על שעות — ושלוש רשומות ששותקות על
 *     שעות יושבות מעל ארבע שמצהירות `allHours: true` במפורש.
 *   • `compareLabel` הבדילה רק בתוך אותו ספק, ולכן שני שבבים של
 *     ספקים שונים עם אותה כותרת היו זהים — וגם שני כפתורי ה-✕.
 *   • מסנן "חברה" נפרס בעמודי ספק עם תיבה אחת שאינה יכולה לסנן.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));

test("browse: תווית מיון החשמל אומרת מה שהדירוג עושה", () => {
  const asc = SORTS.find((s) => s.key === "price-asc");
  /*
   * ⚠️ הדירוג מקבץ לפי "מי שלא הצהיר על חלון שעות", ולכן התווית
   * אומרת את זה. "בכל השעות" הייתה הבטחה על `allHours` — שדה
   * שהדירוג במכוון אינו מקבץ לפיו.
   */
  assert.equal(asc.electricLabel, "הנחה: ללא חלון שעות תחילה");
  assert.ok(!asc.electricLabel.includes("בכל השעות"));
  // התווית ההופכית הייתה מדויקת מלכתחילה — היא בדיוק קבוצת `hoursText`.
  assert.equal(SORTS.find((s) => s.key === "price-desc").electricLabel, "הנחה: מסלולי שעות תחילה");
});

test("browse: הרשומות שבראש הקבוצה הראשונה אינן מצהירות על כל השעות", () => {
  /*
   * ⚠️ זה הממצא עצמו, מקובע בנתון: ids 142, 135, 139 נושאים
   * `allHours: false` וגם `hoursText` ריק — כלומר הכרטיס שלהם אינו
   * מדפיס אריח שעות כלל — והם מדורגים מעל ids 151/148/138/152
   * שהכרטיס שלהם כן אומר "כל השעות". לכן התווית אינה יכולה
   * להבטיח "בכל השעות".
   */
  for (const id of ["142", "135", "139"]) {
    const spec = byId(id).spec;
    assert.notEqual(spec.allHours, true, `id ${id}`);
    assert.ok(!spec.hoursText, `id ${id}`);
  }
  for (const id of ["151", "148", "138", "152"]) {
    assert.equal(byId(id).spec.allHours, true, `id ${id}`);
  }
});

test("browse: שני מסלולים של ספקים שונים עם אותה כותרת נפרדים בשם הספק", () => {
  const a = byId("147");
  const b = byId("150");
  assert.equal(a.name, b.name, "התנאי המוקדם: אותה כותרת");
  assert.notEqual(providerName(a), providerName(b));
  const pair = [a, b];
  assert.equal(compareLabel(a, pair), "חוסכים בלילה 20% · HOT אנרגי");
  assert.equal(compareLabel(b, pair), "חוסכים בלילה 20% · בזק אנרג'י");
  assert.notEqual(compareLabel(a, pair), compareLabel(b, pair));
});

test("browse: מסלול בודד בבחירה נשאר בכותרת חשופה", () => {
  // ⚠️ "· HOT אנרגי" על עמודה בודדת הוא רעש — אין ממה להבדיל.
  assert.equal(compareLabel(byId("147"), [byId("147")]), "חוסכים בלילה 20%");
});

test("browse: ההבדלה בתוך אותו ספק לא זזה", () => {
  /*
   * ⚠️ מנגנון הגרסה והמחיר מתועד בהערה שמעל `compareLabel` ומקובע
   * כאן, כדי שהציר שנוסף (הספק) לא יעקוף אותו.
   */
  const [v1, v2] = [byId("50"), byId("51")];
  assert.deepEqual([compareLabel(v1, [v1, v2]), compareLabel(v2, [v1, v2])], [
    "Valentine's · ₪60",
    "Valentine's · גרסה 2",
  ]);
  const [k1, k2] = [byId("23"), byId("24")];
  assert.deepEqual([compareLabel(k1, [k1, k2]), compareLabel(k2, [k1, k2])], ["כשר · ₪25", "כשר · ₪27.9"]);
});

test("browse: אין ולו זוג אחד מתוך 106 הרשומות ששתי התוויות שלו זהות", () => {
  const dupes = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const pair = [live[i], live[j]];
      if (compareLabel(pair[0], pair) === compareLabel(pair[1], pair)) {
        dupes.push([String(live[i].id), String(live[j].id)]);
      }
    }
  }
  assert.deepEqual(dupes, []);
});
