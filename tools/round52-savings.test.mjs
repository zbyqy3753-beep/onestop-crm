import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { computeSaving, isComparable } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 52 נגע ב-`format.ts` (שער `priceNote`) ובשני רכיבי תצוגה —
 * ולא במנוע. השער ששונה הוא `priceNote` בלבד, ו-`isComparable` אינו
 * קורא לו; אבל `format.ts` הוא קובץ משותף, ולכן הבריכה והבחירות
 * מקובעות כאן כמדידה ולא כהנחה. המספרים נמדדו לפני השינוי ואחריו
 * ויצאו זהים פריט-פריט.
 */

const P = basePackages();

test("round52: בריכת ההשוואה לא זזה", () => {
  const pool = (track) =>
    P.filter((p) => isComparable(p, track))
      .map((p) => String(p.id))
      .sort();
  assert.deepEqual(pool("cellular"), ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"]);
  assert.deepEqual(pool("home"), ["157", "3"]);
});

test("round52: החבילה שנבחרת בכל מסלול וכמות לא זזה", () => {
  /* קו אחד הוא id 121 ב-₪34; משני קווים id 117 ב-₪29.9; הבית תמיד id 157. */
  const pick = (track, units, spend) => {
    const s = computeSaving(P, track, units, spend);
    return `${s.pick ? s.pick.id : "null"}|${s.monthly}|${s.yearly}|${s.worthwhile}|${s.lines}|${s.perLine}`;
  };
  assert.equal(pick("cellular", 1, 100), "121|66|792|true|1|34");
  assert.equal(pick("cellular", 3, 200), "117|110|1320|true|3|29.9");
  assert.equal(pick("cellular", 5, 500), "117|350|4200|true|5|29.9");
  assert.equal(pick("cellular", 10, 500), "117|201|2412|true|10|29.9");
  assert.equal(pick("home", 1, 200), "157|51|612|true|1|149");
  assert.equal(pick("home", 3, 200), "157|51|612|true|3|149");
  assert.equal(pick("home", 5, 500), "157|351|4212|true|5|149");
});
