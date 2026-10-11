import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_LINES,
  MAX_SPEND,
  MIN_SPEND,
  addonFreeThenPaid,
  afterPriceDependsOnLines,
  computeSaving,
  declaresRiseInText,
  familyPriceOnly,
  isBlankSpend,
  routerPricedSeparately,
  isComparable,
  parseSpend,
  parseSpendRaw,
  priceUnknownAtLines,
  perLinePrice,
  requiresMultipleLines,
} from "../src/app/lp/catalog/savings.ts";
import { basePackages, logicName } from "../src/app/lp/catalog/catalog.ts";

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
  // המקלדת הערבית מפיקה גם את המפרידים שלה, לא רק את הספרות.
  assert.equal(parseSpend("٢٢٠٫٥"), 220.5);
  assert.equal(parseSpend("١٬٢٠٠"), 1200);
  assert.equal(parseSpend("9000"), MAX_SPEND);
});

test("קלט: סימן כיווניות בלתי נראה בהדבקה אינו פוסל סכום", () => {
  // ⚠️ דף עברי ואקסל מעטיפים סכום ב-RLM/LRM. המבקר מדביק
  // "₪1,200" שנראה בדיוק כמו הדוגמה שבהודעת השגיאה, ונדחה.
  assert.equal(parseSpend("‏₪1,200‏"), 1200);
  assert.equal(parseSpend("‎220‎"), 220);
  assert.equal(parseSpend("⁦220.50⁩"), 220.5);
  // הניקוי אינו מכשיר קלט שפסול מסיבה אחרת.
  assert.equal(parseSpend("‏2 20‏"), 0);
});

test("קלט: פסיק שאינו מפריד אלפים פוסל — `220,5` לא הופך ל-2205", () => {
  // ⚠️ הרגל אירופאי לכתוב 220.5. הסינון השקט הפך אותו ל-2,205 ₪ בחודש
  // והציג כותרת של ₪26,100 בשנה על סכום שהלקוח מעולם לא הזין.
  assert.equal(parseSpend("220,5"), 0);
  assert.equal(parseSpend("2,20"), 0);
  assert.equal(parseSpend("1,2,3"), 0);
  assert.equal(parseSpend("1,,200"), 0);
  // מפרידי אלפים אמיתיים ממשיכים לעבוד, גם עם ₪ ורווחים.
  assert.equal(parseSpend("5,000"), MAX_SPEND);
  assert.equal(parseSpend("₪1,200"), 1200);
});

test("קלט: נקודה כמפריד אלפים פוסלת — `1.200` לא הופך ל-1.2", () => {
  // ⚠️ הכיוון ההפוך של `220,5`. השומר הקודם נכתב לפסיק בלבד, ולכן נקודה
  // בודדת חמקה: המסך הצהיר "אתם משלמים ₪1.2 בחודש" והנציג קיבל את אותו
  // מספר בהערה. לחשבון חודשי אין שלוש ספרות אחרי הנקודה.
  assert.equal(parseSpend("1.200"), 0);
  assert.equal(parseSpend("2.200"), 0);
  // עשרוני אמיתי (עד שתי ספרות) ממשיך לעבוד.
  assert.equal(parseSpend("220.50"), 220.5);
  assert.equal(parseSpend("1,200.50"), 1200.5);
});

test("קלט: רווח באמצע המספר פוסל — `2 20` לא הופך ל-220", () => {
  assert.equal(parseSpend("2 20"), 0);
  assert.equal(parseSpend("1 200"), 0);
  // רווח בקצוות, ו-₪ משני הצדדים, הם כתיב לגיטימי.
  assert.equal(parseSpend("  220  "), 220);
  assert.equal(parseSpend("₪ 1,200"), 1200);
  assert.equal(parseSpend("1,200 ₪"), 1200);
});

test("קלט: סכום מתחת לרצפה אינו חשבון חודשי", () => {
  // ⚠️ `0.5` הפיק מסך תוצאה מלא והערה לנציג. החבילה הזולה בקטלוג היא
  // 19.9 ₪, ולכן חשבון חד-ספרתי הוא קלט שגוי ולא חשבון נמוך.
  assert.equal(parseSpend("0.5"), 0);
  assert.equal(parseSpend("5"), 0);
  assert.equal(parseSpend(String(MIN_SPEND)), MIN_SPEND);
});

test("בריכת ההשוואה אינה ריקה בשני המסלולים", () => {
  assert.ok(pool("cellular").length > 5, `סלולר: ${pool("cellular").length}`);
  /*
    ⚠️ הרצפה הורדה מ-3 ל-2 ב-23.9.2026, במכוון. ארבע חבילות
    "טריפל פלוס WiFi 6/7" יצאו מהבריכה כש-`routerPricedSeparately`
    למד את הניסוח "תתווסף עלות על הנתב על סך 4.9 ₪" — הן
      מחייבות תוספת חודשית שאינה במחיר הרשום. בריכה של שתיים
    היא דקה, וזה המקום שיצעק אם עוד שומר יצמצם אותה לאפס.
  */
  assert.ok(pool("home").length > 1, `בית: ${pool("home").length}`);
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
    // ⚠️ `logicName` ולא `name`: הסימון `*2*` נמחק מהכותרת
    // שמוצגת לגולש, והבדיקה הזו היא על הראיה שהלוגיקה קוראת.
    const p = PACKAGES.find((x) => logicName(x).includes(name));
    assert.ok(p, `לא נמצאה בקטלוג: ${name}`);
    assert.equal(isComparable(p, p.category), false, `${p.name} נכנסה לבריכה`);
  };
  // 39.9 ₪, שני שדות המחיר ריקים, ובתיאור "מהחודש ה-13 והלאה- 59.9 ₪".
  excluded("Partner Golden 5G");
  // שירות סטרימינג שסומן בטעות `hasInternet` — הזול ביותר בקטגוריה.
  excluded("החבילה המושלמת 79 שח");
});

test("מחיר שמותנה בכמות קווים אינו נכנס לבריכת ההשוואה", () => {
  const excluded = (name) => {
    // ⚠️ `logicName` ולא `name`: `*2*` נמחק מהכותרת שמוצגת
    // לגולש, והבדיקה הזו היא על הראיה שהלוגיקה קוראת.
    const p = PACKAGES.find((x) => logicName(x).includes(name));
    assert.ok(p, `לא נמצאה בקטלוג: ${name}`);
    assert.equal(isComparable(p, p.category), false, `${p.name} נכנסה לבריכה`);
  };
  // 32 ₪ — המחיר "לכל קו שני" בחבילה של ארבעה, לא מחיר של קו בודד.
  // אין לה `description` כלל, ולכן השם הוא הראיה היחידה.
  excluded("4 ב 130 *2*");
  // "*לרוכשים 2 מנויים ויותר*" — מינימום חוזי של שני קווים.
  excluded("TOTAL 5G 300GB");
  // מחיר של חבילה שלמה שיושב בשדה מחיר-לקו.
  excluded("3 קווים ב 92.70");

  // ⚠️ ההגנה לא נגסה במנצחת: הבריכה עדיין מחזירה מחיר אמיתי בשני
  // המסלולים, ולא רק "לא נמצאה חבילה".
  for (const track of ["cellular", "home"]) {
    assert.ok(computeSaving(PACKAGES, track, 1, 500).pick, `${track}: הבריכה התרוקנה`);
  }
});

test("מחיר משפחתי אינו מחיר של קו בודד", () => {
  const family = PACKAGES.find((x) => x.name === "wecomFamily 4G");
  const single = PACKAGES.find((x) => x.name === "wecomFree 4G");
  assert.ok(family && single, "חבילות WeCom לא נמצאו בקטלוג");
  assert.ok(familyPriceOnly(family));
  assert.equal(familyPriceOnly(single), false);

  // קו אחד: 29.9 הוא מחיר למנוי במסלול משפחתי, ולכן לא מוצע למי שקונה קו יחיד.
  const one = computeSaving(PACKAGES, "cellular", 1, 500);
  assert.ok(one.pick, "הבריכה התרוקנה לקו אחד");
  assert.notEqual(one.pick.name, "wecomFamily 4G");
  // הנבחרת לקו אחד לא תומחרה לפי המחיר המשפחתי (29.9). wecom300GB 5G
  // ב-34 ₪ מנצחת בצדק — היא מחיר למנוי בודד.
  assert.ok(perLinePrice(one.pick, 1) > family.price, `קו בודד תומחר לפי המחיר המשפחתי ${family.price}`);

  // שני קווים ומעלה: המחיר המשפחתי הוא בדיוק מה שיגבו.
  const two = computeSaving(PACKAGES, "cellular", 2, 500);
  assert.equal(two.pick?.name, "wecomFamily 4G");
});

