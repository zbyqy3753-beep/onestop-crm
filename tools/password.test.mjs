import assert from "node:assert/strict";
import { test } from "node:test";

// Node 26 מסיר טיפוסים בעצמו, ולכן אפשר לייבא את המקור ישירות
// במקום לתחזק בנייה נפרדת רק בשביל הבדיקות.
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../src/lib/password.ts";

/*
 * ⚠️ **כאן ישבו חמש בדיקות שנמחקו יחד עם המדיניות.** הן דרשו שסיסמה
 * תיפסל על רצף (`1234`), על תו חוזר, על הופעה ברשימת הנפוצות, על
 * הכלת השם, ועל סוג תווים יחיד. הכללים הוסרו בבקשת בעל המערכת —
 * ההסבר המלא בראש `src/lib/password.ts` — ולכן הבדיקות ירדו איתם.
 *
 * מי שמחזיר את הכללים מחזיר גם אותן. מה שנשאר כאן הוא שתי הבדיקות
 * שאינן מדיניות חוזק: האורך שנכפה ממילא ב-Supabase, והרווח בקצוות
 * שנועל אנשים בחוץ.
 */

test("password: סיסמה תקינה עוברת", () => {
  assert.equal(passwordProblem("ענן־כחול-7-רחוק"), null);
  assert.equal(passwordProblem("tikva shel yom 9"), null);
});

test("password: קצרה מדי נפסלת", () => {
  const problem = passwordProblem("Ab3!");
  assert.match(problem ?? "", new RegExp(String(MIN_PASSWORD_LENGTH)));
});

test("password: רווח בקצה נפסל ולא נחתך בשקט", () => {
  assert.notEqual(passwordProblem(" ענן־כחול-7-רחוק"), null);
  assert.notEqual(passwordProblem("ענן־כחול-7-רחוק "), null);
});

test("password: הכללים שהוסרו אכן אינם פוסלים", () => {
  // הבדיקה הזו היא התיעוד: אלה בדיוק המחרוזות שנפלו קודם, וכולן
  // אמורות לעבור עכשיו. אם אחת מהן תיפסל שוב — מישהו החזיר כלל.
  assert.equal(passwordProblem("123456"), null);
  assert.equal(passwordProblem("aaaaaa"), null);
  assert.equal(passwordProblem("password"), null);
  assert.equal(passwordProblem("qwertyqwerty"), null);
});
