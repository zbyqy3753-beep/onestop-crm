import assert from "node:assert/strict";
import { test } from "node:test";

import { renderMail } from "../src/lib/domain/mailTemplate.ts";

const URL = "https://crm.example.com/unsubscribe/abc.def";

test("תבנית: הגוף עטוף RTL", () => {
  const { html } = renderMail({
    subject: "מבצע",
    body: "שלום",
    unsubscribeUrl: URL,
  });
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<html[^>]*lang="he"/);
});

test("תבנית: HTML מהטקסט של המשתמש מנוטרל", () => {
  // ⚠️ הטקסט נכתב בשדה טקסט, לא בעורך HTML. תגית שנכנסה בטעות
  // (או הדבקה מוורד) לא אמורה להפוך לסימון.
  const { html } = renderMail({
    subject: "x",
    body: "<script>alert(1)</script> & <b>מודגש</b>",
    unsubscribeUrl: URL,
  });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>מודגש<\/b>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});

test("תבנית: שורה ריקה פותחת פסקה, שורה בודדת היא ירידת שורה", () => {
  const { html } = renderMail({
    subject: "x",
    body: "שורה א\nשורה ב\n\nפסקה שנייה",
    unsubscribeUrl: URL,
  });
  assert.match(html, /שורה א<br \/>שורה ב/);
  // רק פסקאות הגוף — לפוטר יש <p> משלו, והוא אינו חלק מהספירה
  assert.equal(html.match(/<p style="margin:0 0 16px/g).length, 2);
});

test("תבנית: קישור ההסרה בשתי הגרסאות", () => {
  const { html, text } = renderMail({
    subject: "x",
    body: "שלום",
    unsubscribeUrl: URL,
  });
  assert.ok(html.includes(URL));
  assert.ok(text.includes(URL));
});

test("תבנית: גרסת הטקסט היא הטקסט המקורי, בלי תגיות", () => {
  // ⚠️ הודעה בלי text/plain מקבלת ניקוד ספאם גבוה יותר
  const { text } = renderMail({
    subject: "x",
    body: "שלום דנה",
    unsubscribeUrl: URL,
  });
  assert.ok(text.startsWith("שלום דנה"));
  assert.doesNotMatch(text, /</);
});

test("תבנית: הנושא נכנס לכותרת המסמך, מנוטרל אף הוא", () => {
  const { html } = renderMail({
    subject: "<b>מבצע</b>",
    body: "שלום",
    unsubscribeUrl: URL,
  });
  assert.match(html, /<title>&lt;b&gt;מבצע/);
});
