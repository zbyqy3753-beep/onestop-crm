import assert from "node:assert/strict";
import { test } from "node:test";

import {
  OUTAGE_MIN_FAILURES,
  detectOutage,
  explainWaError,
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
