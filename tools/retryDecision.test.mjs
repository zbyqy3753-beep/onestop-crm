import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BLOCK_MAX_ATTEMPTS,
  MAX_ATTEMPTS,
  retryDecision,
} from "../src/lib/domain/waOutage.ts";

/* ── החלטת הניסיון החוזר ───────────────────────────────────────────────
 *
 * ⚠️ נכתב אחרי שהתגלה בייצור שהתראת ליד חם נשלחה למטא **כ-48 פעמים**
 * לפני שמתה. השורות שנכשלו הראו `scheduledFor` מאוחר ב-1465 דקות
 * מ-`createdAt` — 24.4 שעות, בדחיפות של 30 דקות — ו-`attempts` שנתקע
 * על 0. הסיבה: `giveUp` הוגדר `!blocked && attempts >= MAX_ATTEMPTS`,
 * כלומר שורה חסומה לא נכנעת **לעולם**, ובמקביל המונה הופחת בכל סבב
 * ולכן גם לא טיפס.
 *
 * ⚠️⚠️ התוצאה לא הייתה רק בזבוז: כל סבב הוא שליחה אמיתית שמטא קיבלה
 * (`providerMessageId` קיים בשורות שנכשלו), ולכן המערכת הפציצה נמען
 * אחד בעשרות הודעות שיווקיות — בדיוק ההתנהגות ששוחקת את המכסה
 * האישית שלו וגרמה לתקלה מלכתחילה.
 */

const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);
const FRESH = NOW - 60_000;
const BILLING = "Business eligibility payment issue";

test("ניסיון: כשל רגיל נכנע אחרי MAX_ATTEMPTS", () => {
  assert.equal(
    retryDecision({ error: "Connection Closed", createdAt: FRESH, now: NOW, attempts: MAX_ATTEMPTS - 1 }),
    "retry",
  );
  assert.equal(
    retryDecision({ error: "Connection Closed", createdAt: FRESH, now: NOW, attempts: MAX_ATTEMPTS }),
    "giveUp",
  );
});

test("ניסיון: חסימת חשבון מקבלת תקציב גדול יותר מכשל רגיל", () => {
  // ⚠️ זו הכוונה המקורית של ההפחתה שהוחלפה: חסימה אינה אשמת ההודעה,
  // ולכן מגיע לה יותר מניסיון אחד — אבל לא אינסוף.
  assert.ok(BLOCK_MAX_ATTEMPTS > MAX_ATTEMPTS);
  assert.equal(
    retryDecision({ error: BILLING, createdAt: FRESH, now: NOW, attempts: MAX_ATTEMPTS }),
    "blocked",
  );
});

test("ניסיון: חסימת חשבון **כן** נכנעת בסוף — זה הבאג שנסגר", () => {
  assert.equal(
    retryDecision({ error: BILLING, createdAt: FRESH, now: NOW, attempts: BLOCK_MAX_ATTEMPTS - 1 }),
    "blocked",
  );
  assert.equal(
    retryDecision({ error: BILLING, createdAt: FRESH, now: NOW, attempts: BLOCK_MAX_ATTEMPTS }),
    "giveUp",
  );
});

test("ניסיון: מעבר לחלון 24 השעות חסימה מפסיקה להיות חסימה", () => {
  // ⚠️ שני הבלמים עצמאיים: התקציב **וגם** החלון. מי שחוצה את החלון
  // עם מונה נמוך נופל להתנהגות של כשל רגיל ולא ממשיך לנצח.
  const old = NOW - 25 * 3_600_000;
  assert.equal(
    retryDecision({ error: BILLING, createdAt: old, now: NOW, attempts: 0 }),
    "retry",
  );
  assert.equal(
    retryDecision({ error: BILLING, createdAt: old, now: NOW, attempts: MAX_ATTEMPTS }),
    "giveUp",
  );
});

test("ניסיון: שורה חדשה לגמרי מנסה שוב, בשני סוגי הכשל", () => {
  assert.equal(
    retryDecision({ error: "Connection Closed", createdAt: FRESH, now: NOW, attempts: 0 }),
    "retry",
  );
  assert.equal(
    retryDecision({ error: BILLING, createdAt: FRESH, now: NOW, attempts: 0 }),
    "blocked",
  );
});

test("ניסיון: שגיאה ריקה מטופלת ככשל רגיל ולא כחסימה", () => {
  assert.equal(
    retryDecision({ error: null, createdAt: FRESH, now: NOW, attempts: 0 }),
    "retry",
  );
  assert.equal(
    retryDecision({ error: null, createdAt: FRESH, now: NOW, attempts: MAX_ATTEMPTS }),
    "giveUp",
  );
});

test("ניסיון: המונה חוסם גם כשהוא כבר מעל התקרה", () => {
  // שורה שאיכשהו צברה יותר מהתקרה לא חוזרת לתור.
  assert.equal(
    retryDecision({ error: BILLING, createdAt: FRESH, now: NOW, attempts: 99 }),
    "giveUp",
  );
});

test("ניסיון: התקציב החסום תוחם את הנזק לסדר גודל של שעות, לא יממה", () => {
  // ⚠️ הבדיקה הזו היא על המספר עצמו, ובכוונה: היא מה שמתעד למה
  // התקרה קיימת. 6 ניסיונות × 30 דקות ≈ 3 שעות, מול 48 שליחות
  // שנמדדו בייצור לפני התיקון.
  assert.equal(BLOCK_MAX_ATTEMPTS, 6);
});
