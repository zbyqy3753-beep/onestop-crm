import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { computeSaving, isComparable } from "../src/app/lp/catalog/savings.ts";

const SRC = readFileSync(new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url), "utf8");
const P = basePackages();

/*
 * סבב 65, `SavingsCalculator.tsx`. משפט העלויות החד-פעמיות הובטח
 * "נציג … יגיד לכם בדיוק כמה תחסכו" גם בענף שבו המנוע בדיוק הכחיש
 * שיש חיסכון. סבב 60 גידר את המשפט ב-`!noMatch` — ענף רדום — והחמיץ
 * את `worthwhile`, הענף היחיד שהגולש באמת רואה.
 */

/** הנגזרות של הרכיב, כפי שהוא גוזר אותן. */
function stateOf(track, units, spend) {
  const saving = computeSaving(P, track, units, spend);
  return { saving, worthwhile: saving.worthwhile, noMatch: saving.pick == null };
}

test("סבב 65: הענף הרדום והענף החי — הסריג קובע מי מהם מוצג", () => {
  let live = 0;
  let dead = 0;
  for (const track of ["cellular", "home"]) {
    for (let units = 1; units <= 10; units++) {
      for (let spend = 10; spend <= 5000; spend++) {
        const { worthwhile, noMatch } = stateOf(track, units, spend);
        if (noMatch) dead++;
        else if (!worthwhile) live++;
      }
    }
  }
  /*
   * ⚠️ המספרים האלה הם כל ההנמקה של התיקון: `noMatch` אינו ניתן
   * להגעה, ולכן הגידור של סבב 60 לא הזיז דבר על המסך, בזמן
   * ש-`!worthwhile && !noMatch` חי ומוצג.
   */
  assert.equal(dead, 0, "ענף `noMatch` נעשה ניתן להגעה — הגידור של סבב 60 אינו רדום עוד");
  assert.ok(live > 0, "ענף `!worthwhile` נעשה בלתי-ניתן להגעה");

  /* ושתי הבריכות עומדות — זה מה שמשאיר את `noMatch` רדום. */
  for (const track of ["cellular", "home"]) {
    assert.ok(P.filter((p) => isComparable(p, track)).length > 0, `הבריכה של ${track} התרוקנה`);
  }
});

test("סבב 65: בענף שבו אין חיסכון, המשפט אינו מבטיח 'בדיוק כמה תחסכו'", () => {
  /*
   * שני המסלולים החיים, בחבילות אמיתיות: בית/₪100 (id 157 נבחרת,
   * `monthly` שלילי) וסלולר/קו אחד/₪30 (id 121).
   */
  const home = stateOf("home", 1, 100);
  assert.equal(home.noMatch, false);
  assert.equal(home.worthwhile, false);
  assert.equal(String(home.saving.pick?.id), "157");
  assert.ok(home.saving.monthly < 0, "המנוע מצא חיסכון — התרחיש אינו מה שהבדיקה מתארת");

  const cell = stateOf("cellular", 1, 30);
  assert.equal(cell.noMatch, false);
  assert.equal(cell.worthwhile, false);
  assert.equal(String(cell.saving.pick?.id), "121");
  assert.ok(cell.saving.monthly < 0);

  /*
   * ⚠️ נבדק הנוסח ה**מרונדר** ולא עצם הימצאות המחרוזת: הביטוי מופיע
   * גם בהערה שמעליו, שם הוא תיעוד ולא DOM. אותה אמת-מידה של סבב 60.
   */
  assert.match(
    SRC,
    /\?\s*worthwhile\s*\n?\s*\?\s*"עלויות חד-פעמיות \(מעבר, חיבור, התקנה\) אינן נכללות, [^"]*נציג יעבור אתכם על החשבון ויגיד לכם בדיוק כמה תחסכו\."\s*\n?\s*:\s*"עלויות חד-פעמיות \(מעבר, חיבור, התקנה\) אינן נכללות בהשוואה שנעשתה כאן, [^"]*נציג יעבור אתכם על החשבון ויבדוק אם יש בכלל מה לחסוך\."/,
  );

  /*
   * וההבטחה הכמותית אינה חיה בענף השלילי: הנוסח שלו נגמר ב"אם יש
   * בכלל מה לחסוך". (הביטוי מופיע עוד פעם אחת בהערה שמעל הפסקה,
   * שם הוא תיעוד ולא DOM — ולכן נבדק המשפט ולא מספר המופעים.)
   */
  assert.equal(
    /ויבדוק אם יש בכלל מה לחסוך\."[\s\S]{0,80}בדיוק כמה תחסכו/.test(SRC),
    false,
    "הענף השלילי עוד מבטיח סכום",
  );
});

test("סבב 65: הפיצול עוקב אחרי `notDeducted`, שכנו באותה פסקה", () => {
  /*
   * `notDeducted` כבר מפוצל ב-`worthwhile` מאותו נימוק מילה במילה
   * (סכום החיסכון מרונדר רק בענף החיובי) — התיקון הזה מיישם אותו
   * כלל על המשפט השלישי באותה פסקה.
   */
  assert.match(
    SRC,
    /const notDeducted = worthwhile \? "מנוכה מהחיסכון שמוצג כאן" : "נכללת בהשוואה שנעשתה כאן";/,
  );
  /* והגידור החיצוני של סבב 60 נשאר על שלושת המשפטים. */
  assert.match(SRC, /\{!noMatch\s*\n?\s*\?\s*worthwhile/);
  assert.match(SRC, /\{!noMatch && CATALOG_DATE \?/);
});
