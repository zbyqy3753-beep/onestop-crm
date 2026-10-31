import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { detailRows } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ סבב 48 — עלות שהכרטיס הסתיר, ושער נתב שהתאום שלו הורחב בסבב 47.
 *
 *   • `privateHomeInstallation` דרשה סימן מטבע בצורה שאחרי המילה,
 *     ו-id 3 כותבת "בית פרטי 499" בלי מטבע: השורה הצטמקה ל-"ללא
 *     עלות בבניין" והדף לא אמר מילה על ₪499 שייגבו ממי שגר בבית
 *     פרטי. id 3 יושבת בבריכת ההשוואה הביתית, ולכן זה מספר שמוצג.
 *   • `ROUTER_COST` ב-`format.ts` דרש את ה-ב' של `בתוספת`, בזמן
 *     ש-`ROUTER_PRICED_SEPARATELY` ב-`savings.ts` קיבל `ב?תוספת`
 *     בסבב 47 — כלומר המנוע פוסל את החבילה בדיוק כשהכרטיס שותק.
 */

const PKGS = listable(basePackages());
const byId = (id) => PKGS.find((p) => p.id === id);
const installation = (pkg) =>
  detailRows(pkg).find((r) => r.label === "עלות התקנה")?.value ?? null;

test("סבב 48: id 3 מדפיסה את ₪499 של הבית הפרטי, ולא רק את ההטבה בבניין", () => {
  // "התקנה ללא עלות בבניין בית פרטי 499" — בלי סימן מטבע.
  assert.equal(installation(byId("3")), "ללא עלות בבניין · ₪499 לבית פרטי");
});

test("סבב 48: חמש האחיות שכותבות את אותה הצהרה עם מטבע לא זזו", () => {
  for (const id of ["82", "113", "115"]) {
    assert.equal(installation(byId(id)), "ללא עלות בבניין · ₪499 לבית פרטי", id);
  }
  for (const id of ["112", "114"]) {
    assert.equal(installation(byId(id)), "₪200 בבניין · ₪499 לבית פרטי", id);
  }
});

test("סבב 48: `מהירות הורדה: 0.01` אינה נקראת כעלות התקנה", () => {
  /*
   * ⚠️ זה השער שמחזיק את ההרחבה. שש רשומות כותבות "בית פרטי" ואחריו
   * מעבר שורה ו-"מהירות הורדה: 0.01"; `\s*` במקום `[ \t]{0,3}` היה
   * קורא 0.01 כמחיר ההתקנה לבית פרטי — מספר מומצא על הכרטיס.
   */
  for (const id of ["70", "71", "73", "153", "154", "159"]) {
    const value = installation(byId(id));
    assert.ok(value == null || !value.includes("0.01"), `${id}: ${value}`);
  }
});

test("סבב 48: אף שורת התקנה אינה מצטטת מספר שאינו בפרוזה של הרשומה", () => {
  // סחיפה: כל מספר שמודפס בשורת ההתקנה חייב להופיע בטקסט של הרשומה.
  for (const p of PKGS) {
    const value = installation(p);
    if (!value) continue;
    const prose = [p.name, p.description, p.benefits].filter(Boolean).join(" ");
    for (const n of value.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
      assert.ok(prose.includes(n.replace(/,/g, "")) || prose.includes(n), `${p.id}: ${n} ב-"${value}"`);
    }
  }
});

test("סבב 48: `נתב תוספת 25 ₪ לחודש` נקרא כמו `נתב בתוספת`", () => {
  const base = structuredClone(byId("85"));
  const rowFor = (text) => {
    const p = structuredClone(base);
    p.description = text;
    return detailRows(p).find((r) => /נתב/.test(r.label))?.value ?? null;
  };
  const withBet = rowFor("נתב פייבר בהשכרה בתוספת 25 ₪ לחודש");
  const without = rowFor("נתב פייבר בהשכרה תוספת 25 ₪ לחודש");
  assert.ok(withBet?.includes("25"), `בתוספת: ${withBet}`);
  assert.equal(without, withBet);
});