test("תוקף מוגבל בניסוח חופשי נחשב לעלייה במחיר", () => {
  const fake = (description) => ({ name: "x", description, benefits: null });
  for (const text of ["מחיר תקף ל 24 חודשים", "מחיר קבוע ל24 חודשים", "למשך שנתיים", "למשך 5 שנים"]) {
    assert.ok(declaresRiseInText(fake(text)), `לא זוהה: ${text}`);
  }
  assert.equal(declaresRiseInText(fake("גלישה חופשית ללא הגבלה")), false);
});

test("צורות נוספות של עלייה בטקסט חופשי נתפסות", () => {
  // ⚠️ סריקת הקטלוג מ-12.9.2026: כל אחת מהן הופיעה בחבילה אמיתית
  // וחמקה מהרגקס. ראה ההערה על `RISE_IN_TEXT`.
  const fake = (description) => ({ name: "x", description, benefits: null });
  for (const text of [
    "12 ערוצי דרמות חינם אח\"כ 49.9",
    "חודשיים ראשונים 24.90",
    "לחודשיים ראשונים ב-39",
    "חודש ראשון חינם",
    "מחיר לשנה ואז 179 שח",
    "לאחר שנה 159 ₪ לחודש",
    "שנה שניה שלישית 229",
  ]) {
    assert.ok(declaresRiseInText(fake(text)), `לא זוהה: ${text}`);
  }
});

test("מחיר-אחרי-הטבה אחד לחבילה שמתמחרת לפי כמות מנויים אינו בר-השוואה", () => {
  // סלקום "משפחתי פלוס": priceAfterPromo 59.9, ובטקסט "לאחר שנה … עד 2
  // מנויים כולל – 64.90 ₪ למנוי". המספר היחיד שנמסר אינו המחיר לקו אחד.
  const p = PACKAGES.find((x) => x.name.includes("סלקום משפחתי פלוס"));
  assert.ok(p, "לא נמצאה בקטלוג: סלקום משפחתי פלוס");
  assert.ok(afterPriceDependsOnLines(p));
  assert.equal(isComparable(p, "cellular"), false);
  // בלי מחיר-אחרי-הטבה המדרגות עצמן הן המידע, והכלל לא חל.
  const pro = PACKAGES.find((x) => x.name.includes("סלקום 5G PRO"));
  assert.ok(pro, "לא נמצאה בקטלוג: סלקום 5G PRO");
  assert.equal(afterPriceDependsOnLines(pro), false);
  // פלאפון "500GB 5G TOGETHER": "מנוי 1 בתונכית 39 / מנוי 2 35 / מנוי 3 33 /
  // לאחר שנה 69.90" — אותו מקרה בניסוח אחר (וגם עם שגיאת הכתיב).
  const together = PACKAGES.find((x) => x.name.includes("500GB 5G TOGETHER"));
  assert.ok(together, "לא נמצאה בקטלוג: 500GB 5G TOGETHER");
  assert.ok(afterPriceDependsOnLines(together));
  assert.equal(isComparable(together, "cellular"), false);
});

test("בית: נתב שמתומחר מחוץ למחיר פוסל את החבילה", () => {
  const fake = (description) => ({ name: "x", description, benefits: null });
  // yes: "עלות נתב אינטרנט 20שח (יש הטבה על הנתב למשך שנה ללא עלות)".
  const yes = PACKAGES.filter((x) => x.name.startsWith("יס + אולטימייט"));
  assert.ok(yes.length >= 1, "לא נמצאו בקטלוג חבילות יס + אולטימייט");
  for (const p of yes) {
    assert.ok(routerPricedSeparately(p), `${p.name}: הנתב הנפרד לא זוהה`);
    assert.equal(isComparable(p, "home"), false, `${p.name} נכנסה לבריכה`);
  }
  assert.ok(routerPricedSeparately(fake("נתב פייבר בהשכרה בתוספת 25 ₪ לחודש")));
  // נתב חינם או כלול אינו חיוב נסתר.
  assert.equal(routerPricedSeparately(fake("עלות נתב 0 ש\"ח")), false);
  assert.equal(routerPricedSeparately(fake("נתב כלול במחיר")), false);
  assert.equal(routerPricedSeparately(fake("139 ₪ + 34.9 ₪ נתב סטאר = 173.9 ₪")), false);
});

test("תוספת שניתנת חינם ואחר כך מחויבת פוסלת את החבילה", () => {
  const fake = (description) => ({ name: "x", description, benefits: null });
  // HOT "סיב 1000/100 כולל NEXT TV": 119 → 135, ובטקסט "12 ערוצי דרמות
  // חינם אח"כ 49.9" ו-"2חודשים HBO אח"כ 25שח". הייתה הבחירה של מסלול הבית.
  const hot = PACKAGES.find((p) => p.name === "סיב 1000/100 כולל NEXT TV");
  assert.ok(hot, "החבילה נעלמה מהקטלוג");
  assert.ok(addonFreeThenPaid(hot), "התוספת שהופכת לבתשלום לא זוהתה");
  assert.equal(isComparable(hot, "home"), false, "נכנסה לבריכה למרות תוספת בתשלום");
  assert.ok(addonFreeThenPaid(fake("ערוצי ספורט ללא עלות ואח״כ 29.9")));
  // עליית המחיר עצמו אינה תוספת — לזה יש priceAfterPromo.
  assert.equal(addonFreeThenPaid(fake("חודשיים ב-59 ש\"ח אח\"כ 119 ש\"ח")), false);
  assert.equal(addonFreeThenPaid(fake("נתב כלול במחיר")), false);
  // הבחירה של הבית לא נשענת יותר עליה.
  const pick = computeSaving(PACKAGES, "home", 1, 250).pick;
  assert.notEqual(pick?.name, "סיב 1000/100 כולל NEXT TV");
});

test("מדרגת קווים שמייקרת נלקחת כפי שהיא, בלי Math.min", () => {
  const golan = PACKAGES.find((p) => p.name.includes("קיץ חם בדור 5"));
  assert.ok(golan, "החבילה נעלמה מהקטלוג");
  // המדרגה: 2 קווים ב-44.90 ₪ לקו, 3 קווים ב-39.90. המחיר המוצג הוא 39.90.
  assert.equal(perLinePrice(golan, 2), 44.9);
  assert.equal(perLinePrice(golan, 3), 39.9);
});

