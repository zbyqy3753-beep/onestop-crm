import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { computeSaving } from "../src/app/lp/catalog/savings.ts";

const SRC = readFileSync(new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url), "utf8");
const P = basePackages();

/*
 * סבב 61, `SavingsCalculator.tsx`. ההסתייגות על התוספת החודשית במסלול
 * הבית הצביעה על "החיסכון שמוצג כאן" גם בענף שבו שום סכום חיסכון אינו
 * מרונדר — אותו פגם שסבב 60 יצא לתקן, במשטח אחד פחות.
 */

test("סבב 61: הנוסח של ההסתייגות תלוי בענף, כי המספר שהיא מצביעה עליו קיים רק באחד", () => {
  assert.match(
    SRC,
    /const notDeducted = worthwhile\s*\n?\s*\?\s*"מנוכה מהחיסכון שמוצג כאן"\s*\n?\s*:\s*"נכללת בהשוואה שנעשתה כאן";/,
  );

  // וארבעת הנוסחים קוראים אותו, ולא מחרוזת קבועה.
  const rendered = [
    /\$\{extraConverterPhrase\}, ומגדיל טווח, הם תוספת חודשית שהרשומה מצהירה עליה ואינה \$\{notDeducted\}/,
    /\$\{extraConverterPhrase\} הוא תוספת חודשית שהרשומה מצהירה עליה ואינה \$\{notDeducted\}/,
    /`מגדיל טווח הוא תוספת חודשית שהרשומה מצהירה עליה ואינה \$\{notDeducted\}/,
    /ובה קו הטלפון כלול בתוספת חודשית שהרשומה מצהירה עליה ושאינה \$\{notDeducted\}/,
  ];
  for (const re of rendered) assert.match(SRC, re);

  // והנוסח הקבוע הישן אינו חוזר באף אחד מהם.
  assert.equal(/עליה ואינה מנוכה מהחיסכון/.test(SRC), false, "הנוסח הקבוע חזר");
  assert.equal(/עליה ושאינה מנוכה מהחיסכון/.test(SRC), false, "הנוסח הקבוע חזר");
});

test("סבב 61: ההסתייגות אינה מגודרת ב-`worthwhile` — רק מה שהיא נוקבת בו משתנה", () => {
  /*
   * ⚠️ שלוש ההסתייגויות שמתחת לכותרת חיות במכוון מחוץ לשלושת הענפים
   * (ראה ההערה שם), ומי שקיבל פסק דין "משלמים מעט יחסית" זקוק להן
   * לא פחות. גידור ב-`worthwhile` היה מוחק אותן בדיוק שם.
   */
  assert.match(SRC, /const equipExtra = track === "home" && !noMatch && \(equipConverter \|\| equipExtender\);/);
  assert.match(SRC, /const phoneDisclosure = track === "home" && !noMatch && \(phoneMissing \|\| phoneExtra\);/);
});

test("והראיה שהענף חי: 140 חשבונות בית שלמים מגיעים אליו, וכולם על חבילה 157", () => {
  /*
   * ⚠️ זה המסלול של מי שמחזיק פייבר בלבד (₪114–₪144 לפי שלב 0 שבראש
   * הקובץ): שני השערים דולקים על id 157 — `extraConverterCost: 15`
   * ותוספת הקו — ו-`worthwhile` כבוי, כלומר אין על הכרטיס שום סכום
   * מלבד החשבון שהגולש הקליד.
   */
  const unworthwhile = [];
  for (let spend = 10; spend <= 5000; spend++) {
    const s = computeSaving(P, "home", 1, spend);
    if (s.pick != null && !s.worthwhile) unworthwhile.push(spend);
  }
  assert.equal(unworthwhile.length, 140);
  assert.equal(unworthwhile[0], 10);
  assert.equal(unworthwhile.at(-1), 149);

  const pick = computeSaving(P, "home", 1, 120).pick;
  assert.equal(String(pick.id), "157");
  assert.equal(pick.spec.extraConverterCost, 15);
  assert.equal(pick.spec.hasPhone, true);
});
