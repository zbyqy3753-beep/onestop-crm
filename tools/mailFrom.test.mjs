import assert from "node:assert/strict";
import { test } from "node:test";

import { fromHeader } from "../src/lib/domain/mailFrom.ts";

test("שולח: שם ומייל", () => {
  assert.equal(fromHeader("a@b.com", "ONE STOP"), '"ONE STOP" <a@b.com>');
});

test("שולח: בלי שם — הכתובת לבדה, בלי סוגריים ריקים", () => {
  assert.equal(fromHeader("a@b.com", ""), "a@b.com");
  assert.equal(fromHeader("a@b.com", "   "), "a@b.com");
  assert.equal(fromHeader("a@b.com", undefined), "a@b.com");
});

test("שולח: פסיק בשם אינו מפצל את הכותרת לשני נמענים", () => {
  // ⚠️ בלי המרכאות, "ONE STOP, בע״מ" נקרא כשתי כתובות והמייל נדחה
  assert.equal(
    fromHeader("a@b.com", "ONE STOP, בע״מ"),
    '"ONE STOP, בע״מ" <a@b.com>',
  );
});

test("שולח: מרכאות וקו נטוי בשם מנוטרלים", () => {
  assert.equal(fromHeader("a@b.com", 'ONE "STOP"'), '"ONE \\"STOP\\"" <a@b.com>');
  assert.equal(fromHeader("a@b.com", "A\\B"), '"A\\\\B" <a@b.com>');
});

test("שולח: שורה חדשה בשם נחתכת — הזרקת כותרות", () => {
  // ⚠️ שם שמגיע ממשתנה סביבה. תו שורה חדשה בתוך כותרת מאפשר
  // להוסיף כותרות משלך למייל, כולל Bcc.
  assert.equal(fromHeader("a@b.com", "ONE\r\nBcc: x@y.com"), '"ONEBcc: x@y.com" <a@b.com>');
});
