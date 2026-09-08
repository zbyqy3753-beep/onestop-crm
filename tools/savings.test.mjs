import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_SPEND,
  computeSaving,
  declaresRiseInText,
  isComparable,
  parseSpend,
  perLinePrice,
} from "../src/app/lp/catalog/savings.ts";
import { basePackages } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ הבדיקות רצות מול **הקטלוג האמיתי** (`packages.json`) ולא מול נתוני
 * בדיקה. הכותרת של המחשבון היא הבטחה מספרית לגולש, והסכנה אינה שהקוד
 * ישתנה אלא שהקטלוג יתרענן ויכניס חבילה שמפילה את ההבטחה בשקט. לכן
 * המשמעות של כישלון כאן היא "החידוש האחרון של הקטלוג הכניס חבילה
 * שאסור להשוות מולה" — לא בהכרח "מישהו שבר את הקוד".
 */

const PACKAGES = basePackages();
const pool = (track) => PACKAGES.filter((p) => isComparable(p, track));

test("קלט: תווי זבל פוסלים את הסכום ולא מסוננים ממנו", () => {
  assert.equal(parseSpend("abc220"), 0);
  assert.equal(parseSpend("-500"), 0);
  assert.equal(parseSpend(""), 0);
  assert.equal(parseSpend("0"), 0);
});

test("קלט: שתי נקודות עשרוניות אינן מספר — `1.2.3` לא הופך ל-1.23", () => {
  assert.equal(parseSpend("1.2.3"), 0);
  assert.equal(parseSpend("220.5"), 220.5);
});

test("קלט: מפרידי אלפים, ספרות ערביות וקיטום לתקרה", () => {
  assert.equal(parseSpend("1,200"), 1200);
  assert.equal(parseSpend("٢٢٠"), 220);
  assert.equal(parseSpend("9000"), MAX_SPEND);
});

test("בריכת ההשוואה אינה ריקה בשני המסלולים", () => {
  assert.ok(pool("cellular").length > 5, `סלולר: ${pool("cellular").length}`);
  assert.ok(pool("home").length > 3, `בית: ${pool("home").length}`);
});

test("כל חבילה בת-השוואה יודעת מה תעלה אחרי ההטבה", () => {
  for (const track of ["cellular", "home"]) {
    for (const p of pool(track)) {
      if (p.priceAfterPromo != null) continue;
      assert.equal(
        p.priceAfterPromoNote,
        null,
        `${p.name}: עלייה בהערה חופשית בלי מספר`,
      );
      assert.equal(
        declaresRiseInText(p),
        false,
        `${p.name}: התיאור מצהיר על עלייה שאין לה מספר`,
      );
    }
  }
});

test("סלולר: לא כשר, לא DATA ONLY — קו שאפשר באמת לעבור אליו", () => {
  for (const p of pool("cellular")) {
    assert.equal(p.spec.kosher, false, `${p.name}: חבילה כשרה`);
    assert.ok((p.spec.minutes ?? 0) >= 1000, `${p.name}: ${p.spec.minutes} דקות`);
    assert.ok(p.price > 0, `${p.name}: מחיר ${p.price}`);
  }
});

test("בית: אינטרנט **וגם** טלוויזיה, ולא שירות סטרימינג", () => {
  for (const p of pool("home")) {
    assert.ok(p.spec.hasInternet, `${p.name}: בלי אינטרנט`);
    assert.ok(p.spec.hasTv, `${p.name}: בלי טלוויזיה`);
    assert.notEqual(p.type, "TV", `${p.name}: חבילת טלוויזיה בלבד`);
  }
});

