import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { isComparable } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 51, המחשבון — שלוש אמירות, ושלושתן נבדקות על **המקור**
 * ולא על רינדור: מצב האשף (`step`, `blurred`, `attempted`) חי
 * ב-`useState` בתוך `"use client"`, ולכן `renderToStaticMarkup`
 * מגיש תמיד את שלב 0. אותו שיקול של `round47-calc-ui`.
 */
const SRC = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");
/** המקור בלי ההערות, כדי שהערה לא תספק טענה על טקסט מוצג. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const PKGS = basePackages();
const byId = (id) => structuredClone(PKGS.find((p) => p.id === id));

/* ── 1. כפתור המסלול אינו מבטיח סיבים ────────────────────────────── */

test("תת-הכיתוב הביתי אינו מבטיח סיבים — אין בבריכה אף חבילת סיבים", () => {
  /*
   * הבריכה הביתית היא שתי רשומות (157, 3), שתיהן טריפל. שבע חבילות
   * סיבים-בלבד נפסלות ממנה על דרישת הטלוויזיה **בלבד** — אומת
   * בשיבוט עם `hasTv: true` — ולכן מי שמשלם ₪139 על סיבים נכנס לפי
   * התת-כיתוב ומקבל "אתם כבר משלמים מעט יחסית", בזמן שהקטלוג
   * מחזיק לו את id 154 ב-₪114.
   */
  assert.ok(!CODE.includes("סיבים, טריפל וטלוויזיה"), "התת-כיתוב חזר להבטיח סיבים");
  assert.match(CODE, /חבילות שכוללות אינטרנט וטלוויזיה/);
});

test("והראיה: שבע חבילות סיבים נפסלות על הטלוויזיה בלבד", () => {
  const onlyTv = PKGS.filter((p) => {
    if (isComparable(p, "home")) return false;
    const clone = structuredClone(p);
    if (!clone.spec || typeof clone.spec !== "object") return false;
    clone.spec.hasTv = true;
    return isComparable(clone, "home");
  }).map((p) => p.id);
  assert.deepEqual(onlyTv.sort(), ["100", "113", "115", "154", "82", "86", "99"]);
});

/* ── 2. התוספת החודשית לממיר/מגדיל טווח מגולה ────────────────────── */

test("תוספת חודשית שהרשומה מצהירה עליה בשדה מגולה למסך ולנציג", () => {
  /*
   * id 157, הבחירה הביתית היחידה, נושאת `extraConverterCost: 15`
   * ו-`extraExtenderCost: 14.9`, ו-id 3 נושאת `extraConverterCost: 15`.
   * הגולש נשאל על "הסכום החודשי הכולל" — שבמשק בית עם שני מקלטים
   * כולל את הממיר הנוסף — והגידור היחיד דיבר על עלויות חד-פעמיות.
   */
  assert.equal(byId("157").spec.extraConverterCost, 15);
  assert.equal(byId("3").spec.extraConverterCost, 15);

  assert.match(CODE, /extraConverterCost/, "הנגזרת אינה קוראת את השדה");
  assert.match(CODE, /extraExtenderCost/);
  assert.match(CODE, /ממיר נוסף מעל זה שכלול/, "המסך שותק");
  assert.match(CODE, /ממיר נוסף\/מגדיל טווח בתוספת חודשית/, "ההערה לנציג שותקת");
});

test("ובלי לנקוב בסכום — אותה הכרעה של גילוי קו הטלפון", () => {
  const screen = CODE.slice(CODE.indexOf("ממיר נוסף מעל זה שכלול"));
  assert.ok(!/15 ש|₪15|14\.9/.test(screen.slice(0, 220)), "המסך ציטט סכום שאין מאחוריו שדה מוצג");
});

/* ── 3. הרמז על סכום אבסורדי אינו ממתין ליציאה מהשדה ─────────────── */

test("סכום אבסורדי מדליק את הרמז מיד, בלי `attempted || blurred`", () => {
  /*
   * מי שהדביק 13 ספרות — בדיוק מה ש-`maxLength` מתיר — ראה כפתור
   * מת, `aria-invalid` ריק ורמז ב-`sr-only`: שלושת המשטחים שתקו
   * יחד עד הלחיצה הבאה. הגידור הועתק מ-`overCapHint`, שם הוא נחוץ
   * בגלל מצבי הביניים של קלט תקין (`1,` `6,000.`) — ועל `absurdSpend`
   * הוא מיותר, כי כל רישא של סכום בטווח קטנה או שווה לו.
   */
  assert.match(CODE, /const absurdHint = absurdSpend;/);
  assert.ok(
    !/const absurdHint = absurdSpend && \(attempted \|\| blurred\)/.test(CODE),
    "הגידור חזר",
  );
  // ⚠️ ו-`overCapHint` **כן** נשאר מגודר — שני המצבים אינם סימטריים.
  assert.match(CODE, /const overCapHint = overCap && \(attempted \|\| blurred\)/);
});
