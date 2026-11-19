import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { detailRows, vodInProse } from "../src/app/lp/catalog/format.ts";

/*
 * סבב 60, `format.ts`.
 *
 * `VOD_INCLUDED` דרש שה-VOD יהיה **צמוד** ל"כולל", ולכן פספס את
 * id 89 — שכותבת את ההכללה כרשימה ("חבילת טלוייזיה **הכוללת
 * ערוצים + vod** עם כל הסדרות של יס") ושבה ה-VOD הוא הפריט השני.
 * התוצאה: `vodInProse` החזיר `null`, שורת "VOD" נעלמה מהכרטיס,
 * ובטבלת ההשוואה היא קיבלה `—` דווקא ליד id 71 ("כלול במחיר")
 * ו-id 72 ("אינו כלול במחיר") — כלומר הטבלה הכחישה את התכולה
 * שהשם והתיאור של אותה רשומה מבטיחים, על הזולה מהשלוש.
 *
 * התיקון מתיר פריט ביניים אחד ונוקב בו בשמו (`ערוצים`), בדיוק
 * כמו `EXTENDER_INCLUDED_BARE` שהתיר "כולל נתב+מגדיל טווח" בסבב
 * 58. הבדיקה האחרונה נועלת שהכיוון השלילי לא נפרץ.
 */

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};
const vodRow = (id) => detailRows(byId(id)).find((r) => r.label === "VOD") ?? null;

test("סבב 60: הכללת VOD נקראת גם כשהיא הפריט השני ברשימה (id 89)", () => {
  const p = byId("89");
  // הראיה היא בפרוזה בלבד — השדה שותק.
  assert.equal(p.spec?.vodIncluded ?? null, null);
  assert.match(p.description, /הכוללת ערוצים \+ vod/i);

  assert.equal(vodInProse(p), true);
  assert.deepEqual(vodRow("89"), { label: "VOD", value: "כלול במחיר" });
});

test("סבב 60: שלוש הרשומות האחרות שמזכירות VOD אינן זזות", () => {
  // id 71 מצהירה בשם עצמה ("1000/100 כולל VOD") ונושאת גם את השדה.
  assert.equal(vodInProse(byId("71")), true);
  assert.deepEqual(vodRow("71"), { label: "VOD", value: "כלול במחיר" });

  // id 72 היא ההכרעה השלילית של סבב 59 — `VOD_EXCLUDED` נבדק ראשון.
  assert.equal(vodInProse(byId("72")), false);
  assert.deepEqual(vodRow("72"), { label: "VOD", value: "אינו כלול במחיר" });

  // id 70 נושאת את השדה `true` ואינה מצהירה בפרוזה — הפרוזה נשארת שותקת.
  assert.equal(vodInProse(byId("70")), null);
  assert.equal(byId("70").spec?.vodIncluded, true);
});

test("סבב 60: id 89 היא הרשומה היחידה בקטלוג שהתיקון מזיז", () => {
  const moved = P.filter((p) => vodInProse(p) === true).map((p) => String(p.id));
  assert.deepEqual(moved.sort(), ["71", "89"]);
});

test("סבב 60: שלילה שנוסחה עם אותו פריט ביניים נשארת שלילה", () => {
  for (const text of [
    "חבילה שאינה כוללת ערוצים + VOD",
    "חבילה ללא VOD",
    "חבילת טלוויזיה לא כוללת ערוצים + VOD",
  ]) {
    assert.notEqual(
      vodInProse({ name: "חבילה", description: text }),
      true,
      `"${text}" נקרא כהכללה`,
    );
  }

  // והשער אינו מגשר על משפט שלם: `ערוצים` הוא פריט הביניים היחיד שהותר.
  assert.equal(
    vodInProse({ name: "חבילה", description: "כוללת אינטרנט וטלוויזיה. בחבילה אחרת יש VOD" }),
    null,
  );
});
