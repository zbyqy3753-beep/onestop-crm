import assert from "node:assert/strict";
import { test } from "node:test";

// Node 26 מסיר טיפוסים בעצמו, ולכן אפשר לייבא את המקור ישירות
// במקום לתחזק בנייה נפרדת רק בשביל הבדיקות.
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../src/lib/password.ts";

const ctx = { email: "moshe@onestop.co.il", name: "משה" };

test("password: סיסמה תקינה עוברת", () => {
  assert.equal(passwordProblem("ענן־כחול-7-רחוק", ctx), null);
  assert.equal(passwordProblem("tikva shel yom 9", ctx), null);
});

test("password: קצרה מדי נפסלת", () => {
  const problem = passwordProblem("Ab3!x", ctx);
  assert.match(problem ?? "", new RegExp(String(MIN_PASSWORD_LENGTH)));
});

test("password: אורך בלבד לא מספיק — הסף הישן עבר כאן", () => {
  // אלה בדיוק שתי הסיסמאות שעברו את המדיניות הקודמת (10 תווים, בלי
  // שום דרישה נוספת). הבדיקה קיימת כדי שנסיגה חזרה לשם תיפול.
  assert.notEqual(passwordProblem("123456789012", ctx), null);
  assert.notEqual(passwordProblem("aaaaaaaaaaaa", ctx), null);
});

test("password: רצף עולה או יורד נפסל", () => {
  assert.notEqual(passwordProblem("xk1234mqrtvz", ctx), null);
  assert.notEqual(passwordProblem("xkdcba9mqrtv", ctx), null);
});

test("password: סיסמה נפוצה נפסלת גם כשהיא ארוכה", () => {
  assert.notEqual(passwordProblem("mypassword99", ctx), null);
  assert.notEqual(passwordProblem("qwertyqwerty", ctx), null);
});

test("password: השם או שם המשתמש בתוך הסיסמה נפסלים", () => {
  // הצורה שאנשים באמת בוחרים, ושעוברת אורך ומגוון בלי בעיה.
  assert.notEqual(passwordProblem("moshe2026&xy", ctx), null);
  assert.notEqual(passwordProblem("Onestop2026!", ctx), null);
});

test("password: מילת הקשר קצרה לא פוסלת סיסמה תקינה", () => {
  // `al` הוא שתי אותיות — צירוף מקרי ולא "השם שלו". פסילה עליו הייתה
  // חוסמת סיסמאות תקינות לגמרי.
  assert.equal(
    passwordProblem("balcony window 7", { email: "al@onestop.co.il" }),
    null,
  );
});

test("password: רווח בקצה נפסל ולא נחתך בשקט", () => {
  assert.notEqual(passwordProblem(" ענן־כחול-7-רחוק", ctx), null);
  assert.notEqual(passwordProblem("ענן־כחול-7-רחוק ", ctx), null);
});

test("password: סוג תווים יחיד נפסל", () => {
  assert.notEqual(passwordProblem("qzmvkxwpnhjt", ctx), null);
});

test("password: בלי הקשר המשתמש עדיין נבדק על השאר", () => {
  assert.equal(passwordProblem("ענן־כחול-7-רחוק"), null);
  assert.notEqual(passwordProblem("short"), null);
});
