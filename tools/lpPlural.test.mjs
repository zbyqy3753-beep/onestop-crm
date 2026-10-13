import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PACKAGES_CAPTION,
  PLANS_CAPTION,
  cardStats,
  compareRows,
  dataLabel,
  detailRows,
  speedLabel,
} from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ הבדיקות כאן רצות על רשומות **מסונתזות** ולא על `packages.json`, בשונה
 * מ-`catalog.test.mjs`. הסיבה: אין היום בקטלוג אף רשומה עם 1 בשדה כמות
 * (`minutes`, `sms`, `intlMinutes`, `channels`), ולכן "1 ערוצים" אינו באג
 * חי אלא מלכודת לרענון הבא — בדיוק המחלקה שההערה על `lineTiers` מתארת.
 * בדיקה מול הקטלוג האמיתי הייתה עוברת בלי לבדוק כלום.
 *
 * ⚠️ מה שנבדק הוא **שתי** החובות יחד: שהכיתוב ביחיד, ושצורת היחיד ממופה
 * ב-`SAME_FACT` לצורת הרבים. בלי המיפוי טבלת ההשוואה פורשת את אותה
 * עובדה לשתי שורות עם "—" הדדי, כלומר מכחישה נתון שהכרטיס מדפיס —
 * וזו תקלה גרועה יותר מכיתוב שגוי בעברית.
 */

const provider = { slug: "x", name: "ספק", logo: "", raw: null };

function cellular(spec, over = {}) {
  return {
    id: "c1",
    slug: "c1",
    category: "cellular",
    categoryHe: "סלולר",
    name: "חבילה",
    type: null,
    badges: [],
    recommended: false,
    provider,
    description: null,
    benefits: null,
    crmOrderUrl: "",
    priceAfterPromoNote: null,
    priceModel: "monthly",
    price: 50,
    priceAfterPromo: null,
    spec: {
      dataGb: null,
      unlimitedData: false,
      minutes: null,
      sms: null,
      intlMinutes: null,
      simCost: null,
      connectionFee: null,
      transferFee: null,
      esim: false,
      kosher: false,
      fiveG: false,
      lineTiers: null,
      ...spec,
    },
    ...over,
  };
}

function home(spec, over = {}) {
  return {
    ...cellular({}),
    id: "h1",
    slug: "h1",
    category: "home",
    categoryHe: "אינטרנט וטלוויזיה",
    spec: {
      downloadMbps: null,
      uploadMbps: null,
      converters: null,
      extraConverterCost: null,
      extraExtenderCost: null,
      installationCost: null,
      routerIncluded: null,
      extenderIncluded: null,
      channels: null,
      vodIncluded: null,
      hasTv: true,
      hasInternet: false,
      hasPhone: false,
      fiber: false,
      ...spec,
    },
    ...over,
  };
}

const captionsOf = (pkg) => cardStats(pkg).map((s) => s.caption);

test("כמות: דקות שיחה ביחיד וברבים", () => {
  assert.deepEqual(captionsOf(cellular({ minutes: 1 })), ["דקת שיחה"]);
  assert.deepEqual(captionsOf(cellular({ minutes: 2 })), ["דקות שיחה"]);
});

test("כמות: הודעות SMS ביחיד וברבים", () => {
  assert.deepEqual(captionsOf(cellular({ sms: 1 })), ["הודעת SMS"]);
  assert.deepEqual(captionsOf(cellular({ sms: 150 })), ["הודעות SMS"]);
});

test("כמות: דקות לחו״ל ביחיד וברבים", () => {
  assert.deepEqual(captionsOf(cellular({ intlMinutes: 1 })), ["דקה לחו״ל"]);
  assert.deepEqual(captionsOf(cellular({ intlMinutes: 300 })), ["דקות לחו״ל"]);
});

test("כמות: ערוצים ביחיד וברבים", () => {
  assert.deepEqual(captionsOf(home({ channels: 1 })), ["ערוץ"]);
  assert.deepEqual(captionsOf(home({ channels: 40 })), ["ערוצים"]);
});

