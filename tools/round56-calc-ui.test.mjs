import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages, byCategory, isListable, listable } from "../src/app/lp/catalog/catalog.ts";
import { isComparable } from "../src/app/lp/catalog/savings.ts";

const SRC = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");
/** הקוד בלי ההערות — כדי שנימוק בעברית לא ייחשב כנוסח שעל המסך. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const P = basePackages();

/*
 * סבב 56, `SavingsCalculator.tsx`. שתי הצהרות על המסך שהנתון אינו
 * תומך בהן — אותה מחלקה בדיוק שההערה בראש שלב 0 כבר מנמקת
 * ("החבילות שאפשר להשוות" ולא "הקטלוג המלא"), בשתי השורות שלא קיבלו
 * אותה.
 */

test("סבב 56: הכרטיס אינו מבטיח שלשונית החשמל מציגה את כל המסלולים", () => {
  /*
   * ההבטחה הייתה בלתי-מותנית, והדף עצמו הכחיש אותה מסך אחד אחר כך:
   * הלשונית מוזנת מ-`listable(basePackages())`, ו-`isListable` דורשת
   * `isMoney(discountPercent)` בחשמל.
   */
  const all = P.filter((p) => p.category === "electricity");
  const shown = byCategory(listable(P), "electricity");
  assert.equal(all.length, 19);
  assert.equal(shown.length, 18, "הלשונית אינה מציגה את כל מסלולי החשמל");

  const dropped = all.filter((p) => !isListable(p));
  assert.equal(dropped.length, 1);
  assert.equal(String(dropped[0].id), "144");
  assert.equal(dropped[0].spec?.discountPercent ?? null, null);

  // ולכן הנוסח אינו נוקב ב"כל".
  assert.ok(
    !/מציגה את כל המסלולים/.test(CODE),
    "הכרטיס חזר להבטיח כיסוי מלא של לשונית החשמל",
  );
  assert.match(CODE, /מציגה את מסלולי החשמל שלנו/);
});

test("סבב 56: \"מעל זה שכלול\" נאמר רק כשהרשומה מצהירה על ממיר כלול", () => {
  /*
   * הנוסח קבע כעובדה שממיר אחד כלול במחיר שהכותרת נבנתה עליו, בזמן
   * שהשער היחיד שהחזיק אותו היה ההצהרה על ה**תוספת**
   * (`extraConverterCost`). `spec.converters` לא נקרא כאן בכלל.
   */
  const homePool = P.filter((p) => isComparable(p, "home"));
  assert.equal(homePool.length, 2);
  for (const p of homePool) {
    // שתי הרשומות מצהירות על תוספת לממיר נוסף ו**אינן** מצהירות
    // כמה ממירים כלולים — ולכן הפסוקית מושמטת עליהן.
    assert.equal(p.spec?.extraConverterCost, 15);
    assert.equal(p.spec?.converters ?? null, null, `id ${p.id}: converters אינו null`);
  }

  // הפסוקית נגזרת מהשדה, ואינה כתובה בתוך המשפטים.
  assert.match(CODE, /converterIncluded/);
  assert.match(CODE, /homeSpec\?\.converters/);
  assert.match(CODE, /extraConverterPhrase/);
  const sentences = CODE.match(/ממיר נוסף[^`"]*תוספת חודשית/g) ?? [];
  assert.ok(sentences.length >= 1, "שורת ההסתייגות על הממיר נעלמה");
  for (const s of sentences) {
    assert.ok(
      !/מעל זה שכלול/.test(s),
      `הפסוקית חזרה להיות כתובה בתוך המשפט: ${s}`,
    );
  }
});

test("והמשטח האחי ממשיך לא להצהיר על ממיר כלול", () => {
  // ההערה לנציג כבר ניסחה את אותה עובדה בלי הפסוקית, והיא לא זזה.
  assert.match(CODE, /ממיר נוסף בתוספת חודשית לפי הרשומה/);
  assert.match(CODE, /ממיר נוסף\/מגדיל טווח בתוספת חודשית לפי הרשומה/);
});
