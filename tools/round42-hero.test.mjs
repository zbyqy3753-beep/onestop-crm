import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, byCategory, cheapest, listable } from "../src/app/lp/catalog/catalog.ts";
import { isComparable } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 42: פס המחיר בהירו — ההצהרה הגדולה בדף, "סלולר — החל
 * מ־₪X לחודש" — בחר את הזולה דרך `cheapest(byCategory(…))` בלבד,
 * כלומר בלי אף אחד משלושת תנאי התחליפיות שהמנוע שמתה בדף
 * דורש מאותה רשומה (לא כשר, יש גלישה, לפחות 1000 דקות).
 *
 * המספר שמוצג היום אינו זז — הזולה בקטלוג (id 91, ₪21.9)
 * עוברת את השער בליווי — ולכן הבדיקה מקבעת שתי עובדות:
 * שהמספר שעל המסך לא זז, ושהשער באמת עוצר את הרשומות
 * שהיו מגיעות לפס ברענון הבא.
 */

const live = listable(basePackages());
const byId = (id) => live.find((p) => String(p.id) === String(id));

/** בדיוק הבחירה של `page.tsx` לפס ההירו, אחרי התיקון. */
const heroLead = (pkgs) =>
  cheapest(
    byCategory(pkgs, "cellular").filter((p) => isComparable(p, "cellular")),
    1,
  )[0] ?? null;

/** הבחירה כפי שהיתה לפני התיקון, לשם הנגדה. */
const heroLeadUngated = (pkgs) => cheapest(byCategory(pkgs, "cellular"), 1)[0] ?? null;

test("סבב 42: פס ההירו מצטט היום את אותו מחיר שלפני השער", () => {
  const lead = heroLead(live);
  assert.equal(String(lead.id), "91");
  assert.equal(lead.price, 21.9);
  // השער הוא חיזוק ולא שינוי מספר: אותה רשומה בדיוק.
  assert.equal(String(heroLeadUngated(live).id), String(lead.id));
});

test("סבב 42: הפס אינו מפרסם קו כשר כמחיר הפתיחה של \"סלולר\"", () => {
  // רענון שמסיר רשומה **אחת** — הזולה בקטלוג.
  const next = live.filter((p) => String(p.id) !== "91");
  const ungated = heroLeadUngated(next);
  // זה הבאג שתוקן: הבחירה הקודמת היתה נופלת על קו כשר.
  assert.equal(String(ungated.id), "23");
  assert.equal(ungated.spec.kosher, true);

  const lead = heroLead(next);
  assert.notEqual(String(lead.id), String(ungated.id));
  assert.equal(lead.spec.kosher, false);
  // והוא קו שאפשר להחליף בו קו רגיל: גלישה ודקות שיחה.
  assert.equal(String(lead.id), "90");
  assert.equal(lead.price, 29.9);
  assert.ok(lead.spec.minutes >= 1000);
  assert.ok(lead.spec.dataGb > 0);
});

test("סבב 42: הפס אינו מפרסם חבילת גלישה בלי דקות שיחה", () => {
  // id 15 (`DATA ONLY`, ₪29) הוא הבא בתור אחרי שלוש הכשרות.
  const dataOnly = byId("15");
  assert.ok(dataOnly, "id 15 חיה בקטלוג");
  // 100 דקות — מתחת ל-1000 שהמנוע דורש, כלומר לא תחליף לקו רגיל.
  assert.ok(dataOnly.spec.minutes < 1000);
  assert.equal(isComparable(dataOnly, "cellular"), false);

  // בלי השער הוא היה מגיע לפס ברגע שארבע הזולות ממנו יוצאות.
  const thinned = live.filter((p) => !["91", "23", "46", "24"].includes(String(p.id)));
  assert.equal(String(heroLeadUngated(thinned).id), "15");
  assert.notEqual(String(heroLead(thinned).id), "15");
  assert.ok(heroLead(thinned).spec.minutes >= 1000);
});

test("סבב 42: בריכת ההשוואה עצמה לא זזה", () => {
  const pool = live.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id)).sort();
  assert.deepEqual(pool, ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"]);
  const home = live.filter((p) => isComparable(p, "home")).map((p) => String(p.id)).sort();
  assert.deepEqual(home, ["157", "3"]);
});
