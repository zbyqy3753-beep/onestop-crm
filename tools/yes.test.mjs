import assert from "node:assert/strict";
import { test } from "node:test";

import { isYesLead, mentionsYes } from "../src/lib/domain/yes.ts";

test("יאס: הספק שזוהה מספיק בפני עצמו", () => {
  assert.equal(isYesLead({ currentProvider: "yes" }), true);
  assert.equal(isYesLead({ currentProvider: "hot" }), false);
});

test("יאס: שם החבילה ושדה המקור נבדקים גם הם", () => {
  // הצורה שהגיעה בפועל מהשותפים
  assert.equal(
    isYesLead({ sourceDetail: "FIBER YES+ 1000MB – YES ל 3 שנים" }),
    true,
  );
  assert.equal(isYesLead({ packageName: "יאס אינטרנט 1 גיגה" }), true);
  assert.equal(isYesLead({ packageName: "סלקום 500MB" }), false);
});

test("יאס: 'יס' בתוך מילה עברית אינו ליד של יאס", () => {
  // ⚠️ זו הסיבה שהזיהוי אינו `includes`. בלי גבולות המילה כל ליד עם
  // "ניסיון", "כניסה" או "הפיס" בהערה היה עובר לטלי.
  assert.equal(mentionsYes("ניסיון שני"), false);
  assert.equal(mentionsYes("כניסה חופשית"), false);
  assert.equal(mentionsYes("מפעל הפיס"), false);
  assert.equal(mentionsYes("yesterday"), false);
});

test("יאס: 'יס' כמילה עומדת בפני עצמה כן נתפס", () => {
  assert.equal(mentionsYes("חבילת יס טריפל"), true);
  assert.equal(mentionsYes("יס"), true);
});

test("יאס: ליד ריק אינו של יאס", () => {
  assert.equal(isYesLead({}), false);
  assert.equal(isYesLead({ packageName: "", sourceDetail: null }), false);
});
