import assert from "node:assert/strict";
import { test } from "node:test";

import { isEmail, normalizeEmail } from "../src/lib/email.ts";

test("מייל: רווחים ואותיות גדולות מנורמלים", () => {
  assert.equal(normalizeEmail("  Dana@Gmail.COM "), "dana@gmail.com");
  assert.equal(normalizeEmail("A.B@Example.Co.IL"), "a.b@example.co.il");
});

test("מייל: הצורה שאאוטלוק מדביק — סוגריים משולשים — מתקלפת", () => {
  assert.equal(normalizeEmail("<dana@gmail.com>"), "dana@gmail.com");
  assert.equal(normalizeEmail('"דנה" <dana@gmail.com>'), "dana@gmail.com");
});

test("מייל: מה שאינו כתובת מוחזר null ולא מתוקן בכוח", () => {
  // ⚠️ זו הסכנה האמיתית: לנחש כתובת מתא פגום ולשלוח לאדם אחר.
  assert.equal(normalizeEmail("dana@gmail"), null);
  assert.equal(normalizeEmail("dana at gmail.com"), null);
  assert.equal(normalizeEmail("dana@@gmail.com"), null);
  assert.equal(normalizeEmail("dana@gmail..com"), null);
  assert.equal(normalizeEmail("@gmail.com"), null);
  assert.equal(normalizeEmail("dana@.com"), null);
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail("   "), null);
});

test("מייל: תא שמכיל שתי כתובות נדחה ולא נחתך לראשונה", () => {
  // חיתוך שקט היה שולח לאחד ומשמיט את השני בלי שאיש ידע
  assert.equal(normalizeEmail("a@b.com, c@d.com"), null);
  assert.equal(normalizeEmail("a@b.com; c@d.com"), null);
});

test("מייל: isEmail עקבי עם normalizeEmail", () => {
  assert.equal(isEmail("Dana@Gmail.COM"), true);
  assert.equal(isEmail("dana@gmail"), false);
});
