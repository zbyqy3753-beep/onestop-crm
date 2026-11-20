import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { promoRise } from "../src/app/lp/catalog/format.ts";

const P = basePackages();

/*
 * סבב 61, `format.ts`. ההערה על ענף ה-`period` מונה את הרשומות
 * ומפרטת ids — וזו הנמקה שקוראים מסתמכים עליה (`CompareTray.tsx`
 * ו-`PackageCard.tsx` מצטטים את אותו מספר). היא פספסה רשומה אחת.
 * אין כאן מספר שזז על המסך: הנוסח על id 112 היה ונשאר נכון ושמרני.
 */

test("סבב 61: ענף ה-`period` מונה 20 רשומות, ו-id 112 ביניהן", () => {
  const period = P.filter((p) => promoRise(p)?.kind === "period")
    .map((p) => Number(p.id))
    .sort((a, b) => a - b);
  assert.deepEqual(period, [
    17, 24, 27, 31, 34, 45, 50, 54, 57, 64, 67, 71, 72, 73, 98, 112, 124, 125, 153, 159,
  ]);

  const p112 = P.find((p) => String(p.id) === "112");
  assert.equal(p112.price, 169);
  assert.equal(p112.priceAfterPromo, null);
  assert.equal(p112.priceAfterPromoNote, null);
  // ⚠️ `price` 169 הוא כבר מחיר הקבע, וההצהרה היא על מבצע **זול**
  // בהתחלה ("חודשיים 149 שח") — כלומר 112 שייכת גם לתת-הקבוצה שבה
  // "המחיר עולה בהמשך" היה מספר שגוי בכיוון ההפוך.
  assert.match(p112.description ?? "", /חודשיים 149 שח/);
});

test("וההערות בשלושת הקבצים נוקבות באותו מספר", () => {
  const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
  const fmt = read("../src/app/lp/catalog/format.ts");
  assert.match(fmt, /⚠️ 20 חבילות \(ids 17, 24, 27, 31, 34, 45, 50, 54, 57, 64, 67, 71,/);
  assert.match(fmt, /72, 73, 98, 112, 124, 125, 153, 159\) נתפסות ב-`declaresRiseInText`/);
  assert.match(fmt, /ב-11 מתוך 20/);
  assert.match(read("../src/app/lp/ui/CompareTray.tsx"), /באחת-עשרה מ-20 הרשומות/);
  assert.match(read("../src/app/lp/ui/PackageCard.tsx"), /הכרטיס שתק לגמרי על 20 חבילות/);
});
