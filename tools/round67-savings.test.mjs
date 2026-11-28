import assert from "node:assert/strict";
import { test } from "node:test";

const { basePackages } = await import("../src/app/lp/catalog/catalog.ts");
const { computeSaving, declaresRiseInText, isComparable, MAX_LINES } = await import(
  "../src/app/lp/catalog/savings.ts"
);

const ALL = basePackages();
const byId = (id) => ALL.find((p) => String(p.id) === String(id));

/*
 * סבב 67, `savings.ts`. `RISE_IN_TEXT` דרש את מילת היחס `ל` אחרי
 * `מובטח/תקף/קבוע`, והקטלוג כותב את הצהרת התוקף של id 16 בלעדיה
 * וגם בכתיב `תוקף`: `תוקף מבצע12 חודשים`. ראה `declaresRiseInText`.
 */
test("הצהרת תוקף בלי מילת היחס ל נקראת כעלייה", () => {
  const host = { ...byId("121"), priceAfterPromo: null, benefits: [], name: "x" };
  const without = { ...host, description: "תוקף מבצע12 חודשים" };
  const withLamed = { ...host, description: "המחיר תקף ל-12 חודשים" };
  assert.equal(declaresRiseInText(withLamed), true, "התאום עם ל, כבקרה");
  assert.equal(declaresRiseInText(without), true, "אותה הצהרה בנוסח השכן");
  assert.equal(
    declaresRiseInText({ ...host, description: "תקף מבצע 12 חודשים" }),
    true,
    "גם בכתיב התקני, בלי ל",
  );
});

/*
 * זה הכשל שהשער מונע: אותה הצהרה פסלה את החבילה בנוסח אחד וייצרה
 * כותרת שנתית על מחיר של 12 חודשים בנוסח השכן.
 */
test("חבילה שמצהירה תוקף של 12 חודשים אינה נכנסת לבריכה", () => {
  const clone = {
    ...byId("121"),
    id: "test-67",
    price: 25,
    priceAfterPromo: null,
    benefits: [],
    name: "x",
    description: "תוקף מבצע 12 חודשים",
  };
  assert.equal(isComparable(clone, "cellular"), false);
  const saving = computeSaving([...ALL, clone], "cellular", 1, 200);
  assert.notEqual(String(saving.pick?.id), "test-67");
});

/* `שנה` לבדה לא נוספה — פרוזה שאינה הצהרת תוקף נשארת בחוץ. */
test("השער לא התרחב מעבר להצהרת משך", () => {
  const host = { ...byId("121"), priceAfterPromo: null, benefits: [], name: "x" };
  assert.equal(
    declaresRiseInText({ ...host, description: "המחיר קבוע – לכל החיים" }),
    false,
  );
});

/*
 * ⚠️ והבריכה אינה זזה ולו ברשומה אחת. id 16 נפסלת ממילא
 * ב-`requiresMultipleLines`, ויש לה `priceAfterPromo: 139` ולכן
 * השער אינו נקרא עליה כלל.
 */
test("בריכת ההשוואה והבחירות אינן זזות", () => {
  assert.deepEqual(
    ALL.filter((p) => isComparable(p, "cellular")).map((p) => String(p.id)),
    ["91", "65", "66", "90", "93", "116", "117", "121", "25", "30", "35"],
  );
  assert.deepEqual(
    ALL.filter((p) => isComparable(p, "home")).map((p) => String(p.id)),
    ["157", "3"],
  );
  for (let lines = 1; lines <= MAX_LINES; lines++) {
    const cellular = computeSaving(ALL, "cellular", lines, 200);
    assert.equal(String(cellular.pick.id), lines === 1 ? "121" : "117");
    assert.equal(cellular.perLine, lines === 1 ? 34 : 29.9);
    const home = computeSaving(ALL, "home", lines, 200);
    assert.equal(String(home.pick.id), "157");
    assert.equal(home.perLine, 149);
  }
});
