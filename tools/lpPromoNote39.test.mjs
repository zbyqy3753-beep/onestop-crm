import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  heroRiseLine,
  PROMO_NOTE_LABEL,
  PROMO_NOTE_QUOTE_LABEL,
  promoNoteLabel,
  promoNoteRises,
  promoNoteText,
  promoRise,
} from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ הפגם: התווית "בתום ההטבה:" מייחסת לרשומה אמירה שהיא לא מסרה.
 *
 * 11 רשומות מוסרות את מה שקורה אחרי ההטבה **בפרוזה בלבד**
 * (`priceAfterPromoNote`), ושני משטחים הדפיסו את הפרוזה הזו מתחת
 * למחיר הגדול אחרי התווית הזו, מילה במילה: `heroRiseLine`
 * ב-`format.ts` ו-`PackageCard`. אבל הנוסח אינו מסודר, ובשמונה מתוך
 * ה-11 המספר שבו **אינו** גבוה מהמחיר המוצג:
 *
 *   • ids 23, 58, 81, 132 פותחות במחיר **המבצע** עצמו ("*מחיר החבילה
 *     39 ש"ח למשך 3 חודשים* לאחר מכן 99" כש-`price` 99), ולכן מתחת
 *     למחיר 99 ₪ הופיע "בתום ההטבה: ... 39" — כלומר הצהרה שהמחיר
 *     **יורד** בתום המבצע.
 *   • ids 85, 92, 108, 109 מצטטות מחיר נמוך מ-`price` או שווה לו
 *     ("לאחר שנה 159 ₪ לחודש + 34.9 ₪ נתב" כש-`price` 173.9).
 *
 * ⚠️ הכלל: מייחסים רק כשכל מספר שבנוסח גבוה מהמחיר המוצג — אותו
 * שער בדיוק ובאותו משקל כמו `afterRises` ב-`src/lib/posts/catalog.ts`
 * (שם הוא כבר נבדק ב-`round34-format.test.mjs`), כדי ששני המשטחים
 * לא יאמרו על אותה רשומה שני דברים. אחרת הנוסח **נאמר במלואו** —
 * שום מידע לא נמחק מהמסך — אבל כציטוט של תנאי המבצע ולא כהצהרה שלנו
 * על המחיר שאחריו.
 */

/* `LeadForm → ../actions` הוא מודול `"use server"` שאינו נטען ב-tsx. */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};
const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");
const { afterPromoNote } = await import("../src/app/lp/ui/CompareTray.tsx");

const live = listable(basePackages());
const notePkgs = live.filter((p) => promoRise(p)?.kind === "note");
const byId = (id) => {
  const p = notePkgs.find((x) => x.id === id);
  assert.ok(p, `id ${id} אינו נושא נוסח מילולי — עדכן את הבדיקה, לא את הקוד`);
  return p;
};

/** המספרים שהנוסח מוסר, בסינון של `afterRises`: רק מה שיכול להיות מחיר. */
const notePrices = (note) => (note.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n >= 10);

/** בריחת תווים בטקסט, כפי ש-React כותב אותה. */
const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

const cardHtml = (pkg) => renderToStaticMarkup(React.createElement(PackageCard, { pkg }));

test("נוסח: 11 הרשומות עם הצהרה מילולית, וחלוקתן לפי כיוון המספר", () => {
  assert.deepEqual(
    notePkgs.map((p) => p.id).sort(),
    ["108", "109", "132", "23", "42", "58", "61", "81", "83", "85", "92"],
    "רשימת הרשומות עם נוסח מילולי השתנתה — ודא שהבדיקה עדיין מכסה אותן",
  );

  // רק שלוש מוסרות נוסח שכל מספר בו גבוה מהמחיר המוצג.
  assert.deepEqual(
    notePkgs.filter((p) => promoNoteRises(p, promoRise(p).note)).map((p) => p.id).sort(),
    ["42", "61", "83"],
  );

  // והשער נגזר מהמספרים ולא מרשימה קשיחה.
  for (const p of notePkgs) {
    const note = promoRise(p).note;
    const nums = notePrices(note);
    assert.equal(
      promoNoteRises(p, note),
      nums.length > 0 && nums.every((n) => n > p.price),
      `id ${p.id}: ${note}`,
    );
  }
});

