import assert from "node:assert/strict";
import { test } from "node:test";

import {
  signUnsubscribe,
  verifyUnsubscribe,
} from "../src/lib/unsubscribeToken.ts";

const SECRET = "test-secret-do-not-use";

test("הסרה: טוקן חוזר לכתובת שממנה נוצר", () => {
  const token = signUnsubscribe("Dana@Gmail.com", SECRET);
  assert.equal(verifyUnsubscribe(token, SECRET), "dana@gmail.com");
});

test("הסרה: הטוקן בטוח לשימוש בכתובת URL", () => {
  const token = signUnsubscribe("a.b+c@example.co.il", SECRET);
  assert.equal(token, encodeURIComponent(token));
});

test("הסרה: טוקן שנערך נדחה", () => {
  const token = signUnsubscribe("dana@gmail.com", SECRET);
  const [payload, sig] = token.split(".");

  // חתימה שהוחלפה
  assert.equal(verifyUnsubscribe(`${payload}.${sig}x`, SECRET), null);
  // מטען שהוחלף, חתימה מקורית — הניסיון להסיר מישהו אחר
  const other = Buffer.from("boss@onestop.co.il").toString("base64url");
  assert.equal(verifyUnsubscribe(`${other}.${sig}`, SECRET), null);
});

test("הסרה: טוקן מסוד אחר נדחה", () => {
  const token = signUnsubscribe("dana@gmail.com", SECRET);
  assert.equal(verifyUnsubscribe(token, "אחר"), null);
});

test("הסרה: זבל אינו מפיל את הפונקציה", () => {
  // הטוקן מגיע משורת הכתובת ולכן הוא קלט של זר
  assert.equal(verifyUnsubscribe("", SECRET), null);
  assert.equal(verifyUnsubscribe("....", SECRET), null);
  assert.equal(verifyUnsubscribe("אין כאן נקודה", SECRET), null);
  assert.equal(verifyUnsubscribe("!!!.???", SECRET), null);
});

test("הסרה: כתובת פגומה אינה מקבלת טוקן", () => {
  assert.throws(() => signUnsubscribe("לא כתובת", SECRET));
});
