import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { MAX_SPEND, MAX_TYPED_SPEND, MIN_SPEND } = await import(
  "../src/app/lp/catalog/savings.ts"
);

/*
 * ⚠️ סבב 50, המחשבון — שלוש אמירות שהמשטח השכן באותו כרטיס מכחיש.
 *
 * ⚠️ והן נבדקות על **המקור** ולא על רינדור: שלושתן מחרוזות בשלבים
 * שונים של אשף שהמצב שלו (`step`, `blurred`, `attempted`) חי
 * ב-`useState` בתוך `"use client"`, ולכן `renderToStaticMarkup`
 * מגיש תמיד את שלב 0. זה אותו שיקול שבגללו `round47-calc-ui`
 * קורא את הקובץ ישירות.
 */
const SRC = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");
/** המקור בלי בלוקי ההערות, כדי שהערה לא תספק טענה על טקסט מוצג. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("שלב 0 אינו מבטיח את הקטלוג המלא", () => {
  /*
   * `isComparable` פוסלת 31 מ-33 בבית ו-46 מ-57 בסלולר, ובהן
   * חבילות זולות מהנבחרת. ההסתייגות בשלב 2 כבר אומרת "מבין אלה
   * שניתן להשוות", ולכן ההבטחה שפותחת את הכרטיס הכחישה אותה.
   */
  assert.ok(
    !CODE.includes("הקטלוג המלא"),
    "שלב 0 חזר להבטיח כיסוי של הקטלוג כולו",
  );
  assert.ok(
    CODE.includes("נשווה מול החבילות שאפשר להשוות בקטלוג שלנו"),
    "הנוסח המסויג של שלב 0 אינו במקור",
  );
});

test("הודעת הטווח מצהירה על הטווח שהשדה מקבל, לא על תקרת החישוב", () => {
  /*
   * `MAX_SPEND` הוא תקרת החישוב ו-`MAX_TYPED_SPEND` הוא הפסילה.
   * סכום ביניהם מתקבל ורץ ב-`overCapHint`, שאומר "הסכום המלא יעבור
   * לנציג" — ולכן הודעה שהצהירה על ₪5,000 הובילה את הגולש לקטום את
   * החשבון בעצמו, הנזק שתועד כמתוקן כשהקיטום הוצא מהשדה.
   */
  assert.ok(MAX_TYPED_SPEND > MAX_SPEND, "התקרות התהפכו");
  const line = CODE.split("\n").find((l) => l.includes("הזינו סכום חודשי בין"));
  assert.ok(line, "הודעת הטווח אינה במקור");
  assert.ok(line.includes("MAX_TYPED_SPEND"), "ההודעה מצהירה על תקרת החישוב");
  assert.ok(!line.includes("MAX_SPEND."), "ההודעה עדיין נגזרת מ-MAX_SPEND");
  assert.ok(line.includes(`${MIN_SPEND}`) || line.includes("MIN_SPEND"), "הרצפה נעלמה");
});

test("חותמת הקטלוג אינה נאמרת בענף שבו לא נקרא ממנו מחיר", () => {
  /*
   * בענף `noMatch` ההערה לנציג אומרת " — לא בוצע חישוב" ושורת
   * ה-`(קטלוג ...)` מושמטת ממנה במכוון, ובכל זאת המסך הדפיס
   * "מחירי הקטלוג נכונים ל-...". רדום היום — הבריכה אינה מתרוקנת.
   */
  const line = CODE.split("\n").find((l) => l.includes("מחירי הקטלוג נכונים"));
  assert.ok(line, "חותמת הקטלוג אינה במקור");
  assert.ok(line.includes("!noMatch"), "החותמת אינה מגודרת בענף שבו נעשה חישוב");
});
