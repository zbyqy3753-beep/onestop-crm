import assert from "node:assert/strict";
import { test } from "node:test";

// הרצה: npx tsx --test tools/xlsxWrite.test.mjs
// (ולא node --test כמו שאר הבדיקות כאן: המודול מייבא את ./tz בלי
// סיומת, ומפשיט הטיפוסים המובנה של Node דורש נתיב מלא.)
import { buildXlsx } from "../src/lib/xlsxWrite.ts";

/**
 * הרכיבים נכתבים ללא דחיסה, ולכן ה-XML מופיע כמות שהוא בתוך ה-ZIP —
 * מספיק לפרוס את הבתים כטקסט כדי לבדוק מה נכתב לתאים, בלי לגרור
 * מפענח ZIP לתוך הבדיקה.
 */
async function xml(sheet) {
  const bytes = new Uint8Array(await buildXlsx(sheet).arrayBuffer());
  assert.equal(bytes[0], 0x50, "חתימת ZIP");
  assert.equal(bytes[1], 0x4b, "חתימת ZIP");
  return new TextDecoder("utf-8").decode(bytes);
}

const columns = [{ header: "שדה", width: 12 }];
const oneCell = (cell) => ({ name: "לידים", columns, rows: [[cell]] });

test("xlsx: טלפון נשמר כטקסט ולא מאבד את האפס המוביל", async () => {
  const doc = await xml(oneCell({ kind: "text", value: "0501234567" }));
  // t="inlineStr" + סגנון הטקסט (s="2") — שניהם נחוצים: בלי הפורמט
  // אקסל היה מציג 501234567
  assert.match(doc, /<c r="A2" s="2" t="inlineStr"><is><t xml:space="preserve">0501234567<\/t>/);
});

test("xlsx: תווים בעייתיים ב-XML נמלטים ולא שוברים את הקובץ", async () => {
  const doc = await xml(oneCell({ kind: "text", value: 'א & <ב> "ג"' }));
  assert.match(doc, /א &amp; &lt;ב&gt; &quot;ג&quot;/);
});

test("xlsx: תאריך נכתב כמספר סידורי לפי שעון ישראל", async () => {
  // 21:30 UTC ב-16/08 הם 00:30 של ה-17/08 בישראל — היום הקלנדרי
  // שהמשתמש רואה במסך, וזה מה שצריך להופיע בגיליון
  const doc = await xml(oneCell({ kind: "date", value: "2026-08-16T21:30:00.000Z" }));
  assert.match(doc, /<c r="A2" s="3"><v>46251<\/v><\/c>/);
});

test("xlsx: תאריך ושעה שומרים את השעה", async () => {
  // 06:05 UTC → 09:05 בישראל → 545/1440 מהיממה
  const doc = await xml(oneCell({ kind: "dateTime", value: "2026-08-17T06:05:00.000Z" }));
  assert.match(doc, /<c r="A2" s="4"><v>46251\.378/);
});

test("xlsx: תאריך פגום יורד לטקסט במקום להפיל את הקובץ", async () => {
  const doc = await xml(oneCell({ kind: "date", value: "לא תאריך" }));
  assert.match(doc, /<c r="A2" s="2" t="inlineStr"><is><t>לא תאריך<\/t>/);
});

test("xlsx: סכום נכתב כמספר, כדי שאפשר יהיה לסכם אותו", async () => {
  const doc = await xml(oneCell({ kind: "money", value: 120 }));
  assert.match(doc, /<c r="A2" s="5"><v>120<\/v><\/c>/);
  assert.match(doc, /numFmtId="166"/);
});

test("xlsx: תא ריק לא נכתב בכלל", async () => {
  const doc = await xml(oneCell({ kind: "blank" }));
  assert.match(doc, /<row r="2"><\/row>/);
});

test("xlsx: הגיליון נפתח RTL, עם כותרת קפואה ופילטרים", async () => {
  const doc = await xml(oneCell({ kind: "text", value: "ערך" }));
  assert.match(doc, /rightToLeft="1"/);
  assert.match(doc, /<pane ySplit="1" topLeftCell="A2"[^>]*state="frozen"\/>/);
  assert.match(doc, /<autoFilter ref="A1:A2"\/>/);
  assert.match(doc, /<col min="1" max="1" width="12" customWidth="1"\/>/);
});

test("xlsx: שם כרטיסייה נחתך ומנוקה מתווים שאקסל אוסר", async () => {
  const doc = await xml({
    name: "לידים/2026: [חדש]",
    columns,
    rows: [[{ kind: "text", value: "ערך" }]],
  });
  assert.match(doc, /<sheet name="לידים 2026   חדש " sheetId="1"/);
});
