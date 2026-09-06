import assert from "node:assert/strict";
import { test } from "node:test";

import {
  OUTAGE_MIN_FAILURES,
  detectOutage,
  explainWaError,
  isAccountBlock,
  BLOCK_RETRY_WINDOW_MS,
  shouldRetryBlocked,
} from "../src/lib/domain/waOutage.ts";

const SENT = "2026-09-01T03:50:22.878Z";

test("חסימה: כשל בודד אינו תקלה — מספר פסול אחד נכשל בזמן שהשאר עוברים", () => {
  assert.equal(
    detectOutage({ lastSentAt: SENT, failedSinceCount: 1, latestError: "Message undeliverable" }),
    null,
  );
});

test("חסימה: מתחת לסף שקט, בסף מתריע", () => {
  const below = detectOutage({
    lastSentAt: SENT,
    failedSinceCount: OUTAGE_MIN_FAILURES - 1,
    latestError: "Business eligibility payment issue",
  });
  assert.equal(below, null);

  const at = detectOutage({
    lastSentAt: SENT,
    failedSinceCount: OUTAGE_MIN_FAILURES,
    latestError: "Business eligibility payment issue",
  });
  assert.deepEqual(at, {
    since: SENT,
    count: OUTAGE_MIN_FAILURES,
    error: "Business eligibility payment issue",
  });
});

test("חסימה: הצלחה מאפסת — הספירה היא מאז השליחה המוצלחת האחרונה", () => {
  // ⚠️ זה הכלל כולו. מי שסופר כשלים בלי הקישור להצלחה מקבל אדום
  // קבוע: לכל מערכת יש מספרים פסולים, והם נצברים לנצח.
  assert.equal(
    detectOutage({ lastSentAt: SENT, failedSinceCount: 0, latestError: null }),
    null,
  );
});

test("חסימה: תור ריק שותק — אין כשלים ואין ממה להתריע", () => {
  assert.equal(
    detectOutage({ lastSentAt: null, failedSinceCount: 0, latestError: null }),
    null,
  );
});

test("חסימה: מערכת שמעולם לא שלחה כן מתריעה, ו-since ריק", () => {
  // ⚠️ יום ההקמה: אין `lastSentAt`, אבל שלושה כשלים ברצף הם עדיין
  // חסימה. `since: null` הוא "מעולם", לא "לא ידוע".
  const outage = detectOutage({
    lastSentAt: null,
    failedSinceCount: 7,
    latestError: "Error validating access token",
  });
  assert.deepEqual(outage, {
    since: null,
    count: 7,
    error: "Error validating access token",
  });
});

test("חסימה: שגיאת החיוב של מטא מתורגמת לפעולה, לא לתיאור", () => {
  const hint = explainWaError("Business eligibility payment issue");
  assert.ok(hint?.includes("חיוב"));
  assert.ok(hint?.includes("Billing Hub"));
});

test("חסימה: שגיאה לא מוכרת אינה מומצאת — מחזירה null והבאנר מציג את הגולמי", () => {
  assert.equal(explainWaError("Something Meta invented last tuesday"), null);
  assert.equal(explainWaError(null), null);
});

test("חסימה: הזיהוי אינו תלוי באותיות גדולות או ברווח מסביב", () => {
  // מטא לא מבטיחה ניסוח יציב; הטקסט מגיע כמות שהוא משדה `lastError`.
  assert.ok(explainWaError("  BUSINESS ELIGIBILITY PAYMENT ISSUE  "));
});

/* ── חסימת חשבון מול כשל של הודעה ──────────────────────────────────────
 *
 * ⚠️ ההבחנה הזו קיימת בגלל מה שקרה בפועל: 42 מתוך 44 ההתראות שנכשלו
 * בשלושה שבועות נדחו ב-"Business eligibility payment issue" — כלומר
 * לא היה שום דבר פסול בהודעה עצמה, החשבון היה חסום. שלושת הניסיונות
 * נשרפו תוך שלוש דקות והשורה מתה לתמיד, ולכן העובד "פעם קיבל ופעם לא".
 */

test("ניסיון חוזר: חסימת חיוב היא חסימת חשבון — לא אשמת ההודעה", () => {
  assert.equal(isAccountBlock("Business eligibility payment issue"), true);
});

test("ניסיון חוזר: ויסות האיכות של מטא הוא חסימה זמנית", () => {
  // הניסוח השני שראינו בייצור — פגע במכשיר אחד ולא בשני באותה דקה.
  assert.equal(
    isAccountBlock(
      "This message was not delivered to maintain healthy ecosystem engagement.",
    ),
    true,
  );
});

test("ניסיון חוזר: טוקן שפג ומגבלת קצב הם חסימות חשבון", () => {
  assert.equal(isAccountBlock("Error validating access token"), true);
  assert.equal(isAccountBlock("rate limit hit"), true);
});

test("ניסיון חוזר: תבנית פסולה אינה חסימת חשבון", () => {
  // ⚠️ הגבול כולו כאן. תבנית שלא אושרה לא תאושר מעצמה בעוד חצי שעה,
  // ושורה כזו חייבת להיכשל אחרי שלושה ניסיונות כמו קודם — אחרת היא
  // מסתובבת בתור יממה שלמה בלי שום סיכוי לעבור.
  assert.equal(isAccountBlock("Template name does not exist"), false);
});

test("ניסיון חוזר: כשל רגיל ושגיאה ריקה אינם חסימת חשבון", () => {
  assert.equal(isAccountBlock("Connection Closed"), false);
  assert.equal(isAccountBlock(null), false);
  assert.equal(isAccountBlock(""), false);
});

test("ניסיון חוזר: הזיהוי אינו תלוי באותיות גדולות או ברווח", () => {
  assert.equal(isAccountBlock("  BUSINESS ELIGIBILITY PAYMENT ISSUE  "), true);
});

test("חסימה: ויסות האיכות מתורגם גם הוא לפעולה", () => {
  const hint = explainWaError(
    "This message was not delivered to maintain healthy ecosystem engagement.",
  );
  assert.ok(hint);
});

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
const BILLING = "Business eligibility payment issue";

test("ניסיון חוזר: שורה צעירה שנחסמה ברמת החשבון חוזרת לתור", () => {
  assert.equal(shouldRetryBlocked(BILLING, NOW - 60_000, NOW), true);
});

test("ניסיון חוזר: כשל שאינו חסימת חשבון אינו מקבל הנחה, גם אם הוא צעיר", () => {
  assert.equal(shouldRetryBlocked("Connection Closed", NOW - 60_000, NOW), false);
});

test("ניסיון חוזר: מעבר לחלון מפסיקים לנסות — עדיף כלום מהתראה בת שלושה ימים", () => {
  // ⚠️ הגבול נמדד מרגע היצירה ולא מ-`scheduledFor`, כי כל ניסיון חוזר
  // דוחף את `scheduledFor` קדימה ו-`cancelStale` לעולם לא היה תופס.
  const justInside = NOW - BLOCK_RETRY_WINDOW_MS + 1000;
  const justOutside = NOW - BLOCK_RETRY_WINDOW_MS - 1000;
  assert.equal(shouldRetryBlocked(BILLING, justInside, NOW), true);
  assert.equal(shouldRetryBlocked(BILLING, justOutside, NOW), false);
});

test("ניסיון חוזר: בדיוק על הגבול כבר לא מנסים", () => {
  assert.equal(shouldRetryBlocked(BILLING, NOW - BLOCK_RETRY_WINDOW_MS, NOW), false);
});
