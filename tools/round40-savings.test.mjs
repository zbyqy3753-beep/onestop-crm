import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import {
  MAX_SPEND,
  MAX_TYPED_SPEND,
  computeSaving,
  declaresRiseInText,
  isComparable,
  monthlySurchargePerLine,
  priceForExistingCustomers,
  requiresMultipleLines,
  routerPricedSeparately,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 40 — שבעה שערים שהקובץ כבר מכיר את ההצהרה בצורה אחת
 *   ומפספס את הצורה השכנה:
 *     • `headlineIsLineTierPrice` השווה ל-`price` לבדו, בזמן שהמנוע
 *       מפרסם את `priceAfterPromo` (אי-עקביות פנימית, ניפוח 11.8%).
 *     • "תוספת" חסרה ממילון החיוב החודשי לקו — המילה שהשער התאום
 *       (`ROUTER_PRICED_SEPARATELY`) מתייחס אליה כסימן הקנוני.
 *     • הנתב בסדר מילים הפוך ("בתוספת … עבור הנתב"), בהשכרה, ובדמי
 *       שכירות.
 *     • "שנה ראשונה" — בזמן ש"שנה שנייה/שלישית/רביעית" כבר מוכרות.
 *     • `חודשים <מחיר>` בלי סימן מטבע, ובסדר ההפוך.
 *     • "בתום תקופת ההטבה" — צורת הסמיכות, הניסוח הנפוץ בעברית.
 *     • מחיר שמותנה בכך שהגולש הוא **לקוח קיים** — התנאי היחיד
 *       שגולש שבא לעבור ספק בהגדרה אינו מקיים (id 69, חי בבריכה).
 *
 * כל השבעה פרט לאחרון דוממים בקטלוג של היום, ולכן הבדיקות מקבעות
 * **גם** את הבריכה ואת המספרים שעל המסך: id 69 יוצא, הבחירה אינה זזה.
 */

const PACKAGES = basePackages();
const live = listable(PACKAGES);
const pool = (track) => live.filter((p) => isComparable(p, track));

const fake = (fields) => ({
  name: "x",
  description: null,
  benefits: null,
  priceAfterPromoNote: null,
  priceModel: "monthly",
  price: 24.9,
  priceAfterPromo: null,
  ...fields,
});
const withText = (text, fields) => fake({ description: text, ...fields });

test("מדרגת קווים נקראת גם כשהכותרת נבנית על `priceAfterPromo`", () => {
  const prose = "* קו בודד – 49.90 ₪ * 3 קווים – 29.90 ₪ לקו";
  // אותה רשומה בדיוק, פעם אחת עם המדרגה ב-`price` ופעם ב-`priceAfterPromo`.
  assert.equal(requiresMultipleLines(withText(prose, { price: 29.9 })), true);
  assert.equal(
    requiresMultipleLines(withText(prose, { price: 24.9, priceAfterPromo: 29.9 })),
    true,
    "המחיר שמתפרסם הוא `priceAfterPromo`, ולכן הוא זה שצריך להיבדק",
  );
  // ההכרעה של id 129 נשמרת: `1 קווים <price>` פירושו שהכותרת היא דווקא
  // מחיר הקו הבודד, והרשומה נשארת בבריכה.
  assert.equal(
    requiresMultipleLines(
      withText("קו ראשון 39, בצירוף 2 קווים ומעלה 35 לקו", { price: 39, priceAfterPromo: 39 }),
    ),
    false,
  );
});

test("`תוספת` היא חיוב חודשי לקו בדיוק כמו `תשלום חודשי`", () => {
  for (const text of [
    'תוספת של 8 ש"ח לחודש לכל קו',
    'בתוספת 8 ש"ח לחודש לקו',
    'עלות הו"ק 40 ₪ , תשלום חודשי 8 שקלים לרשומה',
  ]) {
    assert.equal(monthlySurchargePerLine(withText(text)), true, text);
  }
  // והסכום שהוא **המחיר עצמו** אינו תוספת — ההכרעה של ids 31/38/39/40.
  assert.equal(
    monthlySurchargePerLine(withText('תשלום חודשי בסך 24.9 ₪ כל קו סלולר', { price: 24.9 })),
    false,
  );
  // ⚠️ שלוש הרשומות שהשער נכתב בשבילן ממשיכות להיתפס: הוספת חלופה
  // לתבנית שקוראים ממנה קבוצה לפי מספר הסיטה את `m[1]` ל-`undefined`.
  assert.deepEqual(
    PACKAGES.filter(monthlySurchargePerLine).map((p) => p.id),
    ["7", "10", "11"],
  );
});

test("נתב מתומחר בנפרד גם בסדר המילים ההפוך, בהשכרה ובדמי שכירות", () => {
  for (const text of [
    'בתוספת 20 ש"ח לחודש עבור הנתב',
    "נתב פייבר בהשכרה בתוספת 25 ₪ לחודש",
    'דמי שכירות נתב 20 ש"ח',
    'הנתב בתשלום נפרד של 20 ש"ח לחודש',
  ]) {
    assert.equal(routerPricedSeparately(withText(text)), true, text);
  }
  for (const text of ["נתב כלול במחיר", 'עלות נתב 0 ש"ח']) {
    assert.equal(routerPricedSeparately(withText(text)), false, text);
  }
});

test("`שנה ראשונה` היא הצהרת עלייה בדיוק כמו `שנה שנייה`", () => {
  for (const text of [
    "בשנה הראשונה 24.90 ₪",
    'שנה ראשונה 24.90 ש"ח',
    "12 התשלומים הראשונים",
  ]) {
    assert.equal(declaresRiseInText(withText(text)), true, text);
  }
});

test("`חודשים <מחיר>` הוא הצהרת עלייה גם בלי סימן מטבע, ובשני הסדרים", () => {
  for (const text of ["3 חודשים ב-24.90", "המחיר ל-3 חודשים 24.90", "24.90 ל-3 חודשים"]) {
    assert.equal(declaresRiseInText(withText(text)), true, text);
  }
  // ⚠️ ובלי לתפוס מספר שאינו מחיר: `5G` אחרי כמות חודשים, מהירות ונפח.
  for (const text of [
    "חבילה ל-24 חודשים 5G",
    "אינטרנט 1000/100Mbps",
    "10,000GB גלישה",
    "מחיר קבוע לכל החיים",
  ]) {
    assert.equal(declaresRiseInText(withText(text)), false, text);
  }
});

test("`בתום תקופת ההטבה` — צורת הסמיכות — נקראת כמו `בתום ההטבה`", () => {
  for (const text of [
    'בתום תקופת ההטבה 59.90 ש"ח',
    "בסיום תקופת ההטבה 59.90",
    "לאחר תקופת ההטבה 59.90",
  ]) {
    assert.equal(declaresRiseInText(withText(text)), true, text);
  }
});

test("מחיר ללקוחות קיימים אינו המחיר שהגולש הזה יקבל", () => {
  assert.equal(
    priceForExistingCustomers(withText("דמי שימוש חודשיים: 109.90 ₪ ללקוחות קיימים")),
    true,
  );
  // ⚠️ את התנאי ההפוך הגולש הזה דווקא **כן** מקיים — הוא בא להצטרף.
  assert.equal(priceForExistingCustomers(withText("ללקוחות חדשים בלבד 24.90 ₪")), false);
  // ⚠️ והצהרה בלי מחיר אינה הצהרה על המחיר שבכותרת.
  assert.equal(priceForExistingCustomers(withText("הטבה ללקוחות קיימים")), false);
  // id 69 הוא המופע החי, והוא יוצא מבריכת הסלולר.
  const existing = PACKAGES.filter(priceForExistingCustomers).map((p) => p.id);
  assert.deepEqual(existing, ["69"]);
  assert.equal(
    pool("cellular").some((p) => p.id === "69"),
    false,
  );
});

test("הבריכה והבחירה לא זזו — רק id 69 יצא", () => {
  assert.equal(pool("cellular").length, 11);
  assert.equal(pool("home").length, 2);
  assert.equal(computeSaving(PACKAGES, "cellular", 1, 220).pick.id, "121");
  assert.equal(computeSaving(PACKAGES, "cellular", 2, 220).pick.id, "117");
  assert.equal(computeSaving(PACKAGES, "home", 1, 220).pick.id, "157");
});

test("תקרת הקלט מרווחת מתקרת החישוב, ועוצרת רק אבסורד", () => {
  assert.ok(MAX_TYPED_SPEND > MAX_SPEND * 10);
  // חשבון עסקי אמיתי עובר במלואו למסלול "נציג יבדוק ידנית".
  assert.ok(40000 <= MAX_TYPED_SPEND);
  // שלוש-עשרה ספרות — מה ש-`maxLength={13}` בשדה מתיר — אינן חשבון.
  assert.ok(9999999999999 > MAX_TYPED_SPEND);
});