test("חבילות שקוברות את העלייה בתיאור נשארות בחוץ", () => {
  const excluded = (name) => {
    const p = PACKAGES.find((x) => x.name.includes(name));
    assert.ok(p, `לא נמצאה בקטלוג: ${name}`);
    assert.equal(isComparable(p, p.category), false, `${p.name} נכנסה לבריכה`);
  };
  // 39.9 ₪, שני שדות המחיר ריקים, ובתיאור "מהחודש ה-13 והלאה- 59.9 ₪".
  excluded("Partner Golden 5G");
  // שירות סטרימינג שסומן בטעות `hasInternet` — הזול ביותר בקטגוריה.
  excluded("החבילה המושלמת 79 שח");
});

test("מדרגת קווים שמייקרת נלקחת כפי שהיא, בלי Math.min", () => {
  const golan = PACKAGES.find((p) => p.name.includes("קיץ חם בדור 5"));
  assert.ok(golan, "החבילה נעלמה מהקטלוג");
  // המדרגה: 2 קווים ב-44.90 ₪ לקו, 3 קווים ב-39.90. המחיר המוצג הוא 39.90.
  assert.equal(perLinePrice(golan, 2), 44.9);
  assert.equal(perLinePrice(golan, 3), 39.9);
  // פחות מהמדרגה הנמוכה ביותר — המחיר המוצג.
  assert.equal(perLinePrice(golan, 1), 39.9);
});

test("חבילה עם מחיר-אחרי-הטבה מדווח מתומחרת לפיו בכל כמות קווים", () => {
  const cellcom = PACKAGES.find((p) => p.name.includes("סלקום משפחתי פלוס"));
  assert.ok(cellcom, "החבילה נעלמה מהקטלוג");
  assert.equal(cellcom.priceAfterPromo, 59.9);
  // המדרגות מתומחרות מול 39.9 שהוא מחיר ההטבה; 59.9 הוא המספר השמרני.
  for (const lines of [1, 2, 3, 10]) assert.equal(perLinePrice(cellcom, lines), 59.9);
});

test("השנתי הוא בדיוק החודשי כפול 12, בכל מספר קווים", () => {
  for (const units of [1, 2, 3, 5, 10]) {
    const s = computeSaving(PACKAGES, "cellular", units, 220);
    assert.equal(s.yearly, s.monthly * 12);
    assert.equal(Number.isInteger(s.monthly), true);
  }
});

test("סלולר מתומחר לקו, בית הוא חשבון אחד", () => {
  const one = computeSaving(PACKAGES, "cellular", 1, 220);
  const three = computeSaving(PACKAGES, "cellular", 3, 220);
  assert.ok(three.monthly < one.monthly, "שלושה קווים אמורים לעלות יותר מקו אחד");

  const home1 = computeSaving(PACKAGES, "home", 1, 220);
  const home5 = computeSaving(PACKAGES, "home", 5, 220);
  assert.equal(home5.monthly, home1.monthly);
});

test("חשבון נמוך אינו מייצר חיסכון", () => {
  const s = computeSaving(PACKAGES, "cellular", 1, 20);
  assert.equal(s.worthwhile, false);
  assert.ok(s.pick, "עדיין נבחרה חבילה — הכישלון הוא בחיסכון ולא בהשוואה");
});

test("החיסכון שמוצג בפועל נשען על מחיר שנמצא בקטלוג", () => {
  for (const track of ["cellular", "home"]) {
    const s = computeSaving(PACKAGES, track, 3, 220);
    assert.ok(s.pick, `${track}: לא נבחרה חבילה`);
    const perLine = perLinePrice(s.pick, 3);
    const expected = track === "cellular" ? perLine * 3 : perLine;
    assert.equal(s.monthly, Math.round(220 - expected));
    // המחיר חייב להיות אחד משני השדות של החבילה, לא מספר מסונתז.
    assert.ok(
      perLine === s.pick.priceAfterPromo ||
        perLine === s.pick.price ||
        (s.pick.spec.lineTiers ?? []).some((t) => t.price === perLine),
      `${s.pick.name}: ${perLine} אינו מחיר שמופיע בחבילה`,
    );
  }
});
