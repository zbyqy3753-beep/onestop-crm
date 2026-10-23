import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  computeSaving,
  isComparable,
  priceForExistingCustomers,
  routerPricedSeparately,
  tierCapsAt,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 41 — שלושה שערים שהקובץ מכיר את ההצהרה בצורה אחת ומפספס את
 *   הצורה השכנה:
 *     • `ROUTER_PRICED_SEPARATELY` הכירה את המילה `נתב` לבדה ואת סדר
 *       המילים `עלות <ציוד> <מספר>` לבדו. id 124 החיה כותבת "ראווטר
 *       בעלות 20 שח לחודש" — ₪20 לחודש מעל ₪235 — ולא נתפסה.
 *     • `tierCapsAt` צירפה שלושה שדות בעצמה בזמן ש-`gateText` קורא
 *       ארבעה. אותו תיקון שכבר נעשה ל-`discountIsCapped`.
 *     • `SHEKEL` לא הכיר את המילה המלאה `שקל`/`שקלים`, שחיה בקטלוג
 *       בשלוש רשומות (ids 7, 10, 11).
 *
 * שלושתם רדומים בקטלוג של היום (id 124 נפסלת ממילא ב-
 * `declaresRiseInText`, 11 נושאות `priceAfterPromoNote` נפסלות ב-
 * `hasKnownAfterPrice`, ואין רשומה שכותבת `שקלים` דווקא בחלופה שדורשת
 * מטבע), ולכן הבדיקות מקבעות **גם** את הבריכה ואת המספרים שעל המסך:
 * שניהם אינם זזים.
 */

const PACKAGES = basePackages();
const live = listable(PACKAGES);
const byId = (id) => live.find((p) => String(p.id) === String(id));
const clone = (id, over) => ({ ...byId(id), ...over });

test("סבב 41: הנתב נתפס בכל איות של הציוד ובשני סדרי המילים", () => {
  // הצורה שחיה ב-id 124, מילה במילה מהקטלוג.
  assert.equal(routerPricedSeparately(byId("124")), true);

  for (const prose of [
    "ראווטר בעלות 20 שח לחודש",
    "ראוטר בעלות 20 שח לחודש",
    "נתב בעלות 20 שח לחודש",
  ]) {
    assert.equal(
      routerPricedSeparately(clone("157", { description: prose })),
      true,
      `הצורה לא נתפסה: ${prose}`,
    );
  }

  // והצורות שנתפסו כבר קודם ממשיכות להיתפס.
  for (const prose of ["עלות נתב 20 שח לחודש", 'נתב בתוספת 20 ש"ח לחודש']) {
    assert.equal(routerPricedSeparately(clone("157", { description: prose })), true);
  }

  // ⚠️ ולא כל אזכור של ציוד: "נתב כלול במחיר" אינו חיוב חודשי.
  assert.equal(
    routerPricedSeparately(clone("157", { description: "ראווטר כלול במחיר החבילה" })),
    false,
  );
});

test("סבב 41: `tierCapsAt` קוראת את `priceAfterPromoNote` כמו שאר שערי הנוסח", () => {
  const sentence = "עד 2 מנויים כולל - 59.9 ₪ למנוי.";
  const inDescription = clone("37", {
    description: sentence,
    benefits: null,
    priceAfterPromoNote: null,
  });
  const inPromoNote = clone("37", {
    description: "",
    benefits: null,
    priceAfterPromoNote: sentence,
  });

  assert.equal(tierCapsAt(inDescription, 2), true);
  // זה היה `false`: השדה הרביעי לא נקרא, והתקרה הייתה מוחלת מעליה.
  assert.equal(tierCapsAt(inPromoNote, 2), true);

  // ו-"ומעלה" עדיין גובר על "עד", בשדה הרביעי כמו בשלושה הראשונים.
  assert.equal(
    tierCapsAt(clone("37", { description: "", benefits: null, priceAfterPromoNote: "2 מנויים ומעלה" }), 2),
    false,
  );
});

test("סבב 41: `SHEKEL` מכיר את המילה המלאה, ולא בולע `משקל`/`שקלול`", () => {
  const base = "דמי שימוש חודשיים: 109.90 ";
  for (const currency of ["₪", 'ש"ח', "שח", "שקלים", "שקל"]) {
    assert.equal(
      priceForExistingCustomers(clone("69", { description: `${base}${currency} ללקוחות קיימים` })),
      true,
      `צורת המטבע לא נתפסה: ${currency}`,
    );
  }

  // ⚠️ הלוויינים השליליים: רצף האותיות בתוך מילה אחרת אינו סימן מטבע.
  for (const word of ["שקלול", "משקל"]) {
    assert.equal(
      priceForExistingCustomers(clone("69", { description: `${base}${word} ללקוחות קיימים` })),
      false,
      `${word} נקראה כסימן מטבע`,
    );
  }
});

test("סבב 41: הבריכה והבחירות לא זזו", () => {
  const pool = (track) => live.filter((p) => isComparable(p, track)).map((p) => String(p.id)).sort();

  assert.deepEqual(pool("cellular"), ["116", "117", "121", "25", "30", "35", "65", "66", "90", "91", "93"].sort());
  assert.deepEqual(pool("home"), ["157", "3"].sort());

  // ⚠️ המספרים שעל המסך, לא רק הבריכה.
  const cell1 = computeSaving(PACKAGES, "cellular", 1, 300);
  assert.equal(String(cell1.pick.id), "121");
  assert.equal(cell1.perLine, 34);
  assert.equal(cell1.monthly, 266);
  assert.equal(cell1.yearly, 3192);

  const cell3 = computeSaving(PACKAGES, "cellular", 3, 300);
  assert.equal(String(cell3.pick.id), "117");
  assert.equal(cell3.perLine, 29.9);
  assert.equal(cell3.monthly, 210);

  const home = computeSaving(PACKAGES, "home", 1, 300);
  assert.equal(String(home.pick.id), "157");
  assert.equal(home.perLine, 149);
  assert.equal(home.yearly, 1812);
});
