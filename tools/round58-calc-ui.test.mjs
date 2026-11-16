import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url), "utf8");

/*
 * סבב 58, `SavingsCalculator.tsx`. ארבעת המזהים של שלב הסכום
 * (`calc-spend`, `calc-spend-hint`, `calc-spend-note`, `calc-units`)
 * היו מקובעים, בזמן ש-`LeadForm` כבר מתעד את אותו באג מילה במילה
 * כמתוקן דרך `useId`: "שני טפסים ללא `pkg` חיים על אותו דף… לחיצה
 * על התווית 'שם מלא' בטופס התחתון הקפיצה את הפוקוס לשדה של
 * המחשבון". השער חובר למשטח אחד ולא לאחיו — ודווקא לאח שעליו
 * נכתב.
 *
 * רדום היום (קורא אחד בלבד ל-`SavingsCalculator`), ולכן אין שום
 * מספר או נוסח שזז; הבדיקה מקבעת שלא יחזרו מזהים קבועים.
 */

test("סבב 58: מזהי שלב הסכום נגזרים מ-useId ואינם מקובעים", () => {
  assert.match(SRC, /import \{[^}]*\buseId\b[^}]*\} from "react";/);
  assert.match(SRC, /const uid = useId\(\);/);

  for (const name of ["spendId", "hintId", "noteId", "unitsId"]) {
    assert.match(SRC, new RegExp(String.raw`const ${name} = \`calc-[\w-]+\$\{uid\}\`;`), name);
  }
});

test("סבב 58: אין יותר מזהה קבוע בשום תכונה שמקשרת תווית לשדה", () => {
  /*
   * ⚠️ נבדקות התכונות ולא עצם הימצאות המחרוזת: `calc-spend-hint`
   * ממשיך להופיע בהערות הקובץ, ובהן הוא תיעוד ולא DOM.
   */
  for (const attr of ["id", "htmlFor", "aria-describedby"]) {
    const bad = [...SRC.matchAll(new RegExp(String.raw`${attr}="(calc-[^"]*)"`, "g"))];
    assert.deepEqual(
      bad.map((m) => m[1]),
      [],
      `${attr} עוד נושא מזהה קבוע`,
    );
  }

  // ושלושת הקישורים אכן נבנים מהמשתנים.
  assert.equal(SRC.split("aria-describedby={`${hintId} ${noteId}`}").length - 1, 2);
  assert.match(SRC, /htmlFor=\{spendId\}/);
  assert.match(SRC, /htmlFor=\{unitsId\}/);
});

/*
 * ⚠️ והתיעוד שסחף. ההערה על ענף `!confirming` הצהירה ש-`confirming`
 * "מתאפס בשני הכפתורים שמשנים שלב" — איפוס ביציאה, שאינו קיים:
 * `setConfirming(false)` נקרא ממקום אחד בלבד, מיד לפני `setStep(2)`,
 * כפי שההערה על ההצהרה עצמה מתעדת נכון. ההתנהגות תקינה; התיאור לא
 * היה, והוא סתר הערה אחרת באותו קובץ.
 */

test("סבב 58: setConfirming נקרא ממקום אחד, והתיעוד אומר זאת", () => {
  assert.equal(SRC.split("setConfirming(false)").length - 1, 1);
  assert.equal(SRC.includes("מתאפס בשני הכפתורים שמשנים שלב"), false);
  assert.match(SRC, /מתאפס ב\*\*כניסה\*\* לשלב 2/);
});
