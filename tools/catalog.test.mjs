import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basePackages,
  disclosedRiseCount,
  isListable,
  listableCounts,
  serviceCounts,
} from "../src/app/lp/catalog/catalog.ts";
import { isComparable } from "../src/app/lp/catalog/savings.ts";
import { catalog } from "../src/app/lp/catalog/catalog.ts";
import { cardStats, compareRows, detailRows, shekels, speedLabel } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ הבדיקות רצות מול **הקטלוג האמיתי** (`packages.json`) ולא מול נתוני
 * בדיקה, ומשמעות כישלון כאן היא "הרענון האחרון של הקטלוג הפיל רשומה" —
 * לא בהכרח "מישהו שבר את הקוד".
 *
 * ⚠️ הקטלוג נכנס לקוד דרך `as unknown as Catalog`, כלומר **אין ולידציה
 * בזמן ריצה**. `isListable` הוא השער היחיד שכל החבילות עוברות בו, והוא
 * מפיל רשומה פגומה בשקט — בכוונה, כדי שלא יוצג `NaN` לגולש. השקט הזה
 * הוא גם הסכנה: עד היום אף נתיב בקוד לא השווה בין מספר החבילות שהקובץ
 * מצהיר עליו (`catalog.counts`) לבין מספר החבילות שהדף באמת מציג, ולכן
 * רענון שמפיל עשרים חבילות היה עובר בלי מילה. הבדיקות כאן הופכות את
 * הנפילה השקטה לכישלון בשם.
 */

const PACKAGES = basePackages();

/*
 * שלוש הרשומות שנופלות היום, כולן פגמי מחלץ ולא באגים בקוד:
 *
 *   18  `*2* 3 קווים ב99`      — `price: 0`, המחיר האמיתי (99) נשאר בשם בלבד
 *   22  `3 קווים ב 92.70 *2*`  — `price: 0`, המחיר האמיתי (92.70) נשאר בשם בלבד
 *   144 `סלקום אנרגי עובדי תע` — `discountPercent: null`, השם נקטע באמצע מילה
 *
 * ⚠️ אל תשלימו את 144 מ-`rawPriceField`. הערך שם הוא 6 ונראה כמו התשובה,
 * אבל באותו שדה יושב 15 בשתי רשומות שההנחה שלהן 8 ו-20 (ids 143, 150) —
 * כלומר השדה אינו אחוז ההנחה, והשלמה ממנו תפרסם אחוז שגוי באתר השוואה.
 *
 * הרשימה הזו היא חוב ידוע ולא היתר כללי: רשומה **חדשה** שתיפול תכשיל.
 *
 * ⚠️ `id` הוא **מחרוזת** בקטלוג ולא מספר. רשימה שנכתבת כמספרים לא
 * תתאים לאף רשומה, וכל השלוש יידווחו כנפילות חדשות.
 */
const KNOWN_UNLISTABLE = new Set(["18", "22", "144"]);

test("קטלוג: אף חבילה חדשה לא נופלת בשקט מהשער", () => {
  const dropped = PACKAGES.filter((p) => !isListable(p)).map((p) => p.id);
  const unexpected = dropped.filter((id) => !KNOWN_UNLISTABLE.has(id));

  assert.deepEqual(
    unexpected,
    [],
    `רשומות שהרענון האחרון הפיל ואינן ברשימת החוב הידוע: ${unexpected.join(", ")}`,
  );
});

test("קטלוג: חבילה שתוקנה יורדת מרשימת החוב", () => {
  const dropped = new Set(PACKAGES.filter((p) => !isListable(p)).map((p) => p.id));
  const fixed = [...KNOWN_UNLISTABLE].filter((id) => !dropped.has(id));

  assert.deepEqual(
    fixed,
    [],
    `רשומות שכבר תקינות ויש למחוק מ-KNOWN_UNLISTABLE: ${fixed.join(", ")}`,
  );
});

test("קטלוג: הפער בין מה שהקובץ מצהיר למה שהדף מציג הוא בדיוק החוב הידוע", () => {
  const shown = listableCounts(PACKAGES);

  assert.equal(
    catalog.counts.total - shown.total,
    KNOWN_UNLISTABLE.size,
    `הקובץ מצהיר ${catalog.counts.total} חבילות והדף מציג ${shown.total}`,
  );
});

