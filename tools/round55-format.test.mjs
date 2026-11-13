import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages, disclosedRiseCount, isMoney, listable } from "../src/app/lp/catalog/catalog.ts";
import { promoRise } from "../src/app/lp/catalog/format.ts";

const PAGE = readFileSync("src/app/lp/[service]/page.tsx", "utf8");
const P = basePackages();

/*
 * סבב 55. `disclosedRiseCount` מתועדת בעצמה כ"האם נאמר לגולש משהו"
 * ולכן היא סופרת גם רשומה שכל מה שיש לה הוא נוסח מילולי — ושם המשטח
 * שמדפיס **אינו** נוקב במחיר אלא מצטט ("נוסח המבצע:"). הכיתוב שמעל
 * המונה הבטיח מחיר מכל אחת מהן. המונה אינו זז; הכיתוב כן.
 */

test("סבב 55: הכיתוב מצהיר על מה שקורה בתום ההטבה ולא מבטיח מחיר", () => {
  assert.match(PAGE, /מצהירות על מה שקורה בתום ההטבה/);
  assert.doesNotMatch(
    PAGE.replace(/\{\/\*[\s\S]*?\*\/\}/g, ""),
    /מציגות מחיר אחרי ההטבה/,
  );
});

test("והראיה: המונה גדול ממספר הרשומות שמדפיסות מחיר, בשתי הקטגוריות", () => {
  for (const [category, amounts] of [
    ["cellular", 13],
    ["home", 10],
  ]) {
    const pkgs = P.filter((p) => p.category === category);
    const counted = listable(pkgs).filter(
      (p) =>
        isMoney(p.priceAfterPromo) ||
        (typeof p.priceAfterPromoNote === "string" && p.priceAfterPromoNote !== ""),
    );
    assert.equal(disclosedRiseCount(pkgs), 17);
    assert.equal(counted.length, 17);
    // כמה מהן באמת מדפיסות מספר, וכמה מקבלות ציטוט נוסח.
    const kinds = counted.map((p) => promoRise(p)?.kind);
    assert.equal(kinds.filter((k) => k === "amount").length, amounts);
    assert.equal(kinds.filter((k) => k === "note").length, 17 - amounts);
    assert.equal(kinds.filter((k) => k == null).length, 0);
  }
});