test("ייחוס: 'בתום ההטבה' אינו מוצמד למספר שאינו גבוה מהמחיר המוצג", () => {
  /*
   * ⚠️ הלב. על כל 11 הרשומות: אם השורה מייחסת ישירות (הנוסח בא מיד
   * אחרי התווית), כל מספר בנוסח **חייב** להיות גבוה מהמחיר המוצג.
   * זו הצורה שבה הפגם נראה על המסך — "בתום ההטבה: 39" מתחת ל-₪99.
   */
  for (const p of notePkgs) {
    const note = promoRise(p).note;
    const line = heroRiseLine(p);
const label = promoNoteLabel(p, note);
    assert.ok(line.startsWith(label), `id ${p.id}: ${line}`);
    const said = line.slice(label.length).trim();
    if (label === PROMO_NOTE_LABEL) {
      assert.equal(said, note, `id ${p.id}: ייחוס ישיר חייב לומר את הנוסח כפי שהוא`);
      for (const n of notePrices(note)) {
        assert.ok(
          n > p.price,
          `id ${p.id}: "בתום ההטבה: ${note}" מתחת למחיר ${p.price} — ${n} אינו גבוה ממנו`,
        );
      }
    } else {
      assert.equal(label, PROMO_NOTE_QUOTE_LABEL, `id ${p.id}: תווית שאינה אחת משתיים`);
      assert.ok(said.includes(note), `id ${p.id}: הציטוט אינו נושא את הנוסח — ${said}`);
    }
    /*
     * ⚠️ המשטח השלישי: תא "אחרי ההטבה" במגש ההשוואה. כותרת השורה
     * שלו היא עצמה הייחוס, ולכן התא נבדק באותו שער — הוא היה המקום
     * שהדפיס את הנוסח גולמי אחרי ששני האחרים כבר גודרו.
     */
    const cell = afterPromoNote(p, note);
    assert.ok(cell.includes(note), `id ${p.id}: תא המגש חתך את הנוסח`);
    if (label === PROMO_NOTE_QUOTE_LABEL) {
      assert.ok(
        cell.startsWith(PROMO_NOTE_QUOTE_LABEL),
        `id ${p.id}: תא המגש מיוחס לכותרת "אחרי ההטבה" בלי תווית — ${cell}`,
      );
    } else {
      assert.equal(cell, note, `id ${p.id}: תא המגש הוסיף מילים לנוסח שעולה`);
    }
  }
});

test("נוסח: שום מידע אינו נמחק מהמסך, בשני המשטחים גם יחד", () => {
  for (const p of notePkgs) {
    const note = promoRise(p).note;
    const text = promoNoteText(p, note);
    assert.ok(text.includes(note), `id ${p.id}: הנוסח נחתך`);
    // פס ההירו והכרטיס אומרים את אותו הדבר, מאותו מקור.
    assert.equal(heroRiseLine(p), `${promoNoteLabel(p, note)} ${text}`);
    const html = cardHtml(p);
    assert.ok(html.includes(esc(promoNoteLabel(p, note))), `id ${p.id}: הכרטיס בלי תווית`);
    assert.ok(html.includes(esc(text)), `id ${p.id}: הכרטיס אינו אומר את נוסח הרשומה`);
  }
});

test("לפני/אחרי: ארבע הרשומות שהצהירו על ירידת מחיר, ושלוש שלא נפגעו", () => {
  // id 81: price 99, הנוסח פותח ב-39 — ההצהרה הישירה ירדה.
  const p81 = byId("81");
  assert.equal(p81.price, 99);
  assert.equal(heroRiseLine(p81).startsWith(`${PROMO_NOTE_LABEL} *מחיר החבילה 39`), false);
  assert.ok(heroRiseLine(p81).includes("לאחר מכן 99"));

  for (const id of ["23", "58", "81", "85", "92", "108", "109", "132"]) {
    const p = byId(id);
    assert.ok(
      heroRiseLine(p).startsWith(PROMO_NOTE_QUOTE_LABEL),
      `id ${id}: עדיין מיוחס`,
    );
    assert.equal(heroRiseLine(p).startsWith(PROMO_NOTE_LABEL), false, `id ${id}: תווית הייחוס`);
    assert.ok(cardHtml(p).includes(esc(PROMO_NOTE_QUOTE_LABEL)), `id ${id}: הכרטיס עדיין מיוחס`);
  }

  // ומה שכן עולה ממשיך להיאמר בדיוק כפי שנאמר עד היום.
  for (const id of ["42", "61", "83"]) {
    const p = byId(id);
    assert.equal(heroRiseLine(p), `${PROMO_NOTE_LABEL} ${promoRise(p).note}`);
    assert.equal(cardHtml(p).includes(esc(PROMO_NOTE_QUOTE_LABEL)), false, `id ${id}`);
  }
});

test("שער: מחיר פגום אינו פותח את הייחוס", () => {
  /*
   * ⚠️ `price: 0` הוא הצורה שהמחלץ מייצר כשלא קרא מחיר (ids 18, 22),
   * וכל מספר בנוסח גבוה ממנו — כלומר ייחוס שנשען על `price` בלבד היה
   * נפתח דווקא על הרשומה שאין לנו מחיר להשוות אליו. אותו שער של
   * `afterRises`.
   */
  const base = byId("42");
  for (const price of [0, -0, -5, "39.9", NaN, null, undefined]) {
    const pkg = { ...base, price };
    assert.equal(promoNoteRises(pkg, "אחרי שנתיים 69.9"), false, `price=${String(price)}`);
    assert.ok(heroRiseLine(pkg).startsWith(PROMO_NOTE_QUOTE_LABEL));
  }

  // ונוסח בלי מספר כלל אינו "עולה".
  assert.equal(promoNoteRises(base, "המחיר מתעדכן בתום התקופה"), false);
});
