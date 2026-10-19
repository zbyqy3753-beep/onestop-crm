import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  declaresRiseInText,
  isComparable,
  routerPricedSeparately,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 38 — שלוש השמטות באותו דפוס: שער שחובר למשטח אחד ולא לאחיו.
 *   • הפסילה על טקסט שנקטע ("…") נבדקה ב-`description` לבדו, בזמן
 *     שחמשת שערי הנוסח קוראים גם `benefits` וגם `priceAfterPromoNote`.
 *   • `מחודש ה13` (id 53) נפל בין `מהחודש ה` לבין `מחודש \d` — ה"א
 *     הידיעה, אותו תיקון שכבר נעשה ל-"ראשונים" ול-"שנה שנייה".
 *   • `ש''ח` (שני אפוסטרופים) — צורה שחיה בקטלוג שש פעמים ולא נקראה
 *     על ידי השערים שקוראים את קיצור השקל.
 *
 * כל שלושתן דוממות בקטלוג של היום, ולכן הבדיקות מקבעות **גם** את
 * המספרים שעל המסך: בריכה שזזה בלי שהכותרת תזוז היא מה שהסבב שינה.
 */

const PACKAGES = basePackages();
const live = listable(PACKAGES);
const pool = (track) => live.filter((p) => isComparable(p, track));
const triple = PACKAGES.find((p) => p.id === "157");

const fake = (fields) => ({
  name: "x",
  description: null,
  benefits: null,
  priceAfterPromoNote: null,
  ...fields,
});

test("קטיעה ב-`benefits` פוסלת בדיוק כמו קטיעה ב-`description`", () => {
  const tail = [
    'החבילה כוללת תשתית + ספק + TV בעלות של 99 ש"ח',
    "נתב כלול במחיר",
    "ממיר 1 כלול",
    "מגדיל טווח …",
  ].join("\n\n");
  const cut = { ...triple, id: "x-cut", price: 99, priceAfterPromo: null, description: null, benefits: tail };
  const cutDesc = { ...cut, id: "x-cut-desc", description: tail, benefits: null };

  assert.equal(isComparable(cutDesc, "home"), false);
  assert.equal(isComparable(cut, "home"), false, "קטיעה ב-benefits עברה את כל השערים");
  // בלי הפסילה היא הפכה מיד לבחירה של מסלול הבית וניפחה את הכותרת.
  const after = computeSaving([...PACKAGES, cut], "home", 1, 350);
  assert.equal(after.pick?.id, "157");
  assert.equal(after.yearly, 2412);
});

test("קטיעה ב-`priceAfterPromoNote` נקראת כראיה שאבדה", () => {
  const p = { ...triple, id: "x-note", priceAfterPromo: 199, priceAfterPromoNote: "לאחר שנה 199 ₪ ועוד …" };
  assert.equal(isComparable(p, "home"), false);
});

test("טקסט שנקטע אך חי במלואו בשדה אחר אינו פוסל — id 157 נשאר בבריכה", () => {
  assert.ok(/…\s*$/.test(triple.benefits), "id 157 שינה צורה — עדכן את הבדיקה");
  assert.equal(isComparable(triple, "home"), true);
  assert.deepEqual(
    pool("home").map((p) => p.id),
    ["157", "3"],
  );
  const s = computeSaving(PACKAGES, "home", 1, 350);
  assert.equal(s.pick?.id, "157");
  assert.equal(s.perLine, 149);
  assert.equal(s.yearly, 2412);
});

test("`benefits` קטוע שאינו רישא של `description` כן פוסל", () => {
  const p = {
    ...triple,
    id: "x-other",
    description: 'טריפל כולל נתב 149 ש"ח',
    benefits: "הטבה נוספת שאינה בתיאור …",
  };
  assert.equal(isComparable(p, "home"), false);
});

test("`מחודש ה13` הוא הצהרת עלייה, כמו `מהחודש ה-13`", () => {
  for (const text of ["החל מחודש ה13: 79 ש''ח לכל מנוי", "מחודש ה-4 109 שח", 'מחודש 4 109 ש"ח']) {
    assert.ok(declaresRiseInText(fake({ description: text })), `לא זוהה: ${text}`);
  }
  assert.equal(declaresRiseInText(fake({ description: "התחייבות ל-12 חודשים" })), false);
});

test("`ש''ח` הוא אותו קיצור שקל כמו `ש\"ח` ו-`ש״ח`", () => {
  for (const text of ["חודשיים 149 ש''ח", 'חודשיים 149 ש"ח', "חודשיים 149 ש״ח", "חודשיים 149 שח"]) {
    assert.ok(declaresRiseInText(fake({ description: text })), `לא זוהה: ${text}`);
  }
  for (const text of ["עלות נתב 20 ש''ח", 'עלות נתב 20 ש"ח', "עלות הנתב 14.90 ש״ח"]) {
    assert.ok(routerPricedSeparately(fake({ description: text })), `לא זוהה: ${text}`);
  }
});

test("הבריכה והמספרים של הסלולר לא זזו", () => {
  assert.deepEqual(
    pool("cellular")
      .map((p) => p.id)
      .sort(),
    ["10", "116", "117", "121", "25", "30", "35", "65", "66", "69", "7", "90", "91", "93"],
  );
  assert.equal(computeSaving(PACKAGES, "cellular", 1, 350).pick?.id, "121");
  assert.equal(computeSaving(PACKAGES, "cellular", 1, 350).yearly, 3792);
  assert.equal(computeSaving(PACKAGES, "cellular", 2, 350).pick?.id, "117");
  assert.equal(computeSaving(PACKAGES, "cellular", 2, 350).yearly, 3480);
});
