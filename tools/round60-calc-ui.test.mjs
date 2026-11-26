import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { isComparable, perLinePrice } from "../src/app/lp/catalog/savings.ts";

const SRC = readFileSync(new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url), "utf8");
const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

/*
 * סבב 60, `SavingsCalculator.tsx`. שלושה דברים, כולם בפסקת
 * ההסתייגויות שמתחת לכותרת.
 */

test("סבב 60: ההסתייגות על התוספת החודשית נוקבת בחיסכון ולא ב'מחיר שמופיע כאן'", () => {
  /*
   * ⚠️ ארבעת הנוסחים תלו את התוספת ב"המחיר שמופיע כאן" — ומחיר
   * החבילה אינו מופיע על המסך אף פעם (ההערה בראש הקובץ קובעת
   * שהכותרת היא החיסכון). שני הסכומים היחידים בכרטיס הם החשבון
   * שהגולש הקליד וסכום החיסכון, ולכן הקריאה הטבעית הייתה שהתוספת
   * אינה כלולה בחשבון **של הגולש** — ההיפוך של מה שההסתייגות
   * נכתבה לומר.
   */
  assert.equal(SRC.includes("במחיר שמופיע כאן"), false, "הנוסח הישן חזר");

  /*
   * ⚠️ נבדקים ארבעת הנוסחים ה**מרונדרים** ולא עצם הימצאות
   * המחרוזת: הביטוי מופיע גם בהערה שמעליהם, שם הוא תיעוד ולא DOM.
   */
  /*
   * ⚠️ סבב 61: ארבעת הנוסחים עברו ממחרוזת קבועה ל-
   * `${notDeducted}`, ולכן האסרציה נעצרת לפני הפסוקית.
   * הסיבה: סכום החיסכון מרונדר **רק** בענף `worthwhile`, ובענף
   * "אתם כבר משלמים מעט יחסית" (140 חשבונות בית שלמים
   * ₪10–₪149, חבילה 157) אין על הכרטיס שום סכום מלבד החשבון
   * שהגולש הקליד — כלומר "החיסכון שמוצג כאן" הצביע שם על
   * מספר שאינו קיים, אותו פגם שהסבב הזה יצא לתקן, במשטח
   * אחד פחות. שתי הפסוקיות נבדקות בבדיקה של סבב 61.
   */
  const rendered = [
    /`\$\{extraConverterPhrase\}, ומגדיל טווח, הם תוספת חודשית שהרשומה מצהירה עליה ואינה \$\{notDeducted\}/,
    /`\$\{extraConverterPhrase\} הוא תוספת חודשית שהרשומה מצהירה עליה ואינה \$\{notDeducted\}/,
    /`מגדיל טווח הוא תוספת חודשית שהרשומה מצהירה עליה ואינה \$\{notDeducted\}/,
    /ובה קו הטלפון כלול בתוספת חודשית שהרשומה מצהירה עליה ושאינה \$\{notDeducted\}/,
  ];
  for (const re of rendered) assert.match(SRC, re);

  // וההבטחה שנותרת היא בדיוק מה שהמנוע עושה: הוא אינו מחסר תוספות.
  const engine = readFileSync(new URL("../src/app/lp/catalog/savings.ts", import.meta.url), "utf8");
  assert.match(engine, /Math\.round\(spend \* 100\) - Math\.round\(perLine \* 100\) \* unitCount/);
});

test("סבב 60: משפט העלויות החד-פעמיות מגודר ב-!noMatch, כמו שני שכניו", () => {
  /*
   * ⚠️ בענף `noMatch` לא נקרא מהקטלוג שום מחיר ולא נעשה שום חישוב
   * (ההערה לנציג אומרת שם " — לא בוצע חישוב"), ובכל זאת המשפט
   * הזה הצהיר שעלויות חד-פעמיות "אינן נכללות" — לא נכללות במה? —
   * ושנציג "יגיד לכם בדיוק כמה תחסכו", הבטחת דיוק על בדיקה שהיא
   * ידנית מעצם הגדרת הענף. שכנו מלמעלה (משפט ההשוואה) ושכנו
   * מלמטה (חותמת הקטלוג) כבר מגודרים.
   */
  /*
   * ⚠️ סבב 65: הגידור ב-`!noMatch` נשאר כפי שהוא, אבל נוסף **בתוכו**
   * פיצול ב-`worthwhile`, ולכן האסרציה עוברת דרכו. הסיבה: הענף
   * ש-`!noMatch` סוגר הוא זה שההערה כאן מצהירה עליו כ"רדום" (ואומת
   * שוב בסבב 65: אפס מצבי `noMatch` על כל הסריג), בעוד הסתירה שכן
   * מוצגת יושבת ב-`!worthwhile` — 2,963 מצבים שבהם המסך פוסק "לא
   * נוכל להבטיח חיסכון" ומבטיח שתי שורות אחריו ש"נציג יגיד לכם בדיוק
   * כמה תחסכו". הנוסח הראשון (`worthwhile`) הוא מילה במילה זה שסבב 60
   * קיבע; הנוסח השני נבדק בסבב 65.
   */
  assert.match(
    SRC,
    /\{!noMatch\s*\n?\s*\?\s*worthwhile\s*\n?\s*\?\s*"עלויות חד-פעמיות \(מעבר, חיבור, התקנה\) אינן נכללות/,
  );
  assert.match(SRC, /\{!noMatch && CATALOG_DATE \? ` מחירי הקטלוג נכונים ל-\$\{CATALOG_DATE\}\.` : ""\}/);

  // רדום היום: הבריכה אינה מתרוקנת באף מסלול וכמות, ולכן אין מספר שזז.
  for (const track of ["cellular", "home"]) {
    const pool = P.filter((p) => isComparable(p, track));
    assert.ok(pool.length > 0, `הבריכה של ${track} התרוקנה`);
  }
});

test("סבב 60: ההערות אינן נוקבות בנתון שהמנוע מכחיש", () => {
  /*
   * ⚠️ שלוש אמירות בהערות היו שגויות מול הרצה. הן אינן מוצגות
   * לגולש, אבל הן ההנמקה שהעורך הבא קורא לפני שהוא נוגע בשערים.
   */

  // 1. ids 90 ו-91 **בבריכה**; הן אינן נבחרות כי המנוע מתמחר אחרי ההטבה.
  for (const id of ["90", "91"]) {
    assert.equal(isComparable(byId(id), "cellular"), true, `id ${id} נפסלה בפועל`);
  }
  assert.ok(perLinePrice(byId("91"), 1) > perLinePrice(byId("121"), 1));
  assert.ok(perLinePrice(byId("90"), 1) > perLinePrice(byId("121"), 1));
  assert.equal(/id 91 ב-₪21\.9 ו-id 90 ב-₪29\.9/.test(SRC), false, "ההערה עוד נוקבת ב-90/91 כנפסלות");

  // ושלוש ה-ids שהחליפו אותן באמת נפסלות ובאמת זולות מהנבחרת.
  for (const id of ["23", "46", "24"]) {
    const p = byId(id);
    assert.equal(isComparable(p, "cellular"), false, `id ${id} אינה נפסלת`);
    assert.ok(p.price < 34, `id ${id} אינה זולה מ-id 121`);
  }

  // 2. id 3 היא `type: "סיבים"` — מה שמכניס את שתיהן לבריכה הוא `hasTv`.
  assert.equal(byId("3").type, "סיבים");
  assert.equal(byId("157").type, "טריפל");
  assert.equal(byId("3").spec?.hasTv, true);
  assert.equal(byId("157").spec?.hasTv, true);
  assert.equal(/\*\*שתי\*\* רשומות — שתיהן טריפל/.test(SRC), false, "ההערה עוד אומרת 'שתיהן טריפל'");

  // 3. ציר ההשוואה של id 3 הוא ₪229 (מחיר אחרי ההטבה), לא ₪174.
  assert.equal(byId("3").price, 174);
  assert.equal(perLinePrice(byId("3"), 1), 229);
  assert.equal(/157 זולה \(149 מול 174\)/.test(SRC), false, "ההערה עוד נוקבת ב-174");
  assert.match(SRC, /157 זולה \(149 מול 229\)/);
});
