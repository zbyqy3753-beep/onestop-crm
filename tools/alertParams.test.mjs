import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dealWonBody,
  dealWonParams,
  hotLeadBody,
  hotLeadParams,
  overdueBody,
  overdueParams,
  unassignedBody,
  unassignedParams,
  yesLeadBody,
  yesLeadParams,
} from "../src/lib/domain/alerts.ts";

/* ── פרמטרים של התראות ─────────────────────────────────────────────────
 *
 * ⚠️ כל הגופים כאן הם snapshot מופרד ב-`|`, והפרמטרים מחולצים ממנו
 * בזמן השליחה. **השם מגיע מטופס `/lp` הציבורי**, שמאמת אורך בלבד —
 * כלומר כל אחד יכול לשלוח בו כל תו. שתי הבעיות שהבדיקות האלה נועלות
 * נראו בפועל: מפריד בתוך הערך מזיז את כל השדות אחריו, ורצף רווחים או
 * ירידת שורה נדחים על ידי מטא והתראה שלמה נופלת בשקט.
 */

/** מה שמטא דוחה בפרמטר תבנית: ירידת שורה, טאב, או 4+ רווחים רצופים. */
function metaRejects(param) {
  return /[\n\r\t]/.test(param) || /\s{4,}/.test(param);
}

test("התראות: מפריד בתוך השם אינו מזיז את הטלפון ואת המשויך", () => {
  // ⚠️ זה הבאג. לפני התיקון הפרמטרים היו ["דני", "—", "0501234567"]:
  // הטלפון נעלם, והשדה "שויך ל" הציג את מספר הטלפון.
  assert.deepEqual(yesLeadParams(yesLeadBody("דני | כהן", "0501234567", "טלי")), [
    "דני כהן",
    "0501234567",
    "טלי",
  ]);

  assert.deepEqual(
    dealWonParams(dealWonBody("דני | כהן", "0501234567", "ניב")),
    ["דני כהן", "0501234567", "ניב"],
  );

  assert.deepEqual(hotLeadParams(hotLeadBody("דני | כהן", "0501234567")), [
    "דני כהן",
    "0501234567",
  ]);

  assert.deepEqual(
    overdueParams(overdueBody("דני | כהן", "0501234567", "ניב", "10:30")),
    ["דני כהן", "0501234567", "ניב", "10:30"],
  );
});

test("התראות: רצף של ארבעה רווחים ויותר מתכווץ", () => {
  const params = yesLeadParams(yesLeadBody("דני    כהן", "0501234567", "טלי"));
  assert.deepEqual(params, ["דני כהן", "0501234567", "טלי"]);
  assert.ok(params.every((p) => !metaRejects(p)));
});

test("התראות: ירידת שורה וטאב אינם מגיעים לפרמטר", () => {
  const params = yesLeadParams(
    yesLeadBody("דני\nכהן\tה", "050\r1234567", "טלי"),
  );
  assert.deepEqual(params, ["דני כהן ה", "050 1234567", "טלי"]);
  assert.ok(params.every((p) => !metaRejects(p)));
});

test("התראות: שם ריק או רווחים בלבד נופל לברירת המחדל", () => {
  assert.deepEqual(yesLeadParams(yesLeadBody("   ", "0501234567", "טלי")), [
    "לקוח",
    "0501234567",
    "טלי",
  ]);
  assert.deepEqual(yesLeadParams(yesLeadBody("", "", "")), ["לקוח", "—", "—"]);
  // ⚠️ אף פרמטר אינו ריק: מטא דוחה פרמטר ריק בדיוק כמו רצף רווחים.
  assert.ok(yesLeadParams(yesLeadBody("", "", "")).every((p) => p.length > 0));
});

test("התראות: שם רגיל עובר כמות שהוא", () => {
  assert.deepEqual(
    yesLeadParams(yesLeadBody("דנה כהן", "0521234567", "טלי")),
    ["דנה כהן", "0521234567", "טלי"],
  );
  assert.equal(
    yesLeadBody("דנה כהן", "0521234567", "טלי"),
    "ליד חדש מיאס | לקוח: דנה כהן | טלפון: 0521234567 | שויך ל: טלי",
  );
});

test("ליד לא משויך: סוגריים בשם אינם גוזלים את מקום הטלפון", () => {
  // ⚠️ כאן הסוגריים הם המפריד. לפני התיקון התוצאה הייתה
  // ["אלירן", "דני", "הבית"] — המנהל קיבל "הבית" במקום טלפון.
  assert.deepEqual(
    unassignedParams(unassignedBody("אלירן", "דני (הבית)", "0501234567")),
    ["אלירן", "דני הבית", "0501234567"],
  );
});

test("ליד לא משויך: ירידת שורה בשם אינה מוחקת את כל ההתראה", () => {
  // ⚠️ לפני התיקון הביטוי הרגולרי לא התאים בכלל, וההתראה יצאה
  // ["מנהל", "לקוח", "—"] — כלומר בלי שום מידע שימושי.
  const params = unassignedParams(
    unassignedBody("אלירן", "דני\nכהן", "0501234567"),
  );
  assert.deepEqual(params, ["אלירן", "דני כהן", "0501234567"]);
  assert.ok(params.every((p) => !metaRejects(p)));
});

test("ליד לא משויך: גוף שאינו בתבנית עדיין מחזיר פרמטרים בטוחים", () => {
  const params = unassignedParams("זבל");
  assert.equal(params.length, 3);
  assert.ok(params.every((p) => p.length > 0 && !metaRejects(p)));
});
