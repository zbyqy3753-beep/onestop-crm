import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CODE_LENGTH,
  CODE_TTL_MS,
  MAX_CODE_ATTEMPTS,
  formatCode,
  isCodeShape,
  normalizeCode,
} from "../src/lib/resetCode.ts";

test("resetCode: קוד תקין מזוהה", () => {
  assert.equal(isCodeShape("123456"), true);
  assert.equal(isCodeShape("000000"), true);
});

test("resetCode: רווחים ומקפים מההדבקה לא פוסלים", () => {
  assert.equal(normalizeCode(" 123 456 "), "123456");
  assert.equal(isCodeShape("123-456"), true);
  assert.equal(isCodeShape(" 123456\n"), true);
});

test("resetCode: אורך שגוי או תווים שאינם ספרות נפסלים", () => {
  assert.equal(isCodeShape("12345"), false);
  assert.equal(isCodeShape("1234567"), false);
  assert.equal(isCodeShape("12345a"), false);
  assert.equal(isCodeShape(""), false);
});

test("resetCode: אפסים מובילים נשמרים", () => {
  // ⚠️ הרגרסיה הקלאסית: קוד שנשמר כמספר מאבד אפס מוביל, והמשתמש
  // מקליד בדיוק את מה שקיבל ונדחה.
  assert.equal(formatCode(42), "000042");
  assert.equal(formatCode(7), "000007");
  assert.equal(formatCode(0), "000000");
});

test("resetCode: הפורמט תמיד באורך הנכון", () => {
  for (const n of [0, 1, 999999, 1000000, 1234567]) {
    assert.equal(formatCode(n).length, CODE_LENGTH);
    assert.equal(isCodeShape(formatCode(n)), true);
  }
});

test("resetCode: ההגנות לא נחלשו בטעות", () => {
  // הבדיקה קיימת כדי שהחלשה של אחת מהשלוש תיפול כאן ולא בייצור.
  assert.ok(CODE_TTL_MS <= 15 * 60 * 1000, "תפוגה ארוכה מדי לקוד קצר");
  assert.ok(MAX_CODE_ATTEMPTS <= 5, "יותר מדי ניסיונות מותרים");
});

test("resetCode: מיסוך מספר חושף רק ארבע ספרות אחרונות", async () => {
  const { maskPhone } = await import("../src/lib/resetCode.ts");
  assert.equal(maskPhone("972534240008"), "•••0008");
  assert.equal(maskPhone("0534240008"), "•••0008");
  // מספר קצר מדי לא מדליף כלום
  assert.equal(maskPhone("12"), "••••");
});