test("אף כיתוב כמות אינו מצמיד 1 לצורת רבים", () => {
  const singles = [
    cellular({ minutes: 1 }),
    cellular({ sms: 1 }),
    cellular({ intlMinutes: 1 }),
    home({ channels: 1 }),
    home({ converters: 1 }),
  ];
  for (const pkg of singles) {
    for (const stat of cardStats(pkg)) {
      if (stat.value !== "1") continue;
      assert.doesNotMatch(
        stat.caption,
        /ים$|ות$/u,
        `"${stat.value} ${stat.caption}" — כיתוב רבים על ערך 1`,
      );
    }
  }
});

/*
 * ⚠️ `דקות לחו״ל` עולה לשלישיית הכותרות רק כשנשאר בה מקום, ואחרת יושב
 * ב-`detailRows`. השער שמונע כפילות חייב לקרוא את **אותה** צורת יחיד
 * שהאריח כתב, אחרת אותה עובדה מודפסת פעמיים.
 */
test("דקה לחו״ל אינה מודפסת גם באריח וגם בפרטים", () => {
  const pkg = cellular({ intlMinutes: 1 });
  assert.deepEqual(captionsOf(pkg), ["דקה לחו״ל"]);
  assert.equal(
    detailRows(pkg).some((r) => r.label.includes("לחו״ל")),
    false,
  );
});

test("דקה לחו״ל יורדת לפרטים כששלישיית הכותרות מלאה", () => {
  const pkg = cellular({ dataGb: 100, minutes: 1, sms: 1, intlMinutes: 1 });
  assert.deepEqual(captionsOf(pkg), ["גלישה בישראל", "דקת שיחה", "הודעת SMS"]);
  assert.deepEqual(
    detailRows(pkg).filter((r) => r.label.includes("לחו״ל")),
    [{ label: "דקה לחו״ל", value: "1" }],
  );
});

/*
 * ⚠️ יחיד מול רבים באותה טבלה — העובדה אחת, ולכן השורה אחת.
 */
test("ההשוואה מיישרת יחיד ורבים לשורה אחת", () => {
  const rows = compareRows([home({ channels: 1 }), home({ channels: 40 }, { id: "h2" })]);
  const channelRows = rows.filter((r) => r.label === "ערוצים" || r.label === "ערוץ");
  assert.equal(channelRows.length, 1, "שתי שורות לאותה עובדה");
  assert.deepEqual(channelRows[0].values, ["1", "40"]);

  const minuteRows = compareRows([
    cellular({ minutes: 1 }),
    cellular({ minutes: 500 }, { id: "c2" }),
  ]).filter((r) => r.label.includes("שיחה"));
  assert.equal(minuteRows.length, 1);
  assert.deepEqual(minuteRows[0].values, ["1", "500"]);
});

/*
 * ⚠️ אותו כלל גם למונים שמספרים חבילות. בניגוד לכיתובי המפרט שמעל, כאן
 * זה באג **חי**: הסוג "בסיס" בסלולר נושא חבילה אחת בלבד (וכך גם
 * "קו ביתי" בביתי), ולכן לחיצה אחת על השבב הציגה "1 חבילות מתוך 55".
 */
test("מונה החבילות ביחיד וברבים", () => {
  assert.equal(PACKAGES_CAPTION(1), "חבילה");
  assert.equal(PACKAGES_CAPTION(0), "חבילות");
  assert.equal(PACKAGES_CAPTION(55), "חבילות");
});

test("מונה מסלולי החשמל ביחיד וברבים", () => {
  assert.equal(PLANS_CAPTION(1), "מסלול");
  assert.equal(PLANS_CAPTION(0), "מסלולים");
  assert.equal(PLANS_CAPTION(18), "מסלולים");
});


function electricity(spec, over = {}) {
  return {
    ...cellular({}),
    id: "e1",
    slug: "e1",
    category: "electricity",
    categoryHe: "חשמל",
    price: null,
    priceModel: "discount",
    discountPercent: 7,
    spec: {
      discountPercent: 7,
      allHours: false,
      hoursText: null,
      customerType: "private",
      commitment: null,
      smartMeterRequired: null,
      maxMonthlyBill: null,
      ...spec,
    },
    ...over,
  };
}

/*
 * ⚠️ `spec: null` **הפיל את רינדור השרת של `/lp` כולו**, ולא רשומה אחת:
 * שלוש הפונקציות ניגשו לשדה הראשון מיד אחרי ה-cast
 * (`spec.unlimitedData` / `spec.downloadMbps` / `spec.allHours`, ובטבלה
 * `uploadMbps`). זה אותו שער ש-`hasSpec`/`tierTable` ב-`savings.ts`
 * כבר מחילות רמה אחת מעל — ראה `specOf`. רשומה בלי `spec` נקראת
 * כ"לא נמסר דבר", כמו ids 132 ו-100 שכל שדות ה-`spec` שלהן ריקים.
 */
