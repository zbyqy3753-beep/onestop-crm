import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVIVE_WINDOW_MS,
  shouldReviveRow,
} from "../src/lib/domain/requeue.ts";

/* ── החייאת שורה מתה ───────────────────────────────────────────────────
 *
 * ⚠️ נכתב אחרי שנמצאו בייצור 12 לידים שהתזכורת שלהם לא תצא שוב
 * לעולם: `dedupeKey` הוא `@unique` גלובלי, שורות לא נמחקות, ולכן
 * שורה שבוטלה או נכשלה תופסת את המפתח לנצח. כל ניסיון ליצור אותה
 * מחדש נדחה — בשקט, כי ה-catch ב-`enqueueForUser` היה עיוור.
 */

const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);

test("החייאה: שורה שבוטלה כי הוחלפה — והחזרה חזרה לשעתה המקורית", () => {
  // ⚠️ זה התרחיש שהתגלה: נקבעה חזרה ל-16:00, שונתה ל-17:00
  // (`cancelSuperseded` ביטלה את הראשונה), והוחזרה ל-16:00. המפתח
  // זהה, ובלי החייאה פשוט לא תצא תזכורת.
  assert.equal(
    shouldReviveRow({ status: "cancelled", scheduledFor: NOW + 3_600_000, now: NOW }),
    true,
  );
});

test("החייאה: שורה שנכשלה סופית מקבלת הזדמנות שנייה", () => {
  assert.equal(
    shouldReviveRow({ status: "failed", scheduledFor: NOW + 600_000, now: NOW }),
    true,
  );
});

test("החייאה: שורה חיה אינה נוגעים בה", () => {
  // ⚠️ הקריטי מכולם. שורה בתור או בשליחה היא ה-no-op שהדדופ נועד לו,
  // והחייאה שלה הייתה מאפסת ניסיונות של הודעה שבדיוק יוצאת.
  for (const status of ["queued", "sending", "sent"]) {
    assert.equal(
      shouldReviveRow({ status, scheduledFor: NOW + 600_000, now: NOW }),
      false,
      status,
    );
  }
});

test("החייאה: חזרה שמועדה עבר מזמן נשארת מתה", () => {
  // ⚠️⚠️ בלי הגבול הזה התיקון היה גרוע מהבאג: 12 הלידים שנמצאו
  // בייצור היו מתעוררים בבת אחת ושולחים תזכורות על חזרות מאוגוסט.
  assert.equal(
    shouldReviveRow({ status: "cancelled", scheduledFor: NOW - REVIVE_WINDOW_MS - 1000, now: NOW }),
    false,
  );
});

test("החייאה: חזרה שאיחרה מעט כן מוחייאת", () => {
  assert.equal(
    shouldReviveRow({ status: "failed", scheduledFor: NOW - 60_000, now: NOW }),
    true,
  );
});

test("החייאה: בדיוק על הגבול כבר לא", () => {
  assert.equal(
    shouldReviveRow({ status: "cancelled", scheduledFor: NOW - REVIVE_WINDOW_MS, now: NOW }),
    false,
  );
});

test("החייאה: החלון זהה ל-48 השעות של cancelStale", () => {
  // שני הכללים מדברים על אותו דבר — "מאוחר מדי מכדי להיות רלוונטי" —
  // ומספר אחד שונה ביניהם היה יוצר שורה שמוחייאת ומיד מבוטלת.
  assert.equal(REVIVE_WINDOW_MS, 48 * 3_600_000);
});
