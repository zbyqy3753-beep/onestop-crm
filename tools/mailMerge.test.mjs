import assert from "node:assert/strict";
import { test } from "node:test";

import {
  emptyFieldsIn,
  mergeFieldsIn,
  renderMerge,
} from "../src/lib/domain/mailMerge.ts";

test("מיזוג: שדה מוחלף בערך", () => {
  assert.equal(
    renderMerge("שלום {{שם}}, יש לנו מבצע", { שם: "דנה" }),
    "שלום דנה, יש לנו מבצע",
  );
});

test("מיזוג: רווחים בתוך הסוגריים לא שוברים את ההתאמה", () => {
  assert.equal(renderMerge("שלום {{ שם }}", { שם: "דנה" }), "שלום דנה");
});

test("מיזוג: אותו שדה פעמיים מוחלף בשתיהן", () => {
  assert.equal(renderMerge("{{שם}} ו{{שם}}", { שם: "דנה" }), "דנה ודנה");
});

test("מיזוג: שדה חסר הופך למחרוזת ריקה ולא נשאר כסוגריים", () => {
  // ⚠️ "שלום {{שם}}" שיוצא כמו שהוא ללקוח נראה כמו תקלה במערכת.
  // ריק מכוער פחות — והמסך סופר את השורות האלה לפני השליחה.
  assert.equal(renderMerge("שלום {{שם}}!", {}), "שלום !");
  assert.equal(renderMerge("שלום {{שם}}!", { שם: "  " }), "שלום !");
});

test("מיזוג: ערך שמכיל סוגריים אינו מורחב שוב", () => {
  // אחרת ערך מתא בקובץ היה יכול לשלוף שדה אחר
  assert.equal(
    renderMerge("{{שם}}", { שם: "{{סוד}}", סוד: "1234" }),
    "{{סוד}}",
  );
});

test("מיזוג: רשימת השדות בסדר הופעה ובלי כפילויות", () => {
  assert.deepEqual(mergeFieldsIn("{{שם}} {{עיר}} {{שם}}"), ["שם", "עיר"]);
  assert.deepEqual(mergeFieldsIn("בלי שדות"), []);
});

test("מיזוג: השדות הריקים מדווחים, כדי שהמסך יספור אותם", () => {
  assert.deepEqual(emptyFieldsIn("{{שם}} {{עיר}}", { שם: "דנה" }), ["עיר"]);
  assert.deepEqual(emptyFieldsIn("{{שם}}", { שם: "דנה" }), []);
  assert.deepEqual(emptyFieldsIn("{{שם}}", { שם: "" }), ["שם"]);
});