test("כמות שמתחת לטבלת המדרגות אינה מתומחרת לפי מחיר הבסיס", () => {
  // ⚠️ הבדיקה הזו **קיבעה קודם את הבאג**: היא תיעדה `perLinePrice(golan, 1)
  // === 39.9` כהתנהגות רצויה ("פחות מהמדרגה הנמוכה ביותר — המחיר המוצג").
  // 39.9 הוא מחיר **שלושה** קווים: התיאור מפרט "קו בודד – 49.90 ₪", כלומר
  // מי שביקש קו אחד קיבל כותרת מנופחת ב-₪120 בשנה.
  const golan = PACKAGES.find((p) => p.name.includes("קיץ חם בדור 5"));
  assert.ok(golan, "החבילה נעלמה מהקטלוג");
  assert.equal(priceUnknownAtLines(golan, 1), true);
  assert.equal(priceUnknownAtLines(golan, 2), false);
  assert.equal(priceUnknownAtLines(golan, 3), false);
  assert.ok(
    !computeSaving(PACKAGES, "cellular", 1, 500).pick?.name.includes("קיץ חם בדור 5"),
    "חבילה בלי מחיר ידוע לקו בודד נבחרה בכל זאת",
  );

  // בסיס **גבוה** מהמדרגה הנמוכה ביותר הוא טבלת הנחת-כמות עקבית, ונשאר.
  const partner = PACKAGES.find((p) => p.name.includes("Partner Star"));
  assert.ok(partner, "החבילה נעלמה מהקטלוג");
  assert.equal(priceUnknownAtLines(partner, 1), false);
  assert.equal(perLinePrice(partner, 1), 39.9);

  // ⚠️ ההגנה לא ריקנה את הבריכה באף כמות קווים.
  for (const units of [1, 2, 3, 5, 10]) {
    assert.ok(computeSaving(PACKAGES, "cellular", units, 500).pick, `${units} קווים: הבריכה התרוקנה`);
  }
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

test("כל חבילה ביתית בת-השוואה מגיעה ל-CRM כ-tv, גם בלי המילה בשם", async () => {
  const { crmCategory } = await import("../src/app/lp/config.ts");
  // ⚠️ המחשבון הביתי מודד מול אינטרנט+טלוויזיה, ולכן הליד שלו חייב
  // להגיע לנציג שמסנן לפי טלוויזיה. סטינג "STING פייבר 1000מגה" (type
  // "סיבים") היא ההוכחה שהשם לבדו לא מספיק.
  for (const p of pool("home")) {
    assert.equal(crmCategory(p), "tv", `${p.name}: נשלחה כ-${crmCategory(p)}`);
  }
  const sting = PACKAGES.find((p) => p.name === "STING פייבר 1000מגה");
  assert.ok(sting, "STING פייבר 1000מגה נעלמה מהקטלוג — עדכן את הבדיקה");
  assert.equal(crmCategory(sting), "tv");
});

test("עלייה בטקסט נתפסת גם עם שגיאת הקלדה ב'חודשים ראשונים'", () => {
  const mk = (description) => ({ description, benefits: null });
  assert.ok(declaresRiseInText(mk('עלות 3 חודשים ראושנים 99 ש"ח')));
  assert.ok(declaresRiseInText(mk('עלות 3 חודשם ראשונים 129 ש"ח')));
  assert.ok(declaresRiseInText(mk("3 חודשים ראשונים ב-69")));
  assert.ok(!declaresRiseInText(mk("אינטרנט סיבים עד 1000/100 כולל נתב")));
  // ⚠️ הבחירה בבית אינה משתנה בגלל ההקשחה — 72/71 יקרות ממנה ממילא.
  const before = computeSaving(PACKAGES, "home", 1, 300).pick;
  assert.ok(before, "אין בחירה במסלול הבית");
  assert.notEqual(before.name, "1000/100 ללא VOD");
});

test("מחיר-אחרי-הטבה שאינו מספר אינו בר-השוואה", () => {
  /*
    ⚠️ הקטלוג נכנס לקוד דרך cast בלי ולידציה, והשער בדק עד
    כה רק את `price`. `"19"` כמחרוזת ניצח את הבחירה, ו-`"69 ₪"`
    הפיל את שלב 3 של המחשבון במקום להציג מספר שגוי.
  */
  const real = PACKAGES.find((p) => p.category === "cellular" && isComparable(p, "cellular"));
  assert.ok(real, "הבריכה הסלולרית ריקה");
  assert.equal(isComparable({ ...real, priceAfterPromo: "19" }, "cellular"), false);
  assert.equal(isComparable({ ...real, priceAfterPromo: "69 ₪" }, "cellular"), false);
  assert.equal(isComparable({ ...real, priceAfterPromo: 0 }, "cellular"), false);
  // מדרגת קווים עם מחיר שאינו מספר מגיעה ל-`perLinePrice` בדיוק כמו שהיא.
  assert.equal(
    isComparable({ ...real, spec: { ...real.spec, lineTiers: [{ lines: 2, price: "44.9" }] } }, "cellular"),
    false,
  );
});

test("תוספת נתב בניסוח \"תתווסף עלות … על סך\" פוסלת א׳ היא", () => {
  // ⚠️ אותה הצהרה כמו "בתוספת 25 ₪", בניסוח שלא נתפס.
  const wifi = PACKAGES.find((p) => p.name.includes("טריפל פלוס WiFi 6 All"));
  assert.ok(wifi, "לא נמצאה בקטלוג: טריפל פלוס WiFi 6 All");
  assert.ok(routerPricedSeparately(wifi));
  assert.equal(isComparable(wifi, "home"), false);
  // הניסוח ההפוך — נתב שכלול בלי תוספת — אינו נפסל.
  assert.equal(
    routerPricedSeparately({ description: "הנתב כלול במחיר החבילה", benefits: null }),
    false,
  );
});

test("הצהרת תמחור לפי כמות בלי שום מספר מאחוריה פוסלת", () => {
  // גולן 750GB: price 39, בלי `priceAfterPromo` ובלי `lineTiers`, ובתיאור
  // "קו ראשון 39 , בצירוף 2 קווים ומעלה 35 לקו". אין ממה לחשב מחיר לקו.
  const p = PACKAGES.find((x) => x.name.includes("750GB") && x.provider.slug === "golan");
  assert.ok(p, "לא נמצאה בקטלוג: גולן 750GB");
  assert.equal(p.priceAfterPromo, null);
  assert.equal(p.spec.lineTiers, null);
  assert.ok(afterPriceDependsOnLines(p));
  assert.equal(isComparable(p, "cellular"), false);
});

test("מדרגות לבדן עדיין מחליפות מחיר-אחרי-הטבה", () => {
  // סלקום 5G PRO: אין `priceAfterPromo` אבל יש `lineTiers` — הקטלוג
  // אומר מה המחיר בכל כמות, ולכן `priceUnknownAtLines` מטפלת בזה.
  const pro = PACKAGES.find((x) => x.name.includes("סלקום 5G PRO"));
  assert.ok(pro, "לא נמצאה בקטלוג: סלקום 5G PRO");
  assert.equal(pro.priceAfterPromo, null);
  assert.ok(pro.spec.lineTiers?.length);
  assert.equal(afterPriceDependsOnLines(pro), false);
});

test("מסלול משפחתי מזוהה גם כשהשם באנגלית", () => {
  // הרשומה שבשבילה המסנן נכתב — `wecomFamily 4G` — נתפסה עד
  // היום רק בזכות "(מסלול משפחתי)" שבתיאור. השם לבדו מספיק.
  assert.ok(familyPriceOnly({ name: "wecomFamily 4G", description: null }));
  assert.ok(familyPriceOnly({ name: "x", description: "מסלול משפחתי" }));
  assert.equal(familyPriceOnly({ name: "wecomFree 4G", description: null }), false);
});

test("הצהרת עלייה שיושבת בשם בלבד נקראת גם היא", () => {
  // חמש חבילות בקטלוג חסרות `description` ו-`benefits` גם יחד;
  // עבורן השם הוא הטקסט היחיד שיש.
  assert.ok(declaresRiseInText({ name: "חבילה 79 שח חודש ראשון חינם", description: null, benefits: null }));
  assert.equal(declaresRiseInText({ name: "חבילה רגילה", description: null, benefits: null }), false);
});

test("מדרגה עם כמות קווים שאינה חיובית פוסלת את החבילה", () => {
  const base = PACKAGES.find((x) => x.name.includes("סלקום 5G PRO"));
  assert.ok(base);
  const broken = {
    ...base,
    spec: { ...base.spec, lineTiers: [{ lines: 0, price: 1 }] },
  };
  assert.equal(isComparable(broken, "cellular"), false);
});

test("החיסור נעשה באגורות ולא נופל על דיוק בינארי", () => {
  /*
   * `512.8 - 59.8` הוא `452.99999999999994` ב-IEEE-754, ולכן
   * `Math.floor` עליו החזיר 452 במקום 453 — ₪12 בשנה שנמחקו
   * מהכותרת. השגיאה הייתה תמיד לכיוון החִסרון (הכותרת מעולם לא
   * ניפחה), אבל היא הופיעה ב-690 סכומים על רשת של אגורה.
   */
  const r = computeSaving(PACKAGES, "cellular", 2, 512.8);
  assert.equal(r.pick.price, 29.9);
  assert.equal(r.monthly, 453);
  assert.equal(r.yearly, 5436);
});

test("yearly נשאר בדיוק monthly כפול 12", () => {
  for (const track of ["cellular", "home"]) {
    for (let units = 1; units <= 10; units++) {
      for (const spend of [512.8, 220.5, 34.5, 2048.7, 1024.6, 99.99]) {
        const r = computeSaving(PACKAGES, track, units, spend);
        assert.equal(r.yearly, r.monthly * 12, `${track}/${units}/${spend}`);
        assert.ok(Number.isInteger(r.monthly), `monthly לא שלם: ${track}/${units}/${spend}`);
      }
    }
  }
});

test("החיסכון לעולם אינו גדול מהחיסכון האמיתי", () => {
  // שמירה על כוונת ה-`Math.floor`: עיגול כלפי מטה, לעולם לא הבטחה מנופחת.
  for (let units = 1; units <= 10; units++) {
    for (let cents = 1000; cents <= 500000; cents += 137) {
      const spend = cents / 100;
      const r = computeSaving(PACKAGES, "cellular", units, spend);
      if (!r.pick) continue;
      const exact = (Math.round(spend * 100) - Math.round(perLinePrice(r.pick, units) * 100) * units) / 100;
      assert.ok(r.monthly <= exact + 1e-9, `ניפוח ב-${spend}/${units}: ${r.monthly} > ${exact}`);
      assert.ok(r.monthly > exact - 1, `חִסרון גדול מדי ב-${spend}/${units}`);
    }
  }
});

test("עלות נתב נתפסת בשתי צורות הגרש ובשתי צורות הסמיכות", () => {
  /*
   * הגרשיים (U+05F4) חי בקטלוג, והשער הזה מגן מפני ניפוח של 14%
   * בחיסכון השנתי — כלומר טעות לכיוון ההבטחה לגולש.
   */
  const d = (description) => ({ name: "x", description, benefits: null });
  for (const s of ['ש"ח', "ש״ח", "₪", "שח"]) {
    assert.ok(routerPricedSeparately(d(`עלות נתב 20 ${s} לחודש`)), `עלות נתב + ${s}`);
    assert.ok(routerPricedSeparately(d(`עלות הנתב 20 ${s} לחודש`)), `עלות הנתב + ${s}`);
    assert.ok(
      routerPricedSeparately(d(`תתווסף עלות על הנתב על סך 4.9 ${s} לחודש`)),
      `תתווסף + ${s}`,
    );
  }
  assert.equal(routerPricedSeparately(d("נתב כלול במחיר")), false);
});

test("החבילות שנבחרות היום לא נפסלות בטעות בעקבות הרחבת הגרש", () => {
  // ההרחבה אמורה להיות שקופה לקטלוג הנוכחי: הבחירה בפועל לא משתנה.
  assert.equal(computeSaving(PACKAGES, "home", 1, 350).pick.name.includes("טריפל פלוס"), true);
  assert.equal(computeSaving(PACKAGES, "cellular", 1, 220).pick.price, 34);
  assert.equal(computeSaving(PACKAGES, "cellular", 4, 220).pick.price, 29.9);
});

test("סעיף חסימת גלישה אינו הצהרת עלייה במחיר", () => {
  // ⚠️ `לאחר מכן` לבדו תפס בוילרפלייט של שימוש הוגן ופסל
  // ארבע חבילות סלקום מהבריכה, בעוד אחותן באותו תמחור נשארה בפנים.
  const fake = (description) => ({ name: "x", description, benefits: null });
  assert.equal(
    declaresRiseInText(
      fake("החיוב יהיה לפי כמות הניצול בפועל. לאחר מכן נהיה רשאיים לחסום את הגלישה."),
    ),
    false,
  );
  // והצהרה אמיתית עדיין נתפסת — מספר בהמשך המשפט הוא ההבדל.
  for (const text of [
    "לאחר מכן 59",
    "לאחר מכן 20 ₪",
    "לאחר מכן עולה ל199שח",
    "לאחר מכן תוספת של 15 ₪",
  ]) {
    assert.ok(declaresRiseInText(fake(text)), `לא זוהה: ${text}`);
  }
});

test("ה״א הידיעה אינה מבריחה הצהרת תמחור לחודשים הראשונים", () => {
  // ⚠️ "חודשים ראשונים" נתפס ו-"החודשים הראשונים" נתפס, אבל
  // הצורה שביניהם נפלה בין שתי החלופות. שמה של id 31 בקטלוג הוא
  // "BASIC דור 5 בחודשיים הראשונים", והיא נשארה מחוץ לבריכה רק בזכות
  // התפיסה השגויה של `לאחר מכן` — שני התיקונים תלויים זה בזה.
  const fake = (description) => ({ name: "x", description, benefits: null });
  for (const text of [
    "2 חודשים הראשונים ב-39",
    "חודשיים הראשונים ב-39",
    "3 החודשים הראשונים ב-39",
    "2 חודשים ראשונים ב-39",
  ]) {
    assert.ok(declaresRiseInText(fake(text)), `לא זוהה: ${text}`);
  }
  const basic = PACKAGES.find((x) => x.id === "31");
  assert.ok(basic, "לא נמצאה בקטלוג: id 31");
  assert.ok(declaresRiseInText(basic), `${basic.name}: השם מצהיר תמחור לחודשיים`);
  assert.equal(isComparable(basic, "cellular"), false);
});

test("מחיר נתב עשרוני הוא גם הוא חיוב נסתר", () => {
  // ⚠️ מחיר נתב נכתב כמעט תמיד כ-14.90 / 9.90 / 4.90, והחלופה
  // הזו הכירה רק במספר שלם, בעוד השכנה לה כן כללה חלק עשרוני.
  const fake = (description) => ({ name: "x", description, benefits: null });
  for (const text of [
    "עלות נתב 14.90 ש\"ח",
    "עלות הנתב 4.9 ₪ לחודש",
    "עלות נתב 9.90 ₪",
    "עלות נתב 20 ש\"ח",
  ]) {
    assert.ok(routerPricedSeparately(fake(text)), `לא זוהה: ${text}`);
  }
  assert.equal(routerPricedSeparately(fake("עלות נתב 0.00 ₪")), false);
});

test("קלט: שדה שמכיל רק סימני כיווניות נחשב ריק", () => {
  /*
   * ⚠️ `parseSpendRaw` מנקה סימני כיווניות לפני הפרסור, אבל בדיקת
   * ה"ריקנות" במחשבון השתמשה ב-`trim()` שאינו מסיר אותם. הדבקה של
   * תא ריק מאקסל עברי נראתה כ"הוקלד משהו", ולכן יציאה מהשדה הדליקה
   * הודעת שגיאה מתחת לשדה שנראה ריק לחלוטין.
   */
  assert.equal(isBlankSpend(""), true);
  assert.equal(isBlankSpend("   "), true);
  assert.equal(isBlankSpend("‏"), true);
  assert.equal(isBlankSpend("‎‏"), true);
  assert.equal(isBlankSpend("‏ "), true);
  assert.equal(isBlankSpend("⁦⁩"), true);
  // ומה שבאמת הוקלד נשאר "לא ריק" — גם קלט פסול.
  assert.equal(isBlankSpend("0"), false);
  assert.equal(isBlankSpend("‏1,200‏"), false);
  assert.equal(isBlankSpend("abc"), false);
});

/*
 * `lineTiers` שאינו מערך מפיל חבילה אחת, לא את רינדור השרת.
 *
 * ⚠️ שלושת הקוראים של `lineTiers` בדקו `tiers?.length` ומיד קראו
 * ל-`every` / `some` / `filter`. `length` הוא אמת גם על מחרוזת, והקטלוג
 * נכנס דרך `as unknown as Catalog` בלי ולידציה — כלומר רענון שיכתוב
 * `"lineTiers": "2"` (או שיישאב את השדה כמחרוזת JSON, בדיוק כפי
 * שקרה ל-`price`) היה מפיל את **כל הדף** ב-`TypeError:
 * tiers.every is not a function` בזמן רינדור השרת, במקום להפיל
 * רשומה אחת בשקט כמו כל שער אחר בקובץ.
 */
test("מדרגות: `lineTiers` שאינו מערך נפסל בשקט ולא מפיל את הדף", () => {
  // ⚠️ תבנית שה-`priceAfterPromo` שלה ריק: רק אז המדרגות הן המספר
  // שנקרא בפועל (`perLinePrice` מתעלמת מהן ברגע שיש מחיר-אחרי-הטבה).
  const tpl = PACKAGES.find((p) => isComparable(p, "cellular") && p.priceAfterPromo == null);
  assert.ok(tpl, "לא נמצאה חבילת סלולר בת-השוואה בלי מחיר-אחרי-הטבה");
  const withTiers = (lineTiers) => ({
    ...tpl,
    id: "test-tiers",
    price: 29.9,
    priceAfterPromo: null,
    spec: { ...tpl.spec, lineTiers },
  });

  // צורות שאינן מערך: לא זורקות, ולא מתקבלות.
  for (const junk of ["2", '[{"lines":1,"price":5}]', "", 0, 7, true, {}, { length: 2 }, new Set(), new Map()]) {
    const p = withTiers(junk);
    assert.doesNotThrow(() => isComparable(p, "cellular"), `זרק על ${JSON.stringify(junk)}`);
    assert.equal(isComparable(p, "cellular"), false, `התקבל למרות ${JSON.stringify(junk)}`);
    assert.doesNotThrow(() => priceUnknownAtLines(p, 1), `priceUnknownAtLines זרק על ${JSON.stringify(junk)}`);
    assert.doesNotThrow(() => perLinePrice(p, 1), `perLinePrice זרק על ${JSON.stringify(junk)}`);
    assert.doesNotThrow(() => computeSaving([p, ...PACKAGES], "cellular", 1, 250));
  }

  // מדרגה שהיא `null` בתוך מערך תקין — אותו `TypeError` ברמה אחת פנימה.
  for (const junk of [[null], [undefined], [{ lines: 1 }], [{ price: 5 }], [null, { lines: 1, price: 5 }]]) {
    const p = withTiers(junk);
    assert.doesNotThrow(() => isComparable(p, "cellular"), `זרק על ${JSON.stringify(junk)}`);
    assert.equal(isComparable(p, "cellular"), false, `התקבל למרות ${JSON.stringify(junk)}`);
    assert.doesNotThrow(() => priceUnknownAtLines(p, 1));
    assert.doesNotThrow(() => perLinePrice(p, 1));
  }

  // ⚠️ `lineTiers: null` ומערך ריק הם "בלי מדרגות" ולא רשומה פגומה —
  // זהו המצב של רוב הקטלוג, והשער אינו רשאי לפסול אותם.
  assert.equal(isComparable(withTiers(null), "cellular"), true);
  assert.equal(isComparable(withTiers([]), "cellular"), true);
  // ומדרגה תקינה ממשיכה לעבוד.
  const good = withTiers([{ lines: 2, price: 24.9 }]);
  assert.equal(isComparable(good, "cellular"), true);
  assert.equal(perLinePrice(good, 2), 24.9);
  assert.equal(perLinePrice(good, 1), 29.9);
});

/*
 * הכותרת עצמה אינה זזה בגלל רשומה פגומה.
 *
 * ⚠️ המשמעות המעשית של השער למעלה: החיסכון שמוצג הוא אותו מספר בדיוק
 * עם הרשומה הפגומה ובלעדיה — לא `NaN`, ולא מספר שנבנה על מדרגה
 * שאיש לא יכול לקרוא.
 */
test("מדרגות: רשומה פגומה לא משנה את החיסכון המוצג ולא מייצרת NaN", () => {
  const tpl = PACKAGES.find((p) => isComparable(p, "cellular") && p.priceAfterPromo == null);
  for (const junk of ["2", { length: 3 }, [null], [{ lines: 0, price: 1 }], [{ lines: 1, price: "1" }]]) {
    const bad = {
      ...tpl,
      id: "test-tiers-2",
      price: 1,
      priceAfterPromo: null,
      spec: { ...tpl.spec, lineTiers: junk },
    };
    for (const units of [1, 2, 5, 10]) {
      const clean = computeSaving(PACKAGES, "cellular", units, 250);
      const dirty = computeSaving([bad, ...PACKAGES], "cellular", units, 250);
      assert.ok(Number.isFinite(dirty.monthly), `NaN על ${JSON.stringify(junk)}`);
      assert.equal(dirty.monthly, clean.monthly, `הכותרת זזה בגלל ${JSON.stringify(junk)}`);
      assert.equal(dirty.yearly, dirty.monthly * 12);
    }
  }
});

/*
 * תוספת חינם שהופכת לבתשלום — גם בניסוח המלא.
 *
 * ⚠️ `ADDON_FREE_THEN_PAID` הכירה רק בקיצור `אח"כ`, בעוד `RISE_IN_TEXT`
 * מכירה כבר ב-`לאחר מכן` וב-`אחר כך` כאותה הצהרה בדיוק — והקטלוג כותב
 * דווקא את הצורה המלאה: id 123 "4 חודשים חינם, לאחר מכן תוספת של 15 ₪"
 * ו-id 83 "3 חודשים חינם, לאחר מכן 20 ₪". בנוסף נדרש שהמספר יבוא **מיד**
 * אחרי המילה, ולכן גם `חינם אח"כ תוספת של 15 ₪` חמק. על חבילה שיש לה
 * `priceAfterPromo` מספרי שני החורים האלה מרכיבים כותרת שנבנית על
 * המחיר בלי התוספת.
 */
test("תוספת חינם שהופכת לבתשלום נתפסת גם בניסוח המלא 'לאחר מכן'", () => {
  const fake = (description) => ({ name: "x", description, benefits: null });
  for (const text of [
    // הנוסח המדויק של id 123, שה-`priceAfterPromo` שלה הוא 169.
    "מגדיל טווח לנחושת – 4 חודשים חינם, לאחר מכן תוספת של 15 ₪",
    // הנוסח המדויק של id 83.
    "200 דקות – 3 חודשים חינם, לאחר מכן 20 ₪",
    // אותה הצהרה בקיצור, אבל עם מילים בין המילה למספר.
    'ערוצי דרמות 4 חודשים חינם אח"כ תוספת של 15 ₪',
    "ערוצי ספורט במתנה ואחר כך 29.9 ₪",
    "מגדיל טווח ללא עלות, לאחר מכן 14.90 ₪ לחודש",
  ]) {
    assert.ok(addonFreeThenPaid(fake(text)), `לא זוהה: ${text}`);
  }
  // הניסוחים שנתפסו עד היום ממשיכים להיתפס.
  assert.ok(addonFreeThenPaid(fake('12 ערוצי דרמות חינם אח"כ 49.9')));
  assert.ok(addonFreeThenPaid(fake("ערוצי ספורט ללא עלות ואח״כ 29.9")));
  assert.ok(addonFreeThenPaid(fake('2חודשים HBO אח"כ 25שח')));
  // ⚠️ והגבול לא זז: עליית **המחיר עצמו** אינה תוספת — לזה יש
  // `priceAfterPromo`. ספרה בתוך החלון היא מה שמבדיל.
  assert.equal(addonFreeThenPaid(fake('חודשיים ב-59 ש"ח אח"כ 119 ש"ח')), false);
  assert.equal(addonFreeThenPaid(fake("מחיר מוזל של 39.90 שח לחודשיים ראשונים ולאחר מכן 49.90 לחודש")), false);
  assert.equal(addonFreeThenPaid(fake("נתב כלול במחיר")), false);
  assert.equal(addonFreeThenPaid(fake("התקנה ללא עלות")), false);

  // חבילה ביתית אמיתית מהבריכה + המשפט של id 123 = מחוץ לבריכה.
  const sting = PACKAGES.find((p) => p.id === "3");
  assert.ok(sting, "לא נמצאה בקטלוג: id 3");
  assert.equal(isComparable(sting, "home"), true, "id 3 אינה בבריכה — עדכן את הבדיקה");
  assert.equal(sting.priceAfterPromo, 229);
  const withAddon = {
    ...sting,
    description: `${sting.description}\n\nמגדיל טווח לנחושת – 4 חודשים חינם, לאחר מכן תוספת של 15 ₪`,
  };
  assert.equal(isComparable(withAddon, "home"), false, "תוספת חודשית נסתרת נכנסה לבריכה");

  // ⚠️ ההקשחה לא נגעה בבחירה של היום.
  assert.equal(computeSaving(PACKAGES, "home", 1, 350).pick?.id, "157");
  assert.ok(pool("home").length > 1, `בית: ${pool("home").length}`);
});

/*
 * ה״א הידיעה אינה מבריחה הצהרת מחיר לשנה השנייה.
 *
 * ⚠️ אותה מלכודת בדיוק שתוקנה ב-`ה?ר[אוש]{2,3}נים`, ולא הוחלה על
 * אחיותיה: `שנה שניי?ה` תפס את "שנה שניה שלישית 229" שבקטלוג (id 158)
 * אבל לא את "בשנה השנייה 229 ₪" — הניסוח הנפוץ יותר בעברית. חבילה
 * שתכתוב כך את העלייה שלה הייתה נכנסת לבריכה כמחיר "לנצח".
 */
test("ה״א הידיעה אינה מבריחה הצהרת מחיר לשנה השנייה", () => {
  const fake = (description) => ({ name: "x", description, benefits: null });
  for (const text of [
    "בשנה השנייה 229 ₪",
    "שנה השניה 229",
    "בשנה השלישית 229",
    "בשנה הרביעית 329",
    // הצורות שנתפסו עד היום, כולל זו שבקטלוג.
    "שנה שניה שלישית 229",
    "שנה שלישית 229",
    "שנה רביעית329",
  ]) {
    assert.ok(declaresRiseInText(fake(text)), `לא זוהה: ${text}`);
  }
  // "שנה ראשונה" לבדה אינה הצהרת עלייה.
  assert.equal(declaresRiseInText(fake("גלישה ללא הגבלה בשנה הראשונה")), false);
  /*
   * ⚠️ הבריכה לא התרוקנה ולא זזה.
   *
   * 23 ולא 24 מאז ש-`PRICED_BY_LINE_COUNT` קורא גם את הצורה
   * "N קווים <מחיר> כל קו": id 11 (`Prince`) נושא טבלת מחירים לפי
   * כמות בפרוזה ("קו בודד 39.9שח ... 2 קווים 34.9 שח כל קו") בלי
   * `lineTiers`, והוא היחיד בקטלוג בצורה הזו. הנבחרת לא זזה.
   */
  assert.equal(pool("cellular").length, 23, `סלולר: ${pool("cellular").length}`);
  assert.equal(computeSaving(PACKAGES, "cellular", 1, 220).pick?.price, 34);
});

/*
 * `priceAfterPromoNote` הוא השדה הרביעי שהשערים קוראים.
 *
 * ⚠️ חמשת שערי הנוסח קראו `rawName` + `description` + `benefits` ודילגו
 * דווקא על השדה שקיים כדי להחזיק את המשפט של המפעיל על מה שקורה
 * כשההטבה נגמרת. זו אותה השמטה בדיוק שתוקנה כבר פעמיים (`logicName`
 * שנוסף לשלושה מתוך חמישה, `benefits` שנשכח ב-`familyPriceOnly`).
 *
 * החור רדום עבור `declaresRiseInText` — הערה בלי מספר נפסלת ממילא
 * ב-`hasKnownAfterPrice` — אבל `priceAfterPromoCorrected` בטיפוס מתעד
 * את התצורה שמחיה אותו: מספר שהוזן **ידנית** לצד ההערה המקורית. אז
 * ההערה היא הטקסט היחיד שמתאר את החשבון, ואף שער לא קרא אותה.
 */
test("שערי הנוסח קוראים גם את `priceAfterPromoNote`", () => {
  const note = (priceAfterPromoNote) => ({
    name: "x",
    description: null,
    benefits: null,
    priceAfterPromoNote,
  });
  // הנוסח המדויק של ההערה על id 83.
  assert.ok(addonFreeThenPaid(note("*- 200 דקות – 3 חודשים חינם, לאחר מכן 20 ₪")));
  // הנוסח המדויק של השם של id 110 / התיאור של "4 ב 130".
  assert.ok(requiresMultipleLines(note("עלות החבילה לכל קו שני ₪32.00")));
  assert.ok(routerPricedSeparately(note('לאחר שנה 159 ₪ לחודש, עלות נתב 34.9 ש"ח')));
  assert.ok(familyPriceOnly(note("המחיר הוא למסלול משפחתי")));
  assert.ok(afterPriceDependsOnLines({ ...note("עד 2 מנויים כולל – 64.90 ₪ למנוי"), priceModel: "monthly", spec: {} }));
  assert.ok(declaresRiseInText(note("פקיעה אחרי שנה וחצי, מחיר לאחר פקיעה 44.9 ש״ח")));
  // הערה שאינה אומרת כלום על חיוב נוסף אינה פוסלת.
  assert.equal(addonFreeThenPaid(note("המחיר כולל הכול")), false);
  assert.equal(routerPricedSeparately(note("הנתב כלול במחיר")), false);
  assert.equal(requiresMultipleLines(note("מחיר לקו בודד")), false);

  // חבילה אמיתית מהבריכה שההערה שלה תוקנה ידנית — התוספת החודשית
  // שבהערה פוסלת אותה, בדיוק כאילו הייתה בתיאור.
  const sting = PACKAGES.find((p) => p.id === "3");
  assert.ok(sting, "לא נמצאה בקטלוג: id 3");
  const corrected = {
    ...sting,
    priceAfterPromo: 229,
    priceAfterPromoCorrected: true,
    priceAfterPromoNote: "*- 200 דקות – 3 חודשים חינם, לאחר מכן 20 ₪",
  };
  assert.equal(isComparable(corrected, "home"), false, "הערה עם חיוב חודשי נוסף נכנסה לבריכה");

  // ⚠️ אף חבילה בקטלוג של היום לא זזה בגלל קריאת השדה: כל 11 ההערות
  // יושבות על חבילות שאין להן `priceAfterPromo` מספרי, ולכן
  // `hasKnownAfterPrice` פוסל אותן ממילא.
  // ⚠️ 23 — ראה ההערה על אותה בדיקה למעלה (id 11 נפסל כמחיר לפי כמות).
  assert.equal(pool("cellular").length, 23);
  assert.equal(pool("home").length, 2);
  for (const p of PACKAGES) {
    if (p.priceAfterPromoNote == null) continue;
    assert.equal(isComparable(p, p.category), false, `${p.name}: הערה בלי מספר נכנסה לבריכה`);
  }
});

/*
 * ⚠️ הכותרת מבטיחה "אפשר לחסוך עד X" — ולכן X חייב להיות קטן מהחשבון
 * שהוקלד, בכל כמות קווים שתימסר למנוע. `units: 0` איפס את מכפיל העלות
 * והחיסכון יצא בגובה כל החשבון; `units: -2` יצא גדול ממנו.
 */
test("מחשבון: החיסכון קטן מהחשבון בכל כמות קווים שתימסר", () => {
  for (const units of [0, -2, 0.4, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1, 2, 10, 11, 1000, 1e6]) {
    for (const track of ["cellular", "home"]) {
      const r = computeSaving(PACKAGES, track, units, 1000);
      assert.ok(Number.isFinite(r.monthly), `${track}/${units}: monthly=${r.monthly}`);
      assert.ok(r.monthly < 1000, `${track}/${units}: חיסכון ${r.monthly} מתוך חשבון של 1000`);
      assert.equal(r.yearly, r.monthly * 12);
    }
  }
});

/*
 * ⚠️ הגידור חייב להיות משני הצדדים. הוא נכתב מלמטה בלבד, מהנימוק
 * ש"הסלקטור מגיש 1..10 ולכן זה שער לקורא הבא" — נימוק שחל במדויק על
 * הצד הגבוה ולא יושם: `units: 1e6` החזיר `monthly` של 29,899,000-
 * ו-`yearly` של 358,788,000-. `worthwhile` היה `false` ולכן זה לא
 * הגיע למסך, אבל זה מספר חסר-פשר שיוצא מהמנוע.
 */
test("מחשבון: כמות קווים אבסורדית נחתכת לתקרה ולא מייצרת מספר חסר-פשר", () => {
  for (const track of ["cellular", "home"]) {
    const top = computeSaving(PACKAGES, track, MAX_LINES, 1000);
    for (const units of [MAX_LINES + 1, 50, 1000, 1e6]) {
      const r = computeSaving(PACKAGES, track, units, 1000);
      assert.equal(r.lines, MAX_LINES, `${track}/${units}: lines=${r.lines}`);
      assert.equal(r.monthly, top.monthly, `${track}/${units}: monthly זז מעל התקרה`);
      assert.ok(r.monthly > -1000, `${track}/${units}: monthly=${r.monthly}`);
    }
  }
});

/*
 * ⚠️ המספר שה-`Saving` מבטיח הוא המספר שהצרכן מציג.
 *
 * הגידור של `units` נעשה בתוך `computeSaving`, והתוצאה שלו לא נחשפה:
 * הצרכן היחיד גזר את המחיר-לקו מחדש מה-`units` הלא מגודר, ולכן
 * המספר שהנציג קיבל בהערה יכול היה לסתור את המספר שהכותרת נבנתה עליו.
 * אומת על חבילה שמדרגתה הזולה מוצהרת ב-`lines: 1` (צורה שהקטלוג כבר
 * משתמש בה): ב-`units: 0` המנוע חייב 20 בעוד הגזירה החזירה 12.
 */
test("מחשבון: המחיר-לקו שה-Saving חושף הוא זה שהחישוב נעשה בו", () => {
  const tiered = {
    id: "tiered-probe",
    name: "בדיקה מדרגות",
    category: "cellular",
    type: "base",
    price: 12,
    lineTiers: [
      { lines: 1, price: 20 },
      { lines: 3, price: 15 },
    ],
    provider: { id: "probe", name: "Probe" },
    spec: { dataGb: 100, minutes: 1000, sms: 1000 },
  };

  for (const units of [0, -2, 0.5, Number.NaN, 1, 2, 3, 10, 1e6]) {
    for (const track of ["cellular", "home"]) {
      const r = computeSaving([tiered, ...PACKAGES], track, units, 1000);
      if (!r.pick) continue;
      assert.equal(
        r.perLine,
        perLinePrice(r.pick, r.lines),
        `${track}/${units}: perLine=${r.perLine} אינו המחיר ב-lines=${r.lines}`,
      );
      const unitCount = track === "cellular" ? r.lines : 1;
      assert.equal(
        r.monthly,
        Math.floor((Math.round(1000 * 100) - Math.round(r.perLine * 100) * unitCount) / 100),
        `${track}/${units}: monthly אינו נגזר מה-perLine שנחשף`,
      );
    }
  }
});

/*
 * ⚠️ `spec` עצמו, ולא רק `lineTiers` שבתוכו.
 *
 * הקובץ מתעד את הדוקטרינה במפורש: רשומה פגומה נופלת **בשקט**, אחת,
 * ולא מפילה את רינדור השרת של הדף כולו. `tierTable` נכתב בדיוק בשביל
 * זה — אבל הוא קורא `spec.lineTiers` בלי שער על `spec`, ולכן
 * `"spec": null` (או שדה שחסר לגמרי) הפיל `TypeError: Cannot read
 * properties of null (reading 'lineTiers')` בתוך `isComparable`, כלומר
 * בתוך `computeSaving`, כלומר בתוך רינדור השרת של `/lp` — אותו כשל
 * בדיוק שהשער ההוא נבנה למנוע, רק ברמה אחת מעל.
 *
 * `spec: "x"` כבר נפל בשקט (ל-`"x".lineTiers` יש `undefined`), וזו
 * ההוכחה שהשער קיים וחסר בדיוק מצב אחד.
 */
test("רשומה בלי `spec` נופלת בשקט ולא מפילה את רינדור הדף", () => {
  const cell = PACKAGES.find((p) => isComparable(p, "cellular"));
  const home = PACKAGES.find((p) => isComparable(p, "home"));
  assert.ok(cell && home, "לא נמצאו חבילות בת-השוואה לשתי הקטגוריות");

  for (const [track, tpl] of [
    ["cellular", cell],
    ["home", home],
  ]) {
    const good = computeSaving(PACKAGES, track, 1, 400);
    for (const spec of [null, undefined, "2", 7, [], {}]) {
      const broken = { ...tpl, id: `broken-${track}`, slug: `broken-${track}`, spec };
      assert.equal(
        isComparable(broken, track),
        false,
        `${track}/${JSON.stringify(spec) ?? "undefined"}: רשומה בלי spec תקין נכנסה לבריכה`,
      );
      // ולא מפילה את החישוב של כל הדף.
      const r = computeSaving([broken, ...PACKAGES], track, 1, 400);
      assert.equal(r.pick?.id, good.pick?.id, `${track}: הבחירה זזה בגלל רשומה פגומה`);
      assert.equal(r.monthly, good.monthly, `${track}: החיסכון זז בגלל רשומה פגומה`);
    }
  }
});

/*
 * ⚠️ הסכום מגודר בתוך המנוע, בדיוק כמו כמות הקווים.
 *
 * `MAX_LINES` נוסף אחרי שהתברר ש"הסלקטור מגיש 1..10 ולכן זה שער לקורא
 * הבא" חל גם על הצד הגבוה. אותו נימוק מילה במילה חל על `monthlySpend`,
 * והוא **לא** יושם: `MIN_SPEND` ו-`MAX_SPEND` מוגדרים בקובץ הזה עצמו
 * ו-`computeSaving` לא כיבד אף אחד מהם. `Infinity` החזיר
 * `worthwhile: true` עם `yearly: Infinity`, `NaN` החזיר `monthly: NaN`,
 * ו-`1e9` החזיר כותרת של ₪11,999,999,592 לשנה — מעל התקרה שהקובץ הזה
 * מצהיר עליה. היום הקורא היחיד מעביר פלט של `parseSpend` ולכן זה לא
 * הגיע למסך; זה שער לקורא הבא.
 */
test("מחשבון: סכום חסר-פשר מגודר בתוך המנוע ולא רק בפרסור", () => {
  for (const track of ["cellular", "home"]) {
    const capped = computeSaving(PACKAGES, track, 1, MAX_SPEND);
    const zero = computeSaving(PACKAGES, track, 1, 0);

    // ⚠️ `Infinity` הוא כאן ולא עם החריגה מהתקרה: אין לו "סכום מקוטע"
    // לחשב ממנו, ו-"לא יודעים — לא מבטיחים" הוא אותו כלל של כל הקובץ.
    for (const spend of [Number.NaN, Number.POSITIVE_INFINITY, undefined, null, "220"]) {
      const r = computeSaving(PACKAGES, track, 1, spend);
      assert.ok(Number.isFinite(r.monthly), `${track}/${spend}: monthly=${r.monthly}`);
      assert.equal(r.yearly, r.monthly * 12);
      assert.equal(r.worthwhile, false, `${track}/${spend}: worthwhile על סכום שאינו מספר`);
    }

    for (const spend of [-500, Number.NEGATIVE_INFINITY]) {
      const r = computeSaving(PACKAGES, track, 1, spend);
      assert.equal(r.monthly, zero.monthly, `${track}/${spend}: סכום שלילי אינו מטופל כ-0`);
      assert.equal(r.worthwhile, false);
    }

    for (const spend of [MAX_SPEND + 0.01, 6000, 1e9]) {
      const r = computeSaving(PACKAGES, track, 1, spend);
      assert.ok(Number.isFinite(r.monthly), `${track}/${spend}: monthly=${r.monthly}`);
      assert.equal(r.monthly, capped.monthly, `${track}/${spend}: החישוב חרג מ-MAX_SPEND`);
      assert.equal(r.yearly, capped.yearly);
    }

    // והטווח הלגיטימי לא זז.
    for (const spend of [MIN_SPEND, 220, 220.5, 1200, MAX_SPEND]) {
      const r = computeSaving(PACKAGES, track, 1, spend);
      const unitCount = track === "cellular" ? r.lines : 1;
      assert.equal(
        r.monthly,
        Math.floor((Math.round(spend * 100) - Math.round(r.perLine * 100) * unitCount) / 100),
        `${track}/${spend}: הגידור שינה סכום תקין`,
      );
    }
  }
});

/*
 * ⚠️ כל הסימנים הבלתי-נראים, ולא רק סימני הכיווניות העבריים.
 *
 * הניקוי נכתב מול U+200E/200F (מה שדף עברי ואקסל עברי מעטיפים בו סכום)
 * ונעצר שם. אבל אותו קובץ מנרמל במפורש **ספרות ערביות-הודיות** ואת
 * מפריד העשרוני `٫` ומפריד האלפים `٬` — כלומר הדבקה ממקלדת ומדף
 * ערביים היא מסלול נתמך, והסימן שהמסלול הזה נושא הוא דווקא
 * U+061C (ARABIC LETTER MARK), שלא היה ברשימה. בנוסף U+200B/200C/200D
 * (ZWSP/ZWNJ/ZWJ) נוסעים עם העתקה מדפי אינטרנט ומ-PDF, ו-`\s` ב-JS
 * אינו תופס אף אחד מהם.
 *
 * התוצאה הייתה שתי התקלות שכבר תוקנו פעמיים בשדה הזה: סכום תקין
 * שנפסל ("הזינו סכום חודשי בין ₪10 ל-₪5,000" על שדה שבו כתוב 220),
 * ותא ריק שהודבק והדליק שגיאה מתחת לשדה שנראה ריק לחלוטין.
 */
test("קלט: סימן בלתי-נראה שאינו U+200E/200F אינו פוסל סכום", () => {
  const marks = [
    ["U+061C ALM", "\u061c"],
    ["U+200B ZWSP", "\u200b"],
    ["U+200C ZWNJ", "\u200c"],
    ["U+200D ZWJ", "\u200d"],
    ["U+200E LRM", "\u200e"],
    ["U+200F RLM", "\u200f"],
    ["U+2066 LRI", "\u2066"],
  ];
  for (const [name, m] of marks) {
    assert.equal(parseSpendRaw(`${m}220${m}`), 220, `${name}: סכום תקין נפסל`);
    assert.equal(parseSpend(`${m}₪ 1,200${m}`), 1200, `${name}: סכום מפורמט נפסל`);
    assert.equal(isBlankSpend(m), true, `${name}: שדה שמכיל רק אותו אינו נחשב ריק`);
    assert.equal(isBlankSpend(`${m} ${m}`), true, `${name}: הדבקת תא ריק אינה נחשבת ריקה`);
  }
  // ומה שהוקלד באמת נשאר "לא ריק", גם מעוטף.
  assert.equal(isBlankSpend("\u061c220\u061c"), false);
  // ספרות ערביות-הודיות עם הסימן של אותה מקלדת.
  assert.equal(parseSpendRaw("\u061c\u0662\u0662\u0660\u066b\u0665\u061c"), 220.5);
});

/*
 * ⚠️ אותם שני תיקונים שענף הבית ב-`isComparable` כבר קיבל, ולא הוחלו
 * על ענף הסלולר: `hasInternet === true` (ולא הערך עצמו) ו-`p.type !== "TV"`
 * כסימן שני על רשומה שה-`spec` שלה נקרא שגוי.
 *
 * `!spec.kosher` קורא **היעדר הצהרה** כ"לא כשר". `kosher: null` היא הצורה
 * שהמחלץ מייצר לשדה שלא קרא (וקיימת בקטלוג הזה — `dataGb: null` בשמונה
 * רשומות), ושמונה רשומות הכשר הן בדיוק המחירים הזולים בקטגוריה: ₪25–₪39
 * מול ₪34 של הזולה בבריכה. רשומת כשר שדגלה לא נקרא הופכת מיד לחבילה
 * שמולה נמדד כל חשבון סלולר — כותרת חיסכון מול מוצר שאינו תחליף לקו רגיל,
 * והנימוק הזה כתוב בהערה שמעל `isComparable` עצמה.
 *
 * הבדיקה נבנית על `Kosher 5000 MIN Plus 700 2025` (₪26) ולא על רשומה
 * מומצאת: היא עוברת היום **את כל** שערי הנוסח, המחיר והמדרגות, ונעצרת
 * בשער הזה בלבד.
 */
test("סלולר: דגל כשרות שלא נקרא אינו נקרא כ'לא כשר'", () => {
  const kosher = PACKAGES.filter(
    (p) => p.category === "cellular" && p.spec?.kosher === true && (p.spec.minutes ?? 0) >= 1000,
  ).sort((a, b) => a.price - b.price);
  assert.ok(kosher.length > 0, "לא נמצאה בקטלוג חבילת כשר להישען עליה");

  const base = computeSaving(PACKAGES, "cellular", 1, 400);
  assert.ok(base.pick, "אין בחירה בבריכה הסלולרית");

  for (const src of kosher) {
    // חבילת כשר שהמחלץ קרא לה גלישה מסוננת אבל לא קרא את דגל הכשרות.
    for (const flag of [null, undefined, 0, ""]) {
      const probe = {
        ...src,
        id: `kosher-unread-${src.id}`,
        slug: `kosher-unread-${src.id}`,
        type: "5G",
        spec: { ...src.spec, kosher: flag, dataGb: 100 },
      };
      assert.equal(
        isComparable(probe, "cellular"),
        false,
        `${src.id}/kosher=${JSON.stringify(flag)}: חבילת כשר נכנסה לבריכה`,
      );
      const r = computeSaving([probe, ...PACKAGES], "cellular", 1, 400);
      assert.equal(r.pick?.id, base.pick.id, `${src.id}: הבחירה זזה לחבילת כשר`);
      assert.equal(r.monthly, base.monthly, `${src.id}: החיסכון המוצג זז`);
    }
    // ואותה רשומה בדיוק, כשדווקא `type` הוא מה שנשאר והדגל התהפך.
    const typedProbe = {
      ...src,
      id: `kosher-type-${src.id}`,
      slug: `kosher-type-${src.id}`,
      spec: { ...src.spec, kosher: false, dataGb: 100 },
    };
    assert.equal(
      isComparable(typedProbe, "cellular"),
      false,
      `${src.id}: type="כשר" לא נקרא כראיה`,
    );
  }
});

/*
 * ⚠️ `spec.unlimitedData` כערך אמת ולא כבוליאן. `"false"` — הצורה שמחלץ
 * מייצר כשהוא קורא שדה טקסטואלי, וההערה בענף הבית מתעדת אותה במפורש —
 * הוא truthy ב-JS, ולכן הוא סיפק את דרישת הגלישה בזמן ש-`dataGb` ריק:
 * קו **ללא גלישה כלל** נכנס לבריכה, ובקטגוריה הזו הוא גם הזול ביותר.
 * אותו דבר ל-`dataGb` ול-`minutes`: `"100" > 0` ו-`"5000" >= 1000` הם
 * אמת, והקטלוג נכנס דרך `as unknown as Catalog` בלי ולידציה.
 */
test("סלולר: מפרט הגלישה והדקות חייב להיות מספר, ולא ערך שנראה כמו אמת", () => {
  const voice = PACKAGES.filter(
    (p) =>
      p.category === "cellular" &&
      p.spec?.dataGb == null &&
      p.spec?.unlimitedData === false &&
      (p.spec.minutes ?? 0) >= 1000,
  );
  assert.ok(voice.length > 0, "לא נמצאה בקטלוג רשומה בלי חבילת גלישה");

  const base = computeSaving(PACKAGES, "cellular", 1, 400);

  for (const src of voice) {
    for (const flag of ["false", "0", {}, [1], 1]) {
      const probe = {
        ...src,
        id: `unlim-${src.id}`,
        slug: `unlim-${src.id}`,
        type: "5G",
        spec: { ...src.spec, kosher: false, unlimitedData: flag },
      };
      assert.equal(
        isComparable(probe, "cellular"),
        false,
        `${src.id}/unlimitedData=${JSON.stringify(flag)}: קו בלי גלישה נכנס לבריכה`,
      );
      const r = computeSaving([probe, ...PACKAGES], "cellular", 1, 400);
      assert.equal(r.monthly, base.monthly, `${src.id}: החיסכון המוצג זז`);
    }
    // גם מפרט שהוזן כמחרוזת אינו מספר.
    for (const spec of [
      { dataGb: "100", minutes: 5000 },
      { dataGb: 100, minutes: "5000" },
    ]) {
      const probe = {
        ...src,
        id: `str-${src.id}`,
        slug: `str-${src.id}`,
        type: "5G",
        spec: { ...src.spec, kosher: false, ...spec },
      };
      assert.equal(
        isComparable(probe, "cellular"),
        false,
        `${src.id}/${JSON.stringify(spec)}: מפרט כמחרוזת עבר את השער`,
      );
    }
  }
});

/* הבריכה של היום אינה מצטמצמת בעקבות ההקפדה שלמעלה. */
test("סלולר: ההקפדה על המפרט לא הוציאה אף חבילה מהבריכה של היום", () => {
  assert.equal(pool("cellular").length, 23, `בריכה: ${pool("cellular").length}`);
  for (const p of pool("cellular")) {
    assert.equal(p.spec.kosher, false, `${p.name}: דגל כשרות שאינו false`);
    assert.ok(!(p.type ?? "").includes("כשר"), `${p.name}: type=${p.type}`);
    assert.equal(typeof p.spec.minutes, "number", `${p.name}: דקות שאינן מספר`);
    assert.ok(
      p.spec.unlimitedData === true || typeof p.spec.dataGb === "number",
      `${p.name}: חבילת גלישה שאינה מוצהרת כמספר ולא כ-unlimited`,
    );
  }
});
