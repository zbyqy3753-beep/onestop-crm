import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HOT_BATCH_LIST_MAX,
  HOT_BATCH_WINDOW_MS,
  hotBatchAppend,
  hotBatchBody,
  hotBatchCount,
  hotBatchParams,
} from "../src/lib/domain/hotLeadBatch.ts";

/* ── מקבץ לידים חמים ───────────────────────────────────────────────────
 *
 * ⚠️ הגוף הוא snapshot מצטבר, כמו בכל ההתראות: הוא נבנה בזמן ההכנסה
 * לתור, מתווסף אליו כל ליד שנכנס בחלון, והפרמטרים מחולצים ממנו בזמן
 * השליחה. באותו רגע אין בידינו את הלידים — רק את מה שנשמר.
 */

test("מקבץ: ליד בודד — גוף תקין ושני פרמטרים", () => {
  const body = hotBatchBody("דנה כהן", "0501234567");
  assert.equal(hotBatchCount(body), 1);
  assert.deepEqual(hotBatchParams(body), ["1", "דנה כהן 0501234567"]);
});

test("מקבץ: הוספה מצטברת, והסדר נשמר", () => {
  let body = hotBatchBody("דנה כהן", "0501234567");
  body = hotBatchAppend(body, "יוסי לוי", "0521234567");
  body = hotBatchAppend(body, "רות אב", "0533334444");

  assert.equal(hotBatchCount(body), 3);
  assert.deepEqual(hotBatchParams(body), [
    "3",
    "דנה כהן 0501234567, יוסי לוי 0521234567, רות אב 0533334444",
  ]);
});

test("מקבץ: מעל התקרה הרשימה נקטעת ונספרת", () => {
  // ⚠️ הספירה היא של **הכול**, גם מה שלא נכנס לרשימה. עובד שרואה
  // "סה״כ 12" ורשימה של 10 מבין שיש עוד; רשימה חתוכה בלי המספר היא
  // שקר שקט.
  let body = hotBatchBody("לקוח 1", "0500000001");
  for (let i = 2; i <= HOT_BATCH_LIST_MAX + 2; i++) {
    body = hotBatchAppend(body, `לקוח ${i}`, `05000000${String(i).padStart(2, "0")}`);
  }

  const [count, list] = hotBatchParams(body);
  assert.equal(count, String(HOT_BATCH_LIST_MAX + 2));
  assert.equal(list.split(", ").length, HOT_BATCH_LIST_MAX + 1);
  assert.ok(list.endsWith("ועוד 2"));
});

test("מקבץ: תו המפריד בשם אינו שובר את החילוץ", () => {
  // ⚠️⚠️ זה הבאג שקיים בכל שאר ההתראות: `fields()` ב-`alerts.ts` מפצל
  // לפי `|`, ושם שמכיל אותו מזיז את כל השדות אחריו. כאן הוא מנוקה
  // בכניסה, כי הגוף הזה נבנה מצטבר ופגיעה בו מקלקלת מקבץ שלם ולא
  // הודעה אחת.
  const body = hotBatchBody("א | ב", "0501234567");
  assert.equal(hotBatchCount(body), 1);
  assert.deepEqual(hotBatchParams(body), ["1", "א ב 0501234567"]);
});

test("מקבץ: ירידת שורה ורווחים כפולים בשם מתקפלים לרווח אחד", () => {
  // פרמטר תבנית לא יכול להכיל ירידת שורה, טאב, או ארבעה רווחים
  // רצופים. בייצור יש שמות עם רווחים כפולים; ייבוא מאקסל מביא גם
  // ירידות שורה בתוך תא.
  const body = hotBatchBody("דוד    קלנצקי\nבן 38", "0532434801");
  const [, list] = hotBatchParams(body);
  assert.equal(list, "דוד קלנצקי בן 38 0532434801");
  assert.ok(!/[\n\t]/.test(list));
  assert.ok(!/ {2}/.test(list));
});

test("מקבץ: שם ריק נופל לברירת מחדל — פרמטר ריק נדחה על ידי מטא", () => {
  const body = hotBatchBody("   ", "0501234567");
  assert.deepEqual(hotBatchParams(body), ["1", "לקוח 0501234567"]);
});

test("מקבץ: טלפון חסר מוצג כמקף ולא כריק", () => {
  const body = hotBatchBody("דנה כהן", "");
  assert.deepEqual(hotBatchParams(body), ["1", "דנה כהן —"]);
});

test("מקבץ: גוף פגום מחזיר פרמטרים בטוחים ולא זורק", () => {
  // ⚠️ אותו עיקרון כמו בשאר החילוצים: שביר, ולכן נופל לאחור במקום
  // להפיל שורה שכבר נשמרה.
  assert.deepEqual(hotBatchParams(""), ["0", "—"]);
  assert.deepEqual(hotBatchParams("משהו אחר לגמרי"), ["0", "—"]);
});

test("מקבץ: החלון הוא חמש דקות", () => {
  assert.equal(HOT_BATCH_WINDOW_MS, 5 * 60_000);
});
