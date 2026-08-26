import assert from "node:assert/strict";
import { test } from "node:test";

import { roomForTick } from "../src/lib/domain/mailRate.ts";

test("תקרה: הקצב לתקתוק הוא הגבול כשהתקרה רחוקה", () => {
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 0), 20);
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 100), 20);
});

test("תקרה: קרוב לתקרה — נשאר רק מה שנותר", () => {
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 395), 5);
});

test("תקרה: על התקרה ומעליה — אפס, ולעולם לא שלילי", () => {
  // ⚠️ מספר שלילי היה מגיע ל-`take` של Prisma ומפיל את הניקוז
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 400), 0);
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 999), 0);
});

test("תקרה: 0 = בלי תקרה יומית, הקצב לתקתוק עדיין חל", () => {
  assert.equal(roomForTick({ perTick: 20, dailyCap: 0 }, 10_000), 20);
});

test("תקרה: הגדרה מעוותת לא פותחת את הברז", () => {
  assert.equal(roomForTick({ perTick: -5, dailyCap: 400 }, 0), 0);
});
