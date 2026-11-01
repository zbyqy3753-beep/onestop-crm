import assert from "node:assert/strict";
import { test } from "node:test";

import { resubmissionNotes } from "../src/app/lp/resubmission.ts";

/*
 * ⚠️ סבב 49 — `category` היה השדה החמישי שהטופס מאמת והיחיד שלא
 * נשא איתו עקבה. מבקר שהשאיר פרטים על כרטיס סלולר ואז מילא את
 * המחשבון במסלול הבית קיבל "קיבלנו!", ועמודת הקטגוריה — מפתח
 * הסינון של הנציג, אותו משטח שסבב 47 גידר עבור `packageName` —
 * נשארה "סלולר" בזמן שהבקשה הנוכחית שלו היא "אינטרנט וטלוויזיה".
 */

const lead = (over = {}) => ({
  name: "דני",
  packageName: "wecom300GB 5G · WeCom",
  currentProvider: "cellcom",
  category: "mobile",
  notes: [],
  ...over,
});

const input = (over = {}) => ({
  message: "",
  packageName: "",
  name: "",
  currentProvider: undefined,
  category: undefined,
  ...over,
});

test("סבב 49: קטגוריה שונה מזו שעל הליד היא מידע חדש לנציג", () => {
  assert.deepEqual(resubmissionNotes(input({ category: "tv" }), lead()), [
    "מה שמעניין אותו בפנייה החוזרת: טלוויזיה",
  ]);
  assert.deepEqual(resubmissionNotes(input({ category: "electricity" }), lead()), [
    "מה שמעניין אותו בפנייה החוזרת: חשמל",
  ]);
});

test("סבב 49: אותה קטגוריה אינה מידע חדש", () => {
  assert.deepEqual(resubmissionNotes(input({ category: "mobile" }), lead()), []);
});

test("סבב 49: ליד בלי קטגוריה — הפנייה החוזרת כן מוסרת אותה", () => {
  assert.deepEqual(resubmissionNotes(input({ category: "mobile" }), lead({ category: null })), [
    "מה שמעניין אותו בפנייה החוזרת: סלולר",
  ]);
});

test("סבב 49: השורה נבדקת מול הערות שכבר קיימות — לחיצה כפולה אינה מכפילה", () => {
  const existing = lead({
    notes: [{ body: "מה שמעניין אותו בפנייה החוזרת: טלוויזיה" }],
  });
  assert.deepEqual(resubmissionNotes(input({ category: "tv" }), existing), []);
});

test("סבב 49: ארבעת השדות האחרים לא זזו, וחמשתם יחד נותנים חמש שורות", () => {
  assert.deepEqual(
    resubmissionNotes(
      input({
        message: "משלם היום ₪220 · 3 קווים",
        packageName: "טריפל פלוס 149 · סלקום",
        name: "דניאל",
        currentProvider: "partner",
        category: "tv",
      }),
      lead(),
    ),
    [
      "משלם היום ₪220 · 3 קווים",
      "התעניין גם ב: טריפל פלוס 149 · סלקום",
      "השם שנמסר בפנייה החוזרת: דניאל",
      "הספק שנמסר בפנייה החוזרת: פרטנר",
      "מה שמעניין אותו בפנייה החוזרת: טלוויזיה",
    ],
  );
});

test("סבב 49: מפתח שאינו בטופס נשאר בלי שורה, ולא מדפיס undefined", () => {
  /*
   * ⚠️ `parseCategory` מצמצם את הקלט לחמשת המפתחות של
   * `LANDING_CATEGORIES`, ולכן זו הרשימה שתמיד תחזיק תווית. שער
   * לרענון הבא: מפתח של `LEAD_CATEGORY_CONFIG` שאינו בטופס אינו
   * מייצר שורה פגומה.
   */
  const notes = resubmissionNotes(input({ category: "landline" }), lead());
  assert.deepEqual(notes, []);
});
