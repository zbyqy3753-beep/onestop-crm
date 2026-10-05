import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PACKAGES_CAPTION,
  PLANS_CAPTION,
  cardStats,
  compareRows,
  detailRows,
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
