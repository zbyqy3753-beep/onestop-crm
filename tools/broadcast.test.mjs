import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BROADCAST_MAX_CHARS,
  normalizeBroadcastText,
  parsePhoneList,
  renderBroadcastPreview,
} from "../src/lib/domain/broadcast.ts";

test("דיוור: הדבקה מאקסל, מווטסאפ ומהודעה — כולן מפוענחות", () => {
  const { valid } = parsePhoneList(`050-714-1099
0521112233; 054 999 8877
+972 53-1234567`);

  assert.deepEqual(valid, [
    "972507141099",
    "972521112233",
    "972549998877",
    "972531234567",
  ]);
});

test("דיוור: מספר שחוזר על עצמו נכנס פעם אחת", () => {
  const { valid, duplicates } = parsePhoneList("0501234567, 050-1234567, +972501234567");
  assert.deepEqual(valid, ["972501234567"]);
  assert.equal(duplicates, 2);
});

test("דיוור: מה שאינו מספר מוחזר לתיקון ולא מנוחש", () => {
  // ⚠️ זו הסכנה: להשלים ספרה חסרה ולשלוח הודעה לאדם אחר לגמרי.
  //
  // ⚠️ 9 ספרות שמתחילות באפס **כן** תקינות — זה קו נייח (03-1234567),
  // ולא מספר סלולרי קטוע. אותו כלל בדיוק שהייבוא משתמש בו.
  const { valid, invalid } = parsePhoneList("12345, 6543210987654, 0501234567");
  assert.deepEqual(valid, ["972501234567"]);
  assert.deepEqual(invalid, ["12345", "6543210987654"]);
});

test("דיוור: ירידות שורה מאוחדות לרווח — פרמטר תבנית לא יכול להכיל אותן", () => {
  assert.equal(
    normalizeBroadcastText("שורה ראשונה\n\nשורה שנייה   עם רווחים\t"),
    "שורה ראשונה שורה שנייה עם רווחים",
  );
});

test("דיוור: התצוגה המקדימה כוללת את הפתיח ואת ההסרה שהתבנית מוסיפה", () => {
  const preview = renderBroadcastPreview("מבצע חדש");
  assert.ok(preview.includes("מבצע חדש"));
  assert.ok(preview.includes("ONE STOP"));
  assert.ok(preview.includes("הסר"));
});

test("דיוור: התקרה משאירה מרווח מתחת ל-1024 של גוף התבנית", () => {
  const filled = renderBroadcastPreview("א".repeat(BROADCAST_MAX_CHARS));
  assert.ok(filled.length < 1024);
});
