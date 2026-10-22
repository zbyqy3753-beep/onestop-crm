import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basePackages,
  discountIsCapped,
  electricityRank,
  listable,
} from "../src/app/lp/catalog/catalog.ts";
import {
  addonFreeThenPaid,
  computeSaving,
  declaresRiseInText,
  isComparable,
  requiresMultipleLines,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 39 — חמש השמטות באותו דפוס שהקבצים האלה מתעדים שוב ושוב:
 * שער שחובר לצורה אחת של אותה הצהרה ולא לאחיותיה.
 *
 *   • קיצורים בגרשיים **מסולסלים** (U+201C/U+201D). הנימוק מסבב 38
 *     ("הגרשיים חי בקטלוג הזה") חל מילה במילה גם עליהם: `חו”ל` ו-`מע”מ`
 *     חיים בקטלוג **היום** ארבע פעמים, ולכן `ש”ח` ו-`אח”כ` הם צורות
 *     שהרענון הבא יכתוב — ושני השערים שקוראים את הקיצורים האלה לא ראו.
 *   • `אח״כ` הוחזק ב**שתי** הגדרות שונות שלא הסכימו: `RISE_IN_TEXT`
 *     הכירה ב-`אח"כ`/`אח״כ` לבדן, ו-`ADDON_FREE_THEN_PAID` דווקא הכירה
 *     גם בצורה בלי גרש — אותו קיצור, שתי רשימות.
 *   • `headlineIsLineTierPrice` תפסה `[2-9] קווים` לבדו, כלומר מדרגה
 *     של 10 קווים ומעלה נשארה כותרת של קו בודד.
 *   • אין שום שער בענף הסלולרי למשפחה של `routerPricedSeparately` —
 *     חיוב חודשי מוצהר שהמחיר אינו מכיל. ids 7 ו-10 יושבים בבריכה
 *     **היום** עם "תשלום חודשי 8 שקלים לרשומה" בתיאור.
 *   • `electricityRank` קרא `hoursText != null` בזמן ש-`cardStats`
 *     מדפיסה אריח שעות רק למחרוזת לא ריקה — כלומר `hoursText: ""`
 *     הוריד מסלול **קבוצה שלמה** בלי שום דבר על המסך שמסביר זאת, בדיוק
 *     ה-regression שההערה מעל השורה מתעדת.
 *   • `discountIsCapped` קראה שלושה שדות מתוך הארבעה ששערי הנוסח
 *     קוראים, והחסר הוא דווקא `priceAfterPromoNote`.
 *
 * כולן דוממות בקטלוג של היום, ולכן הבדיקות מקבעות **גם** את המספרים
 * שעל המסך: בריכה שזזה בלי שהכותרת תזוז היא מה שהסבב שינה.
 */

const PACKAGES = basePackages();
const live = listable(PACKAGES);
const pool = (track) => live.filter((p) => isComparable(p, track));

const fake = (fields) => ({
  id: "fake",
  name: "x",
  type: "5G",
  badges: [],
  category: "cellular",
  priceModel: "monthly",
  price: 25,
  priceAfterPromo: null,
  description: null,
  benefits: null,
  priceAfterPromoNote: null,
  spec: {
    kosher: false,
    unlimitedData: true,
    dataGb: null,
    minutes: 5000,
    lineTiers: null,
  },
  ...fields,
});

/* ── גרשיים מסולסלים: אותו קיצור, צורה שהקטלוג כבר נושא ───────────── */

test("`ש”ח` בגרש מסולסל נקרא כקיצור השקל בשער העלייה", () => {
  // אותה הצהרה בדיוק של id 112 ("חודשיים 149 שח" מול price 169), רק
  // שהגרש הוא U+201D — התו שחי בקטלוג היום ב-`חו”ל` וב-`מע”מ`.
  for (const quote of ['"', "״", "''", "”", "“"]) {
    const p = fake({ description: `סיבים 1000/100 חודשיים 149 ש${quote}ח` });
    assert.equal(declaresRiseInText(p), true, `ש${quote}ח`);
  }
});

test("`אח״כ` נקרא בכל צורות הגרש — ושני השערים מסכימים עליו", () => {
  for (const ahkaz of ['אח"כ', "אח״כ", "אח''כ", "אח”כ", "אחכ"]) {
    assert.equal(
      declaresRiseInText(fake({ description: `12 ערוצי דרמות ${ahkaz} 49.9` })),
      true,
      `RISE ${ahkaz}`,
    );
    assert.equal(
      addonFreeThenPaid(fake({ description: `2 חודשים HBO ${ahkaz} 25 שח` })),
      true,
      `ADDON ${ahkaz}`,
    );
  }
});

/* ── מדרגת קווים דו-ספרתית ─────────────────────────────────────────── */

test("מדרגה של 10 קווים ומעלה היא מדרגה, לא מחיר של קו בודד", () => {
  const p = fake({
    price: 29.9,
    description: "קו בודד 49.90 ₪ * 10 קווים ומעלה – 29.90 ₪ לקו * המחיר קבוע לכל החיים!",
  });
  assert.equal(requiresMultipleLines(p), true);
  // ⚠️ ולא הכיוון ההפוך: כשהמחיר שבמפרט הוא דווקא מחיר הקו הבודד,
  // הרשומה נשארת בבריכה (הכרעת id 129).
  const single = fake({
    price: 49.9,
    description: "קו בודד 49.90 ₪ * 10 קווים ומעלה – 29.90 ₪ לקו",
  });
  assert.equal(requiresMultipleLines(single), false);
});

/* ── חיוב חודשי מוצהר שהמחיר אינו מכיל, בענף הסלולרי ──────────────── */

test("`תשלום חודשי 8 שקלים לרשומה` פוסל — זו אותה משפחה כמו נתב שמתומחר בנפרד", () => {
  // ⚠️ זה השער היחיד בסבב הזה שמזיז את הבריכה, ובכוונה: ids 7 ו-10 ישבו
  // בה עם ₪8 לחודש לקו שהמחיר אינו מכיל — ₪96 לשנה לכל קו שהכותרת
  // הבטיחה שלא ייגבו. התקדים הוא תוספת הנתב של 4.9 ₪ מסבב 38.
  const ids = pool("cellular").map((p) => p.id);
  assert.ok(!ids.includes("7"), "id 7 (ACE 5G) מצהיר על ₪8 לחודש לקו");
  assert.ok(!ids.includes("10"), "id 10 (King 5G) מצהיר על ₪8 לחודש לקו");
  // ⚠️ 11 ולא 12 מאז שהמחיר שמותנה ב-`ללקוחות קיימים` נפסל (סבב 40):
  // id 69 יצא מהבריכה. הוא היה היקר בה (₪109.9) ולעולם לא ה-argmin,
  // ולכן אף מספר שמוצג לא זז.
  assert.equal(ids.length, 11);
});

test("סכום שהוא **המחיר עצמו** אינו תוספת", () => {
  // ids 31/38/39/40: "תשלום חודשי בסך 69.9 ₪ כל קו סלולר" — זה המחיר,
  // ולא חיוב נוסף. שער אינו אמור לומר על חבילה דבר שאינו נכון עליה.
  const asPrice = fake({ price: 69.9, description: "+ תשלום חודשי בסך 69.9 ₪ לכל קו סלולר." });
  assert.equal(isComparable(asPrice, "cellular"), true);
  const extra = fake({ price: 69.9, description: "עלות הו\"ק 40 ₪ , תשלום חודשי 8 שקלים לרשומה." });
  assert.equal(isComparable(extra, "cellular"), false);
});

/* ── חשמל: שעות חלקיות נקראות מההצהרה, כמו שהאריח קורא אותה ───────── */

test("`hoursText: \"\"` אינו הצהרה על שעות חלקיות", () => {
  // `cardStats` מדפיסה אריח שעות רק למחרוזת לא ריקה, ולכן מסלול כזה
  // ירד קבוצה שלמה בלי שום דבר על המסך שמסביר את ההורדה — וזה החזיר
  // את המיון "הנחה: מהגבוהה לנמוכה" לסדר שאינו מונוטוני.
  const p = {
    id: "e",
    category: "electricity",
    priceModel: "discount",
    name: "מסלול",
    discountPercent: 7,
    description: null,
    benefits: null,
    priceAfterPromoNote: null,
    spec: { allHours: false, hoursText: "" },
  };
  assert.equal(electricityRank(p), -7);
});

test("`allHours` שאינו בוליאן אינו מבטל הצהרת שעות", () => {
  // `"false"` כמחרוזת — הצורה שהמחלץ מייצר כשהוא קורא שדה טקסטואלי —
  // הוא אמת ב-JS, ולכן מסלול לילה של 20% חזר לראש הדף.
  const night = (allHours) => ({
    id: "e",
    category: "electricity",
    priceModel: "discount",
    name: "מסלול לילה",
    discountPercent: 20,
    description: null,
    benefits: null,
    priceAfterPromoNote: null,
    spec: { allHours, hoursText: "23:00 עד 7:00" },
  });
  assert.equal(electricityRank(night(false)), 980);
  assert.equal(electricityRank(night("false")), 980);
  assert.equal(electricityRank(night(true)), -20);
});

test("`discountIsCapped` קוראת גם את `priceAfterPromoNote`", () => {
  const p = {
    id: "e",
    category: "electricity",
    priceModel: "discount",
    name: "מסלול",
    discountPercent: 10,
    description: null,
    benefits: null,
    priceAfterPromoNote: "עד 10% הנחה, בהתאם לגובה החשבון",
    spec: { allHours: true, hoursText: null },
  };
  assert.equal(discountIsCapped(p), true);
});

/* ── והמספרים שעל המסך אינם זזים ──────────────────────────────────── */

test("הכותרות של היום נשארות כפי שהן", () => {
  const cell1 = computeSaving(PACKAGES, "cellular", 1, 220);
  assert.equal(cell1.pick.id, "121");
  assert.deepEqual([cell1.perLine, cell1.monthly, cell1.yearly], [34, 186, 2232]);

  const cell3 = computeSaving(PACKAGES, "cellular", 3, 350);
  assert.equal(cell3.pick.id, "117");
  assert.deepEqual([cell3.perLine, cell3.monthly, cell3.yearly], [29.9, 260, 3120]);

  const home = computeSaving(PACKAGES, "home", 1, 350);
  assert.equal(home.pick.id, "157");
  assert.deepEqual([home.perLine, home.monthly, home.yearly], [149, 201, 2412]);

  assert.deepEqual(
    pool("home").map((p) => p.id),
    ["157", "3"],
  );
});

test("דירוג החשמל של היום אינו זז", () => {
  const ranks = live
    .filter((p) => p.category === "electricity")
    .map((p) => `${p.id}:${electricityRank(p)}`)
    .join(" ");
  assert.equal(
    ranks,
    "143:992 152:-5 151:-6 150:980 149:985 148:-6 147:980 146:985 145:985 136:982 " +
      "142:-9.5 141:-5 140:-6 139:-7 138:-6 137:980 135:-9.5 134:985",
  );
});