/*
 * ⚠️ הבדיקה שמעל השוותה **סכומים בלבד**, ולכן רענון שמעביר חבילה
 * מקטגוריה לקטגוריה עובר אותה בשקט: הסך נשאר 109 וההפרש נשאר 3.
 * שלושת השדות הפר-קטגוריים של `listableCounts` לא נקראו באף מקום —
 * חושבו בכל קריאה ונזרקו — ולכן גם לא היה מי שיתפוס את זה.
 *
 * ⚠️ וגם: `catalog.counts.total` מול אורך המערך בפועל. הכותרת מגיעה
 * מהמחלץ ולא נספרת מהקובץ, כלומר היא יכולה להיות פשוט שגויה.
 */
test("קטלוג: הכותרת שהקובץ מצהיר תואמת את מה שיש בו בפועל, בכל קטגוריה", () => {
  assert.equal(catalog.counts.total, PACKAGES.length, "הסך המוצהר אינו אורך המערך");

  for (const category of ["cellular", "home", "electricity"]) {
    assert.equal(
      catalog.counts[category],
      PACKAGES.filter((p) => p.category === category).length,
      `הסך המוצהר ל-${category} אינו תואם את הרשומות בפועל`,
    );
  }

  const shown = listableCounts(PACKAGES);
  assert.equal(
    shown.cellular + shown.home + shown.electricity,
    shown.total,
    "סכום הקטגוריות הגלויות אינו הסך הגלוי",
  );
});

/*
 * ⚠️ `disclosedRiseCount` מתועדת כ"נתון האמון של הדף" — כמה חבילות
 * מצהירות על עליית מחיר בטקסט — ולא היה לה **אף קורא** בכל עץ המקור.
 * כלומר רענון שמחצה אותה היה בלתי נראה. הבדיקה כאן היא הקורא היחיד
 * שלה, והיא מנוסחת כטווח ולא כמספר מדויק: המטרה היא לתפוס קריסה
 * (המחלץ הפסיק להביא `description`), לא לנעול את הקטלוג על ערך.
 */
test("קטלוג: מונה ההצהרות על עליית מחיר אינו קורס ברענון", () => {
  const n = disclosedRiseCount(PACKAGES);
  const shown = listableCounts(PACKAGES).total;

  assert.ok(Number.isInteger(n) && n >= 0, `מונה לא תקין: ${n}`);
  assert.ok(n <= shown, `${n} הצהרות מתוך ${shown} חבילות גלויות`);
  assert.ok(n >= 10, `רק ${n} חבילות מצהירות על עלייה — המחלץ כנראה הפסיק להביא תיאורים`);
});

/*
 * השער בודק `typeof === "number"` ולא `!= null` בדיוק בגלל התרחיש הזה:
 * `"39.9" > 0` הוא `true`, ולכן מחיר שיישאב פעם אחת כמחרוזת היה עובר
 * שער רופף, מגיע ל-`shekels()` ומוצג לגולש כ-`NaN`. כאן זה נתפס בשם.
 */
