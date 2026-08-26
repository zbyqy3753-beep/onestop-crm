import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRecipients,
  detectRecipientColumns,
} from "../src/components/mailer/recipientColumns.ts";

test("עמודות: כותרת בעברית מזוהה", () => {
  const matrix = [
    ["שם מלא", "אימייל", "עיר"],
    ["דנה כהן", "dana@gmail.com", "חיפה"],
  ];
  const d = detectRecipientColumns(matrix);
  assert.equal(d.hadHeader, true);
  assert.deepEqual(d.mapping, { emailAt: 1, nameAt: 0 });
  assert.deepEqual(d.headers, ["שם מלא", "אימייל", "עיר"]);
});

test("עמודות: כותרת באנגלית מזוהה", () => {
  const d = detectRecipientColumns([
    ["Name", "E-mail"],
    ["Dana", "dana@gmail.com"],
  ]);
  assert.deepEqual(d.mapping, { emailAt: 1, nameAt: 0 });
});

test("עמודות: בלי כותרת — מזוהה לפי תוכן", () => {
  // ⚠️ קובץ בלי שורת כותרת הוא המקרה הנפוץ בייצוא ממערכות ישנות.
  // זיהוי לפי תוכן מונע מהשורה הראשונה להיבלע כאילו הייתה כותרת.
  const d = detectRecipientColumns([
    ["דנה כהן", "dana@gmail.com"],
    ["יוסי לוי", "yossi@gmail.com"],
  ]);
  assert.equal(d.hadHeader, false);
  assert.deepEqual(d.mapping, { emailAt: 1, nameAt: 0 });
});

test("עמודות: קובץ בלי עמודת מייל מוחזר בלי מיפוי", () => {
  const d = detectRecipientColumns([
    ["שם", "טלפון"],
    ["דנה", "0501234567"],
  ]);
  assert.equal(d.mapping, null);
});

test("עמודות: קובץ ריק אינו מפיל", () => {
  assert.equal(detectRecipientColumns([]).mapping, null);
  assert.equal(detectRecipientColumns([[]]).mapping, null);
});

test("נמענים: שאר העמודות הופכות לשדות מיזוג לפי הכותרת", () => {
  const matrix = [
    ["שם מלא", "אימייל", "עיר"],
    ["דנה כהן", "dana@gmail.com", "חיפה"],
  ];
  const rows = buildRecipients(matrix, detectRecipientColumns(matrix));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "dana@gmail.com");
  assert.equal(rows[0].name, "דנה כהן");
  assert.equal(rows[0].fields["עיר"], "חיפה");
});

test("נמענים: בלי כותרת השדות מקבלים שם לפי מיקום", () => {
  const matrix = [["דנה", "dana@gmail.com", "חיפה"]];
  const rows = buildRecipients(matrix, detectRecipientColumns(matrix));
  assert.equal(rows[0].fields["עמודה 3"], "חיפה");
});

test("נמענים: שורה בלי מייל נשמרת ומסומנת, ולא נעלמת", () => {
  // ⚠️ השמטה שקטה היא איך שנמענים "נעלמים" בלי שאיש ידע.
  // המסך סופר אותן — ולכן הן חייבות לחזור מכאן.
  const matrix = [
    ["שם", "אימייל"],
    ["דנה", "dana@gmail.com"],
    ["יוסי", "לא כתובת"],
    ["", ""],
  ];
  const rows = buildRecipients(matrix, detectRecipientColumns(matrix));
  assert.equal(rows.length, 2);
  assert.equal(rows[1].email, "");
  assert.equal(rows[1].name, "יוסי");
});
