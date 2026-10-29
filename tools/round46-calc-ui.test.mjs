import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { computeSaving, isComparable, phoneLineCostsExtra } from "../src/app/lp/catalog/savings.ts";

const pkgs = basePackages();
const homePool = pkgs.filter((p) => isComparable(p, "home"));
const calcSrc = fs.readFileSync(new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url), "utf8");
const formSrc = fs.readFileSync(new URL("../src/app/lp/ui/LeadForm.tsx", import.meta.url), "utf8");

/*
 * ⚠️ סבב 46 — ההסתייגות על קו הטלפון נוסחה למצב שאינו המצב שבו היא
 * נדלקת.
 *
 * `phoneDisclosure` מורכב משני מצבים שונים, וההערה לנציג מפצלת
 * ביניהם (`phoneExtra` → "קו טלפון בתוספת לפי הרשומה",
 * `phoneMissing` → "אינה כוללת קו טלפון"). המסך החזיק **מחרוזת אחת**
 * לשניהם, והיא נכתבה למצב השני — בזמן שהחבילה היחידה שנבחרת אי-פעם
 * במסלול הביתי היא id 157, והיא דווקא `phoneExtra`.
 */
test("סבב 46: החבילה הביתית שנבחרת תמיד היא `phoneExtra`, לא `phoneMissing`", () => {
  const seen = new Set();
  for (let spend = 10; spend <= 5000; spend += 10) {
    for (let units = 1; units <= 10; units += 1) {
      const s = computeSaving(homePool, "home", units, spend);
      if (!s.pick) continue;
      seen.add(
        `${s.pick.id}:extra=${phoneLineCostsExtra(s.pick)}:missing=${s.pick.spec?.hasPhone !== true}`,
      );
    }
  }
  // סחיפה מלאה — בחירה אחת, בלי שום וריאציה.
  assert.deepEqual([...seen], ["157:extra=true:missing=false"]);
  /*
   * ⚠️ והרשומה מצהירה על התוספת במפורש: "קו ביתי כלול בתוכנית עם
   * 1000 דקות בתוספת 20 ש״ח". כלומר הקו **כן** כלול והמחיר שלו
   * מוסר — שתי עובדות שהנוסח הקודם ("אינו בהכרח כלול") הכחיש.
   */
  const pick = homePool.find((p) => String(p.id) === "157");
  assert.equal(pick.spec.hasPhone, true);
  assert.match(pick.description, /קו ביתי כלול בתוכנית/);
  // id 3 הוא הענף `phoneMissing`, והוא אינו נבחר אף פעם.
  const other = homePool.find((p) => String(p.id) === "3");
  assert.notEqual(other.spec?.hasPhone, true);
});

test("סבב 46: המסך מחזיק נוסח נפרד לשני ענפי ההסתייגות", () => {
  // ⚠️ הענף הפעיל (`phoneExtra`) אומר שהקו כלול ושהתוספת מוצהרת.
  assert.match(calcSrc, /phoneDisclosure\s*\n?\s*\?\s*phoneExtra/);
  assert.match(calcSrc, /ובה קו הטלפון כלול בתוספת חודשית שהרשומה מצהירה עליה/);
  // ⚠️ והענף השני נשאר למי שהוא נכון עליו, בלי "בהכרח".
  assert.match(calcSrc, /קו טלפון אינו נדרש בה ואינו כלול בה/);
  assert.doesNotMatch(calcSrc, /ואינו בהכרח כלול/);
  /*
   * ⚠️ ובלי לנקוב בסכום: ₪20 יושב בפרוזה של רשומה אחת ולא בשדה, וזו
   * גם השורה שמשתנה ברענון.
   */
  assert.doesNotMatch(calcSrc, /בתוספת 20 ש״ח — הנציג/);
});

/*
 * ⚠️ פאנל האישור הבטיח "החבילה המשתלמת עבורך" לשלושה טפסים שלא חישבו
 * ולא הציגו שום חבילה.
 *
 * ה-doc של `sentSubject` מתאר את הנפילה הקבועה כבאג, אבל רק קורא אחד
 * (המחשבון) עודכן להעביר אותה. שלושה קוראים — `page.tsx`,
 * `[service]/page.tsx` ו-`provider/[slug]/page.tsx` — נשארו על
 * המחרוזת, ובשלושתם גם שדה `packageName` אינו מרונדר בכלל, כלומר
 * הליד נרשם בלי שום חבילה בזמן שהגולש קרא שהפנייה היא "לגבי החבילה
 * המשתלמת" שלו.
 */
test("סבב 46: הנפילה הקבועה בפאנל האישור אינה מבטיחה חבילה", () => {
  assert.doesNotMatch(formSrc, /sentSubject \?\? "לגבי החבילה המשתלמת עבורך"/);
  assert.match(formSrc, /sentSubject \?\? "לגבי הפנייה שלך"/);
});

test("סבב 46: שלושת הקוראים שאינם מעבירים `pkg` ולא `sentSubject` קיימים כפי שתועד", () => {
  const callers = [
    ["../src/app/lp/page.tsx", "<LeadForm />"],
    ["../src/app/lp/[service]/page.tsx", "<LeadForm category={page.lead} />"],
    ["../src/app/lp/provider/[slug]/page.tsx", "<LeadForm category={single?.lead} />"],
  ];
  for (const [rel, tag] of callers) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.ok(src.includes(tag), `${rel} מרנדר ${tag}`);
    // ⚠️ אין בהם `pkg` ואין `sentSubject` — ולכן הנפילה היא מה שהגולש קורא.
    assert.ok(!/sentSubject=/.test(src), `${rel} אינו מעביר sentSubject`);
  }
});