test("קטלוג: שדות מספריים לא נשאבו כמחרוזת", () => {
  const offenders = [];
  for (const p of PACKAGES) {
    for (const field of ["price", "priceAfterPromo", "discountPercent"]) {
      const v = p[field];
      if (v != null && typeof v !== "number") {
        offenders.push(`${p.id}.${field}=${JSON.stringify(v)}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `שדות מספריים שהגיעו כמחרוזת: ${offenders.join(", ")}`);
});

test("קטלוג: המזהים ייחודיים", () => {
  const seen = new Set();
  const dupes = [];
  for (const p of PACKAGES) {
    if (seen.has(p.id)) dupes.push(p.id);
    seen.add(p.id);
  }

  assert.deepEqual(dupes, [], `מזהים כפולים: ${dupes.join(", ")}`);
});

test("תצוגה: יחיד ורבים — אין אריח שאומר \"1 ממירים\"", () => {
  // ⚠️ בדיוק השגיאה שההערה על `lineTiers` מזהירה מפניה, רק שהיא
  // הייתה חיה: id 70 הוא ממיר אחד והכרטיס הכריז "1 ממירים".
  for (const p of PACKAGES.filter((x) => x.category === "home" && isListable(x))) {
    const tile = cardStats(p).find((s) => s.caption.startsWith("ממיר"));
    if (!tile) continue;
    const singular = p.spec.converters === 1;
    assert.equal(
      tile.caption,
      singular ? "ממיר כלול" : "ממירים כלולים",
      `${p.id}: ${tile.value} ${tile.caption}`,
    );
  }
});

test("תצוגה: שתי המהירויות נשארות שלמות ביחידה שנבחרה", () => {
  // ⚠️ `{1000, 100}` — 15 מתוך 33 חבילות הבית — הוצג כ-"1/0.1Gb".
  assert.equal(speedLabel({ downloadMbps: 1000, uploadMbps: 100 }), "1,000/100Mb");
  assert.equal(speedLabel({ downloadMbps: 1000, uploadMbps: 1000 }), "1/1Gb");
  assert.equal(speedLabel({ downloadMbps: 500, uploadMbps: 50 }), "500/50Mb");
  assert.equal(speedLabel({ downloadMbps: 2000, uploadMbps: null }), "2Gb");
  for (const p of PACKAGES.filter((x) => x.category === "home" && isListable(x))) {
    const label = speedLabel(p.spec);
    if (label == null) continue;
    assert.ok(!/(^|[^\d])0\./.test(label), `${p.id}: מהירות שברית ב-${label}`);
  }
});

test("תצוגה: שום כרטיס לא מדפיס אותה עובדה פעמיים", () => {
  // ⚠️ 43 מתוך 106 הכרטיסים חזרו ואמרו ב"פרטים מלאים" את מה
  // שהאריח שמעליהם כבר אמר, באותו ניסוח בדיוק.
  // `מהירות (הורדה/העלאה)` נשארה במודע: רק התווית הזו אומרת מי מהם ההורדה.
  const offenders = [];
  for (const p of PACKAGES.filter(isListable)) {
    const tiles = cardStats(p);
    for (const r of detailRows(p)) {
      if (r.label === "מהירות (הורדה/העלאה)") continue;
      if (tiles.some((t) => t.value === r.value && (t.caption === r.label || r.label.includes(t.caption)))) {
        offenders.push(`${p.id}: ${r.label}=${r.value}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `עובדה שהודפסה פעמיים: ${offenders.join(", ")}`);
});

test("תצוגה: אותה **עובדה** לא נאמרת פעמיים גם בניסוח שונה", () => {
  /*
   * ⚠️ הבדיקה שמעליה משווה מחרוזות, ולכן "מונה חכם" באריח מול
   * "מונה חכם בלבד" בשורה חמקו ממנה — אותה עובדה בדיוק, בשני
   * ניסוחים, על 7 מתוך 18 מסלולי החשמל. הבדיקה הזו ממפה נושאים
   * ולא טקסט: אם האריח כבר דיבר על הנושא, השורה לא נכתבת.
   */
  const SUBJECTS = [
    { row: "סוג מונה", tiles: ["נדרש", "מתאים ל"] },
    { row: "שעות ההנחה", tiles: ["שעות ההנחה", "מתי ההנחה חלה"] },
    { row: "עלות התקנה", tiles: ["התקנה"] },
    { row: "דקות לחו״ל", tiles: ["דקות לחו״ל"] },
  ];
  const offenders = [];
  for (const p of PACKAGES.filter(isListable)) {
    const captions = new Set(cardStats(p).map((t) => t.caption));
    for (const r of detailRows(p)) {
      const subject = SUBJECTS.find((x) => x.row === r.label);
      if (subject && subject.tiles.some((c) => captions.has(c))) {
        offenders.push(`${p.id}: ${r.label}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `נושא שנאמר פעמיים: ${offenders.join(", ")}`);
});

test("תצוגה: עמלה שאינה מספר מדרדרת לקו מפריד ולא מפילה את הדף", () => {
  // ⚠️ `isListable` שומר על `price` ו-`discountPercent` בלבד. כל העמלות
  // מגיעות ל-`shekels` בלי שער, ומחרוזת הפילה שם את רינדור השרת השלם.
  assert.equal(shekels("49.9"), "—");
  assert.equal(shekels(NaN), "—");
  assert.equal(shekels(undefined), "—");
  assert.equal(shekels(49.9), "₪49.9");
  assert.equal(shekels(0), "₪0");
});

/* ────────────────────────────────────────────────────────────────────────────
 * חלק ב': המספר מול הפרוזה של אותה רשומה
 *
 * ⚠️ הבדיקות שלמעלה שומרות על השער (`isListable`) ועל התצוגה. הן **לא**
 * שואלות אף פעם אם המספר ששלף המחלץ מסכים עם המשפט שהמחלץ עצמו שמר
 * לצידו. כל רשומה בקטלוג נושאת את המקור שלה (`name` / `description` /
 * `benefits`), ולכן סתירה בין השניים ניתנת לגילוי כאן — בלי גישה ל-CRM
 * ובלי לנחש מה הערך הנכון.
 *
 * ⚠️ אי אפשר **לתקן** את הפגמים האלה: הקטלוג נשאב ממערכת שדורשת התחברות
 * אנושית, רענון חסום, ו-`packages.json` נכתב מחדש בכל רענון — תיקון ידני
 * בו נמחק. מה שכן אפשר הוא לגדר אותם: כל רשימת חוב כאן היא **בדיוק**
 * מה שהקטלוג הנוכחי מכיל, ורשומה חדשה שתיפגם תכשיל בשם.
 *
 * ⚠️ כל רשימות החוב הן מחרוזות. `id` בקטלוג הוא מחרוזת ולא מספר.
 */

const norm = (s) => String(s ?? "").replace(/\s+/g, " ");
const proseOf = (p) => norm([p.name, p.description ?? "", p.benefits ?? ""].join(" "));
const nums = (re, txt) => [...new Set([...txt.matchAll(re)].map((m) => Number(m[1].replace(/,/g, ""))))];

/**
 * משווה רשימת ממצאים לרשימת החוב הידוע ומפרידה בין השתיים:
 * ממצא **חדש** הוא רענון שהרחיב את הפגם, וממצא שנעלם הוא רשומה
 * שהתוקנה ויש למחוק אותה מהרשימה כדי שהיא לא תישאר היתר ריק.
 */
const expectFlags = (actual, expected, what) => {
  const a = [...actual].sort();
  const e = [...expected].sort();
  const added = a.filter((x) => !e.includes(x));
  const gone = e.filter((x) => !a.includes(x));
  assert.deepEqual(
    { added, gone },
    { added: [], gone: [] },
    `${what} — חדשות: ${added.join(", ") || "אין"} | נעלמו (יש למחוק מרשימת החוב): ${gone.join(", ") || "אין"}`,
  );
};

/*
 * ⚠️ הבדיקה הקיימת על "שדות מספריים לא נשאבו כמחרוזת" מכסה שלושה שדות
 * בלבד (`price`, `priceAfterPromo`, `discountPercent`) — בדיוק אלה
 * ש-`isListable` שומר עליהם. כל **שאר** המספרים בקטלוג עוברים בלי שער:
 * `shekels()` מדרדר עמלה פגומה לקו מפריד, אבל `speedLabel` עושה
 * אריתמטיקה (`mbps / 1000`) ו-`nf.format` מדפיס את מה שקיבל. מחרוזת
 * ב-`downloadMbps` תדפיס מהירות שגויה לגולש בלי שאף שער יעצור אותה.
 */
test("קטלוג: גם שדות ה-spec והעמלות הם מספרים ולא מחרוזות", () => {
  const NUMERIC = [
    "dataGb", "minutes", "sms", "intlMinutes", "simCost", "connectionFee", "transferFee",
    "downloadMbps", "uploadMbps", "converters", "extraConverterCost", "extraExtenderCost",
    "installationCost", "channels", "maxMonthlyBill", "discountPercent",
  ];
  const offenders = [];
  for (const p of PACKAGES) {
    for (const f of NUMERIC) {
      const v = p.spec?.[f];
      if (v != null && (typeof v !== "number" || !Number.isFinite(v))) {
        offenders.push(`${p.id}.spec.${f}=${JSON.stringify(v)}`);
      }
    }
    for (const t of p.spec?.lineTiers ?? []) {
      for (const f of ["lines", "price"]) {
        if (typeof t[f] !== "number" || !Number.isFinite(t[f])) offenders.push(`${p.id}.lineTiers[].${f}=${JSON.stringify(t[f])}`);
      }
    }
    if (p.rawPriceField != null && typeof p.rawPriceField !== "number") {
      offenders.push(`${p.id}.rawPriceField=${JSON.stringify(p.rawPriceField)}`);
    }
  }

  assert.deepEqual(offenders, [], `שדות שאינם מספר: ${offenders.join(", ")}`);
});

/*
 * ⚠️ `unlimitedData` ו-`dataGb` מלאים **שניהם** בחמש רשומות WeCom, וכולן
 * נושאות את אותו 10000 — כלומר 10000 הוא הקידוד של המחלץ ל"חופשי" ולא
 * נפח אמיתי. `dataLabel` מעדיף את הדגל ולכן הגולש רואה "גלישה חופשית",
 * אבל כל מי שיקרא `dataGb` ישירות (מיון, סינון, השוואה) יראה חבילה של
 * 10 טרה ויציב אותה בראש כל דירוג נפח.
 */
test("קטלוג: 'גלישה חופשית' ו-dataGb לא סותרים זה את זה מעבר לחוב הידוע", () => {
  const KNOWN = ["19", "21", "93", "116", "117"];
  expectFlags(
    PACKAGES.filter((p) => p.spec?.unlimitedData && p.spec.dataGb).map((p) => p.id),
    KNOWN,
    "unlimitedData=true יחד עם dataGb",
  );
  for (const id of KNOWN) {
    assert.equal(
      PACKAGES.find((p) => p.id === id).spec.dataGb,
      10000,
      `${id}: ה-10000 הוא הקידוד של "חופשי"; ערך אחר הוא נפח אמיתי שצריך להיקרא`,
    );
  }
});

/*
 * ⚠️ `discountPercent` יושב **פעמיים** ברשומת חשמל: ברמה העליונה
 * (`isListable`, `byPrice` ו-`afterPrice` קוראים משם) ובתוך `spec`
 * (מקור האמת של הטיפוס). היום השניים זהים בכל 19 הרשומות, ולכן אף אחד
 * לא נאלץ לבחור ביניהם — רענון שיפריד ביניהם יגרום לדף למיין לפי מספר
 * אחד ולהציג מספר אחר, בלי שום שגיאה.
 */
test("קטלוג: אחוז ההנחה זהה ברמה העליונה וב-spec", () => {
  const offenders = PACKAGES.filter((p) => p.category === "electricity" && p.discountPercent !== p.spec.discountPercent)
    .map((p) => `${p.id}: top=${p.discountPercent} spec=${p.spec.discountPercent}`);

  assert.deepEqual(offenders, [], `אחוז הנחה לא מסונכרן: ${offenders.join(", ")}`);
});

/*
 * ⚠️ המלכודת של `rawPriceField`, מקובעת במספרים.
 *
 * ב-16 מתוך 19 רשומות החשמל `rawPriceField` שווה בדיוק ל-`discountPercent`,
 * ומי שיסתכל רק עליהן יסיק שהשדה **הוא** אחוז ההנחה — ואז ישלים ממנו את
 * 144 (שם הוא 6) ויפרסם 6% שאיש לא אמר. שלוש הרשומות למטה הן ההוכחה
 * שזה שגוי: ב-143 וב-150 יושב 15 בשדה בעוד ההנחה בפועל 8 ו-20.
 *
 * הבדיקה מקבעת את הוכחת הנגד. אם רענון עתידי ימחק אותה — למשל יתקן את
 * 143 ו-150 — הבדיקה תיפול, וזה בדיוק הרגע שבו מותר לשקול מחדש אם השדה
 * ניתן לקריאה.
 */
test("קטלוג: rawPriceField אינו אחוז ההנחה — הוכחת הנגד עדיין קיימת", () => {
  const counter = PACKAGES.filter((p) => p.category === "electricity")
    .filter((p) => p.rawPriceField != null && p.rawPriceField !== p.discountPercent)
    .map((p) => `${p.id}:raw=${p.rawPriceField}/disc=${p.discountPercent}`);

  expectFlags(counter, ["143:raw=15/disc=8", "150:raw=15/disc=20", "144:raw=6/disc=null"], "הוכחת הנגד של rawPriceField");
  assert.ok(
    counter.length >= 2,
    "פחות משתי סתירות — אין יותר הוכחה ש-rawPriceField אינו אחוז ההנחה, ואסור להשלים ממנו את 144 עד שמישהו יאמת מול ה-CRM",
  );
});

/*
 * ⚠️ מסלול חשמל שלא אומר **מתי** ההנחה חלה.
 *
 * `cardStats` מדפיס את אריח "מתי ההנחה חלה" רק כש-`allHours` דלוק או
 * כשיש `hoursText`. בשש רשומות שניהם ריקים, והכרטיס מכריז אחוז הנחה בלי
 * לומר על אילו שעות — בדף השוואת מחירים זו בדיוק ההשמטה שגורמת לגולש
 * להשוות מסלול לילה מול מסלול כל-היממה כאילו הם אותו דבר.
 */
test("קטלוג: מסלול חשמל בלי שעות הנחה — בדיוק החוב הידוע", () => {
  expectFlags(
    PACKAGES.filter((p) => p.category === "electricity" && !p.spec.allHours && !p.spec.hoursText).map((p) => p.id),
    ["135", "139", "140", "141", "142", "144"],
    "מסלול חשמל בלי allHours ובלי hoursText",
  );
});

/*
 * ⚠️ כמות שסותרת את המשפט שלצידה.
 *
 * המחלץ שומר את הטקסט המקורי, ולכן `sms: 5000` על רשומה שכתוב בה
 * "3,000 SMS" הוא פגם שניתן להוכיח מהקובץ עצמו. ארבע רשומות WeCom
 * סותרות את עצמן בדיוק ככה, ובשני כיוונים הפוכים (93 גורעת, 116/117/121
 * מוסיפות) — כלומר זו טעות מחלץ ולא הטיה עקבית שאפשר לתקן בנוסחה.
 *
 * ⚠️ הרגקסים כאן מזהים את **הניסוח שקיים בקטלוג היום** ("3,000 SMS",
 * "5000הודעות", "750GBגלישה"). הם לא מנסים להבין כל משפט אפשרי: מטרתם
 * לתפוס התרחבות של חוב ידוע, לא לפרסר את הקטלוג מחדש.
 */
test("קטלוג: כמות SMS/דקות/גלישה לא סותרת את הטקסט של אותה רשומה", () => {
  const cell = PACKAGES.filter((p) => p.category === "cellular");
  const contradicts = (field, re, guard = () => true) =>
    cell
      .filter((p) => p.spec[field] != null && guard(p))
      .filter((p) => {
        const found = nums(re, proseOf(p));
        return found.length > 0 && !found.includes(p.spec[field]);
      })
      .map((p) => p.id);

  expectFlags(contradicts("sms", /(\d[\d,]*)\s*(?:הודעות|SMS|סמס)/gi), ["93", "116", "117", "121"], "sms סותר את הטקסט");
  expectFlags(contradicts("minutes", /(\d[\d,]*)\s*(?:דקות|דק['׳]\b)(?!\s*(?:שיחה\s*)?ל?חו)/g), ["2", "26", "28"], "minutes סותר את הטקסט");
  expectFlags(contradicts("intlMinutes", /(\d[\d,]*)\s*דק(?:ות|['׳])?\s*(?:שיחה\s*)?ל?חו/g), ["24"], "intlMinutes סותר את הטקסט");
  expectFlags(
    contradicts("dataGb", /(\d[\d,]*)\s*(?:GB|ג'?יגה)/gi, (p) => !p.spec.unlimitedData),
    ["36", "64"],
    "dataGb סותר את הטקסט",
  );
});

/*
 * ⚠️ `priceAfterPromo` שאין לו מקור באף מקום ברשומה.
 *
 * 12 רשומות נושאות מחיר-אחרי-הטבה שהמספר שלו **אינו מופיע ולו פעם אחת**
 * בשם, בתיאור או בהטבות של אותה רשומה: 90 מעגלת את 69.90 שבטקסט ל-69,
 * 11 כותבת 59.9 בזמן שהטקסט אומר 49.8, 1 כותבת 49.9 מול 49, ו-16, 28,
 * 70, 123 ואחרות נוקבות במספר שאין לו שום זכר ברשומה.
 *
 * זה הפגם המסוכן ביותר ברשימה: `hasKnownAfterPrice` מחזירה עליהן `true`,
 * כלומר מחשבון החיסכון סומך עליהן **יותר** מאשר על חבילה שכתבה את
 * העלייה בהערה חופשית — בדיוק ההפך מהאמת. מספר באתר השוואת מחירים
 * חייב להיות ניתן לייחוס למקור, וזו הבדיקה ששואלת את זה.
 *
 * ⚠️ הבדיקה מכוונת **נמוך בכוונה**: היא מחפשת את המספר בכל צורה, בלי
 * לדרוש ₪ או ש"ח לצידו. מספר שעובר אותה עדיין יכול להיות מיוחס לשורה
 * הלא נכונה (53 נוקבת ב-79 וב-79.90 באותו תיאור) — היא פוסלת רק את מה
 * שאי אפשר להגן עליו בכלל.
 */
test("קטלוג: priceAfterPromo ניתן לייחוס לטקסט של אותה רשומה", () => {
  const ANY_NUMBER = /(\d[\d,]*(?:\.\d+)?)/g;
  const unsourced = PACKAGES.filter((p) => p.category !== "electricity" && p.priceAfterPromo != null)
    .filter((p) => !nums(ANY_NUMBER, proseOf(p)).includes(p.priceAfterPromo))
    .map((p) => p.id);

  expectFlags(
    unsourced,
    ["1", "11", "114", "123", "16", "25", "28", "3", "35", "36", "70", "90"],
    "priceAfterPromo שאין לו מקור בטקסט",
  );
});

/*
 * ⚠️ `installationCost: 0` על רשומה שכתוב בה 499.
 *
 * 11 חבילות בית מצהירות התקנה ללא עלות בזמן שהתיאור שלהן אומר שהיא חינם
 * רק מעל 4 דירות, ו-499 ₪ לבית פרטי. `cardStats` מדפיס "ללא עלות" בלי
 * שום תנאי, ולכן הגולש שגר בבית פרטי רואה בדיוק את המספר ההפוך ממה
 * שיחויב. `HomeSpec` אינו יודע לייצג עלות מותנית, ולכן זה פגם שאין לו
 * תיקון בקוד — רק גידור.
 */
test("קטלוג: 'התקנה ללא עלות' שסותרת את התיאור — בדיוק החוב הידוע", () => {
  expectFlags(
    PACKAGES.filter((p) => p.category === "home" && p.spec.installationCost === 0 && /499/.test(p.description ?? "")).map((p) => p.id),
    ["102", "104", "107", "108", "109", "113", "115", "157", "158", "3", "92"],
    "installationCost=0 בזמן שהתיאור נוקב ב-499",
  );
});

/*
 * ⚠️ חבילה גלויה שאינה נספרת באף אחד מחמשת האריחים של "מה אנחנו משווקים".
 *
 * `serviceCounts` סופרת `cellular`, `internet`, `tv`, `bundle` ו-`electricity`
 * — ו-`hasPhone` אינו נקרא שם, ולא באף מקום אחר בשכבת הקטלוג. id 83
 * (בזק טלפון) היא חבילת טלפון בלבד, עוברת את `isListable`, מוצגת בכרטיס —
 * ונספרת באפס אריחים. הרצועה מכריזה מספרים שלא מסתכמים לקטלוג שהיא
 * מתארת. רשומה חדשה מאותו סוג תיעלם באותה שקיפות.
 */
test("קטלוג: כל חבילה גלויה נספרת לפחות באריח אחד של 'מה אנחנו משווקים'", () => {
  const uncounted = PACKAGES.filter(isListable)
    .filter((p) => p.category === "home" && !p.spec.hasTv && !p.spec.hasInternet)
    .map((p) => p.id);

  expectFlags(uncounted, ["83"], "חבילה גלויה שאינה נספרת באף אריח");
  assert.equal(
    PACKAGES.find((p) => p.id === "83").spec.hasPhone,
    true,
    "83 היא חבילת טלפון בלבד; `hasPhone` אינו נקרא היום בשום מקום בשכבת הקטלוג",
  );
});

/*
 * ⚠️ שתי שכבות באותו קוד לא יצהירו שני דברים סותרים על אותה רשומה.
 *
 * `isComparable` מתקנת נתון שגוי במקור: סטינג "החבילה המושלמת" (id 4)
 * רשומה `hasInternet: true` אף שהיא שירות סטרימינג בלבד, ולכן היא
 * נפסלת ממסלול הבית. `serviceCounts` — שמזין את הכרטיס "אינטרנט
 * וסיבים" — קראה את אותם שני דגלים בלי התיקון, וספרה 30 בעוד
 * המחשבון באותו עמוד ספר 29.
 *
 * הבדיקה מנוסחת כאינווריאנט בין שתי הפונקציות ולא על id 4, כדי
 * שתתפוס גם את התיקון הבא שיוחל על אחת מהן בלבד.
 */
test("קטלוג: הכרטיס 'אינטרנט' אינו סופר חבילה שהמחשבון מסרב לקרוא לה אינטרנט", () => {
  const counted = PACKAGES.filter(isListable).filter(
    (p) => p.category === "home" && p.spec?.hasInternet && p.type !== "TV",
  );

  assert.equal(serviceCounts(PACKAGES).internet, counted.length);

  // כל חבילה שנספרת כמשולבת חייבת להיות כזו שהמחשבון מוכן להשוות —
  // או להיפסל מסיבה אחרת שאינה "זו לא באמת אינטרנט".
  const bundles = counted.filter((p) => p.spec.hasTv);
  assert.equal(serviceCounts(PACKAGES).bundle, bundles.length);

  const tvTyped = bundles.filter((p) => p.type === "TV");
  assert.deepEqual(tvTyped, [], "חבילת TV נספרה כמשולבת");

  // והכיוון ההפוך: מה שהמחשבון מקבל חייב להיות בתוך מה שנספר.
  const accepted = PACKAGES.filter(isListable).filter((p) => isComparable(p, "home"));
  const countedIds = new Set(bundles.map((p) => p.id));
  const orphans = accepted.filter((p) => !countedIds.has(p.id)).map((p) => p.id);
  assert.deepEqual(orphans, [], `המחשבון משווה חבילות שהכרטיס אינו סופר: ${orphans.join(", ")}`);
});

/*
 * ⚠️ שתי רשומות שהגולש אינו יכול להבחין ביניהן.
 *
 * אחרי `displayName` שתי החבילות נקראות "Valentine's", אותו ספק, אותו
 * מחיר. ההבדל היחיד בקובץ הוא ש-51 היא ה-`*2*` — סימון פנימי של גרסה
 * שנייה — ושאין לה `description` ואין לה `sms`. בדף הן שני כרטיסים
 * זהים שאחד מהם פשוט מציג פחות. אתר השוואה שמראה את אותה חבילה פעמיים
 * מאבד אמון מהר יותר מכל מספר שגוי בודד.
 */
test("קטלוג: זוגות שהגולש אינו יכול להבחין ביניהם — בדיוק החוב הידוע", () => {
  /*
   * ⚠️ המחיר **אינו** חלק מהמפתח. כל עוד הוא היה בו, הבדיקה דרשה
   * ששני הכרטיסים יהיו זהים גם במחיר — ולכן תפסה רק את 50/51 ופספסה
   * בדיוק את המקרים שהיא מתארת: 23/24 ("כשר" על גולן, ₪25 מול ₪27.90)
   * ו-28/29 ("4 ב 130" על גולן, ₪34 מול ₪32). שני כרטיסים עם אותו שם
   * ואותו ספק הם בלתי-נבדלים לגולש **בגלל** שהמחיר שונה: אין בכותרת
   * שום דבר שמסביר למה.
   */
  const seen = new Map();
  for (const p of PACKAGES.filter(isListable)) {
    const k = [p.category, p.provider.slug, p.name].join("|");
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(p.id);
  }
  const pairs = [...seen.values()].filter((ids) => ids.length > 1).map((ids) => [...ids].sort().join("/"));

  expectFlags(pairs, ["23/24", "28/29", "50/51"], "זוגות בלתי-נבדלים");
});

/*
 * טבלת ההשוואה לא מכחישה נתון שהכרטיס עצמו מדפיס.
 *
 * ⚠️ `cardStats` בוחר תווית לפי הערך: בחשמל `allHours` נותן
 * "מתי ההנחה חלה" ו-`hoursText` נותן "שעות ההנחה" — שתי תוויות
 * לאותה עובדה. בלי זוג ב-`SAME_FACT` ההשוואה נפרשה לשתי שורות
 * עם "—" הדדי, והצהירה על מסלול עם שעות מפורשות שאין לו נתון.
 * הבדיקה מנוסחת כאינווריאנט ולא על זוג ids, כדי שהיא תתפוס גם את
 * הזוג הבא שייווצר באותה דרך.
 */
test("השוואה: אין שורה שבה שתי חבילות מציגות זו '—' וזו ערך, כשלשתיהן העובדה קיימת", () => {
  const electricity = PACKAGES.filter((p) => p.category === "electricity");
  const withAll = electricity.filter((p) => p.spec.allHours === true);
  const withText = electricity.filter((p) => p.spec.allHours !== true && p.spec.hoursText);
  assert.ok(withAll.length > 0 && withText.length > 0, "שני הסוגים קיימים בקטלוג");

  const bad = [];
  for (const a of withAll) {
    for (const b of withText) {
      const rows = compareRows([a, b]);
      // שתי החבילות נושאות עובדה על מתי ההנחה חלה, ולכן אסור
      // שתופיע שורה שמציגה לאחת מהן "—".
      const hours = rows.filter((r) => r.label === "שעות ההנחה" || r.label === "מתי ההנחה חלה");
      if (hours.length !== 1 || hours[0].values.includes("—")) {
        bad.push(`${a.id}/${b.id}: ${JSON.stringify(hours)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `זוגות שבהם שעות ההנחה נפרשו או הוכחשו: ${bad.slice(0, 5).join(" | ")}`);
});

/*
 * שדה תלת-מצבי שהקטלוג יודע עליו `false` לא נראה כמו שדה חסר.
 *
 * ⚠️ `detailRows` דחפה שורה רק במצב החיובי, ולכן "אין נתב" ו-"לא
 * ידוע אם יש נתב" נראו זהים בטבלה. נתב בתשלום נפרד הוא תוספת
 * חודשית אמיתית, והדף הזה משווה מחירים.
 */
test("פרטים מלאים: `false` מוצג כערך מפורש ולא נבלע", () => {
  const TRI = [
    ["routerIncluded", "נתב"],
    ["extenderIncluded", "מגדיל טווח"],
    ["vodIncluded", "VOD"],
  ];
  const missing = [];
  for (const p of PACKAGES.filter((x) => x.category === "home")) {
    const labels = new Set(detailRows(p).map((r) => r.label));
    for (const [field, label] of TRI) {
      if (p.spec[field] === false && !labels.has(label)) missing.push(`${p.id}.${field}`);
    }
  }
  assert.deepEqual(missing, [], `שדות שליליים שנבלעו: ${missing.join(", ")}`);
});
