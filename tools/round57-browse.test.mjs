import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  PROMO_NOTE_LABEL,
  PROMO_NOTE_QUOTE_LABEL,
  heroRiseLine,
  promoNoteLabel,
  promoNoteRises,
  promoRise,
} from "../src/app/lp/catalog/format.ts";
import { afterPromoNote } from "../src/app/lp/ui/CompareTray.tsx";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

/*
 * סבב 57, `CompareTray.tsx`. החוזה שה-docstring של `afterPromoNote`
 * מצהיר עליו — "התווית נאמרת בתוך התא ולא נשענת על כותרת השורה" —
 * נאכף רק בענף הציטוט. ענף ה**עלייה** החזיר את הנוסח עירום, ושם
 * יושבת id 23: הנוסח שלה פותח במחיר של **היום** (₪25) לפני שהוא
 * אומר "לאחר מכן ... 59 ₪", ולכן התא שכותרתו "אחרי ההטבה" הגיש 25
 * כתשובה לשאלה ששובה 59.
 */

test("סבב 57: תא \"אחרי ההטבה\" אינו פותח במחיר של היום", () => {
  const p = byId(23);
  const rise = promoRise(p);
  assert.equal(rise?.kind, "note");
  assert.ok(promoNoteRises(p, rise.note), "id 23 היא רשומת העלייה שהממצא נשען עליה");

  // הנוסח הגולמי — מה שהתא הדפיס — אכן פותח במחיר של היום.
  assert.match(rise.note, /^25\s*ש/, "הנתון השתנה; התרחיש שהבדיקה מתעדת אינו קיים עוד");
  assert.equal(p.price, 25);

  const cell = afterPromoNote(p, rise.note);
  assert.ok(
    cell.startsWith(PROMO_NOTE_LABEL),
    `התא חזר להישען על כותרת השורה: ${cell.slice(0, 40)}`,
  );
  assert.ok(!/^\d/.test(cell), "התא פותח במספר, כלומר נקרא כמחיר שאחרי ההטבה");
});

test("סבב 57: התא, הכרטיס ופס ההירו אומרים את אותו דבר בשני הענפים", () => {
  const notes = P.filter((p) => {
    const r = promoRise(p);
    return r?.kind === "note";
  });
  assert.ok(notes.length >= 11, `רשומות ה-note ירדו ל-${notes.length}`);

  let rises = 0;
  let quotes = 0;
  for (const p of notes) {
    const note = promoRise(p).note;
    const cell = afterPromoNote(p, note);
    // ⚠️ `heroRiseLine` הוא המשטח השלישי; זהות מחרוזתית היא האינווריאנט.
    assert.equal(cell, heroRiseLine(p), `id ${p.id}: התא ופס ההירו נחלקו`);
    assert.ok(cell.startsWith(promoNoteLabel(p, note)), `id ${p.id}: התא בלי תווית`);
    if (promoNoteRises(p, note)) rises += 1;
    else quotes += 1;
  }
  assert.ok(rises >= 3, `ענף העלייה התרוקן (${rises})`);
  assert.ok(quotes >= 7, `ענף הציטוט התרוקן (${quotes})`);
});

test("סבב 57: ענף הציטוט לא זז", () => {
  // id 81 הוא המקרה שה-docstring מצטט: "39 ש״ח למשך 3 חודשים" על ₪99.
  const p = byId(81);
  const rise = promoRise(p);
  assert.equal(rise?.kind, "note");
  assert.ok(!promoNoteRises(p, rise.note));
  assert.ok(afterPromoNote(p, rise.note).startsWith(PROMO_NOTE_QUOTE_LABEL));
});
