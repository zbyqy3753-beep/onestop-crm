import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
 * ⚠️ בדיקת מקור ולא בדיקת התנהגות, במכוון. `actions.ts` הוא
 * `"use server"` עם `await` ברמת המודול בשכבת ה-DB — זו הסיבה שכל
 * בדיקה אחרת בתיקייה הזו **מחליפה** אותו (ראה `lpText.test.mjs`)
 * במקום לטעון אותו. המונה עצמו פרטי למודול. מה שאפשר לקבע כאן הוא
 * האינווריאנט: הודעת "שגיאה זמנית בשמירת הפנייה" מזמינה את הגולש
 * לנסות שוב, ולכן אסור שהיא תצא בלי שהניסיון הוחזר למכסה.
 */
const SRC = readFileSync(new URL("../src/app/lp/actions.ts", import.meta.url), "utf8");

const TEMP_FAIL = 'שגיאה זמנית בשמירת הפנייה';

test("כל יציאה בכשל שמירה מזכה את חותמת המכסה", () => {
  const lines = SRC.split(/\r?\n/);
  const exits = [];
  lines.forEach((line, i) => {
    if (line.includes(TEMP_FAIL) && line.includes("fail(")) exits.push(i);
  });
  assert.ok(exits.length >= 2, `נמצאו ${exits.length} יציאות כשל — צפויות לפחות שתיים`);
  for (const i of exits) {
    const before = lines.slice(Math.max(0, i - 4), i).join("\n");
    assert.match(
      before,
      /refundRateHit\(ip\)/,
      `היציאה בשורה ${i + 1} מזמינה לנסות שוב בלי לזכות את החותמת`,
    );
  }
});

/*
 * ⚠️ והכפילות **אינה** מזוכה: פנייה שהגיעה ליעדה היא פנייה, גם אם
 * היא עדכנה רשומה קיימת. זיכוי שלה היה פותח את המכסה בפני לחיצה
 * כפולה בלולאה — בדיוק מה שהמונה נבנה נגדו.
 */
test("מסלול ההצלחה והכפילות אינם מזכים", () => {
  const sent = SRC.split(/\r?\n/)
    .map((line, i) => [line, i])
    .filter(([line]) => /return \{ status: "sent" \}/.test(line));
  assert.ok(sent.length >= 1, "לא נמצא מסלול הצלחה");
  const refunds = (SRC.match(/refundRateHit\(/g) ?? []).length;
  // ההגדרה + שתי הקריאות ביציאות הכשל, ולא יותר.
  assert.equal(refunds, 3, `נמצאו ${refunds} אזכורים של refundRateHit — צפויים 3`);
});

test("ה-IP נקרא פעם אחת ונשמר, כדי שהזיכוי יפגע באותו מפתח", () => {
  assert.match(SRC, /const ip = await clientIp\(\);/);
  assert.match(SRC, /if \(overRateLimit\(ip\)\)/);
  assert.equal(
    (SRC.match(/await clientIp\(\)/g) ?? []).length,
    1,
    "קריאה שנייה ל-clientIp יכולה להחזיר מפתח אחר, והזיכוי יפספס",
  );
});

test("הזיכוי מסיר חותמת אחת ולא דורס את הרשימה", () => {
  const body = SRC.slice(SRC.indexOf("function refundRateHit"));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  assert.match(fn, /recent\.pop\(\)/, "הזיכוי חייב להסיר חותמת אחת");
  assert.doesNotMatch(fn, /hits\.set\(/, "דריסת הרשימה מחזירה חותמות שפגו או מוחקת חדשות");
  assert.match(fn, /hits\.delete\(ip\)/, "מפתח ריק נמחק, כמו בניקוי שב-overRateLimit");
});