test("רשומה בלי spec אינה מפילה את הרינדור", () => {
  for (const pkg of [cellular({}), home({}), electricity({})]) {
    for (const spec of [null, undefined, "x", 5, []]) {
      const broken = { ...pkg, spec };
      assert.deepEqual(cardStats(broken), [], `cardStats ${pkg.category}`);
      assert.deepEqual(detailRows(broken), [], `detailRows ${pkg.category}`);
      // הטבלה מציגה "—" לכל עובדה של הרשומה הפגומה, ולא זורקת.
      const rows = compareRows([broken, pkg]);
      for (const row of rows) assert.equal(row.values[0], "—", `${row.label} ${pkg.category}`);
    }
  }
  assert.equal(dataLabel(cellular({}), null), null);
  assert.equal(speedLabel(home({}), null), null);
});

/*
 * ⚠️ תווית המהירות נקבעת לפי **מי שמסר** מהירות, ולא לפי כל חבילת בית.
 * חבילה בלי אינטרנט (ids 158, 132, 109, 102, 108, 107, 100, 89, 83, 4 —
 * 10 מ-29 חבילות הבית הכשירות) הורידה את התווית לכולם, ולכן
 * `compareRows([158, 70])` הדפיס "מהירות גלישה" בעוד הכרטיס של 70
 * מדפיס "מהירות (הורדה/העלאה)" על אותו ערך בדיוק.
 */
test("חבילה בלי מהירות אינה מורידה את התווית הזוגית", () => {
  const noSpeed = home({ downloadMbps: null, uploadMbps: null });
  const pair = home({ downloadMbps: 1000, uploadMbps: 100 }, { id: "h2" });
  const rows = compareRows([noSpeed, pair]).filter((r) => r.label.includes("מהירות"));
  assert.equal(rows.length, 1, "אותה עובדה בשתי שורות");
  assert.equal(rows[0].label, "מהירות (הורדה/העלאה)");
  assert.deepEqual(rows[0].values, ["—", "1,000/100Mbps"]);
  // והתווית הזוגית **כן** נופלת כשמי שמסר מהירות לא מסר העלאה.
  const single = home({ downloadMbps: 1000, uploadMbps: null }, { id: "h3" });
  const mixed = compareRows([single, pair]).filter((r) => r.label.includes("מהירות"));
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].label, "מהירות גלישה");
});

/*
 * ⚠️ מדרגת קווים עוברת את **אותו** שער ש-`isComparable` מחילה עליה
 * (`isMoney` על המחיר, כמות שלמה מ-1 ומעלה) — אחרת הכרטיס מפרסם מחיר
 * שהמנוע מסרב להשתמש בו. `price: 0` הוא הצורה שהמחלץ מייצר כשלא קרא
 * מחיר (ids 18, 22 על `price`), והשורה הדפיסה "3 קווים ₪0".
 */
test("מדרגת קווים בלי מחיר שמיש אינה מודפסת", () => {
  const tierRow = (lineTiers) =>
    detailRows(cellular({ lineTiers })).find((r) => r.label === "מחיר לפי מספר קווים");
  assert.equal(tierRow([{ lines: 3, price: 0 }]), undefined, "₪0 כמחיר מדרגה");
  assert.equal(tierRow([{ lines: 0, price: 32 }]), undefined, "0 קווים");
  assert.equal(tierRow([{ lines: 2.5, price: 32 }]), undefined, "2.5 קווים");
  assert.equal(tierRow([{ lines: 3, price: "33" }]), undefined, "מחיר כמחרוזת");
  assert.deepEqual(tierRow([{ lines: 3, price: 0 }, { lines: 4, price: 29 }]), {
    label: "מחיר לפי מספר קווים",
    value: "4 קווים ₪29",
  });
  // המדרגות התקינות שבקטלוג היום אינן נוגעות בשער הזה.
  assert.deepEqual(tierRow([{ lines: 1, price: 44.9 }, { lines: 3, price: 39.9 }]), {
    label: "מחיר לפי מספר קווים",
    value: "קו אחד ₪44.9 · 3 קווים ₪39.9",
  });
});
