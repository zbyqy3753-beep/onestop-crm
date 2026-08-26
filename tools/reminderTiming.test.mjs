import assert from "node:assert/strict";
import { test } from "node:test";

// Node 26 מסיר טיפוסים בעצמו, ולכן אפשר לייבא את המקור ישירות
// במקום לתחזק בנייה נפרדת רק בשביל הבדיקות.
import { reminderTiming } from "../src/lib/domain/reminderTiming.ts";

const MIN = 60_000;
/** מועד החזרה בדוגמאות: 10:31. */
const followUp = Date.parse("2026-08-26T07:31:00.000Z");

test("reminderTiming: ההקדמה המלאה כשהשליחה יוצאת בזמן המתוכנן", () => {
  const t = reminderTiming(followUp, followUp - 10 * MIN);
  assert.equal(t.late, false);
  assert.equal(t.aheadMinutes, 10);
});

test("reminderTiming: שליחה שאיחרה את המתוכנן אינה 'איחור' — החזרה עוד לפנינו", () => {
  // בדיוק המקרה שקרה: חזרה ב-10:31, שליחה מתוכננת ל-10:21, והשעון
  // ניקז את התור רק ב-10:25. ההודעה שיצאה אמרה "החזרה הייתה ב-10:31"
  // שש דקות לפני שהחזרה בכלל הגיעה.
  const t = reminderTiming(followUp, followUp - 6 * MIN);
  assert.equal(t.late, false);
  assert.equal(t.aheadMinutes, 6);
});

test("reminderTiming: איחור אמיתי הוא רק אחרי שמועד החזרה עבר", () => {
  const t = reminderTiming(followUp, followUp + 2 * MIN);
  assert.equal(t.late, true);
  assert.equal(t.aheadMinutes, 0);
});

test("reminderTiming: שנייה או שתיים אחרי המועד עדיין אינן איחור", () => {
  const t = reminderTiming(followUp, followUp + 20_000);
  assert.equal(t.late, false);
  assert.equal(t.aheadMinutes, 0);
});

test("reminderTiming: תזכורת שנדחתה לבוקר למחרת מוכרזת כאיחור", () => {
  const t = reminderTiming(followUp, followUp + 20 * 60 * MIN);
  assert.equal(t.late, true);
  assert.equal(t.aheadMinutes, 0);
});
