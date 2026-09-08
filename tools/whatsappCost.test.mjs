import assert from "node:assert/strict";
import { test } from "node:test";

import {
  WA_RATE_USD,
  costCategoryOf,
  costUsd,
} from "../src/lib/domain/whatsappCost.ts";

/* ── סיווג עלות לפי מפתח הדדופ ─────────────────────────────────────────
 *
 * ⚠️ הבדיקות האלה נכתבו אחרי שהתגלה ש-`lead_hot_he` רשומה במטא
 * כ-MARKETING בזמן שהמסך הציג את התראות הליד החם כחינם. הפער לא היה
 * בתמחור אלא ברשימה: נוספו שבעה סוגי הודעות, ואף אחד מהם לא נכנס
 * ל-`costCategoryOf`, ולכן כולם נפלו ל"תשובה בחלון 24 שעות" = 0.
 */

test("עלות: פנייה יזומה לחידוש היא שיווק", () => {
  assert.equal(costCategoryOf("renewal:opener:abc"), "marketing");
});

test("עלות: דיוור המוני הוא שיווק — הוא הפנייה היזומה הגדולה מכולן", () => {
  assert.equal(costCategoryOf("broadcast:camp1:0501234567"), "marketing");
});

test("עלות: כל התראות הצוות הן תועלת ולא חינם", () => {
  // ⚠️ אלה השבע שנפלו בשקט. כל אחת מהן יוצאת בתבנית, וכל תבנית
  // מחויבת — "לא ברשימה" אף פעם לא אומר "לא עולה כסף".
  for (const key of [
    "followup:lead1:2026-09-08T13:00:00.000Z",
    "overdue:lead1:user1:2026-09-08T13:00:00.000Z",
    "dealwon:event1:user1",
    "unassigned:lead1:user1:2026-09-08T13:00:00.000Z",
    "yeslead:lead1:user1",
    "hotlead:lead1:user1",
    "pwnotice:user1",
  ]) {
    assert.equal(costCategoryOf(key), "utility", key);
  }
});

test("עלות: קוד חד-פעמי הוא אימות", () => {
  assert.equal(costCategoryOf("pwcode:user1"), "authentication");
});

test("עלות: תשובה בתוך חלון 24 השעות היא חינם", () => {
  // רשימת השעות נשלחת אחרי שהלקוח לחץ, ולכן היא בתוך החלון.
  assert.equal(costCategoryOf("renewal:slots:lead1"), "service");
  assert.equal(costUsd("renewal:slots:lead1"), 0);
});

test("עלות: מפתח לא מוכר נופל לחינם ולא מפיל", () => {
  assert.equal(costCategoryOf("משהו:אחר"), "service");
});

test("עלות: תחילית ארוכה גוברת על קצרה — חידוש אינו נבלע", () => {
  // ⚠️ `renewal:opener:` שיווקי ו-`renewal:slots:` חינם. סיווג לפי
  // `renewal:` בלבד היה מחייב את שניהם או מזכה את שניהם.
  assert.notEqual(
    costCategoryOf("renewal:opener:x"),
    costCategoryOf("renewal:slots:x"),
  );
});

test("עלות: התראת ליד חם עולה כמו תזכורת, לא כמו דיוור", () => {
  // הבאג המקורי במספרים: התראה שהוצגה כ-0 עולה בפועל אגורות.
  assert.equal(costUsd("hotlead:lead1:user1"), WA_RATE_USD.utility);
  assert.ok(costUsd("hotlead:lead1:user1") > 0);
});
