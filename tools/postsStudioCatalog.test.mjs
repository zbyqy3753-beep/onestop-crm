import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { cardStats, detailRows, installationIsConditional } from "../src/app/lp/catalog/format.ts";
import { studioPackage, studioPackages } from "../src/lib/posts/catalog.ts";

/*
 * ⚠️ סטודיו הפוסטים הוא הצרכן **הרביעי** של `format.ts`, לצד הכרטיס,
 * טבלת ההשוואה ומשטח העיון. הדפוס שחזר כאן שבע פעמים הוא שער שחובר
 * לכרטיס בלבד ולא לשאר המשטחים שמדפיסים את אותו שדה — ובפוסט זה גרוע
 * מבאתר: המספר מתפרסם בשם של אלירן, והקובץ עצמו מצהיר שמספר שאינו מה
 * שהגולש רואה הוא הסתירה שהפוסטים טוענים לחשוף.
 *
 * ⚠️ חלק מהבדיקות רצות על הקטלוג החי (הפגם בהתקנה **חי**: 15 רשומות)
 * וחלק על רשומות מסונתזות (`spec: null`, `hoursText` שאינו מחרוזת —
 * מלכודות לרענון הבא, שהקטלוג של היום נקי מהן).
 */

const provider = { slug: "x", name: "ספק", logo: "", raw: null };

function home(spec, over = {}) {
  return {
    id: "h1",
    slug: "h1",
    category: "home",
    categoryHe: "אינטרנט וטלוויזיה",
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
    price: 99,
    priceAfterPromo: null,
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
      hasTv: false,
      hasInternet: true,
      hasPhone: false,
      fiber: true,
      ...spec,
    },
    ...over,
  };
}

function electricity(spec, over = {}) {
  return {
    ...home({}),
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

/* ── הפגם החי: "0" שהפרוזה מכחישה ──────────────────────────────────── */

/*
 * ⚠️ `installationCost: 0` על רשומה שהפרוזה שלה מוכרת 125 או 499 ש"ח
 * לבית פרטי התפרסם בשקף כ-"התקנה: ללא עלות" — תשלום חד-פעמי של מאות
 * שקלים שנעלם. הכרטיס ב-`/lp` סוגר את זה מאז `installationIsConditional`,
 * והמשטח הזה נשאר מאחור.
 */
test("עלות התקנה מותנית אינה מתפרסמת בפוסט", () => {
  const live = listable(basePackages());
  const conditional = live.filter((p) => p.category === "home" && installationIsConditional(p));
  assert.ok(conditional.length >= 15, `צפויות 15 רשומות מותנות ומעלה, נמצאו ${conditional.length}`);
  const published = studioPackages();
  for (const p of conditional) {
    const sp = published.find((x) => x.id === p.id);
    assert.equal(sp.installation, null, `id ${p.id} מפרסם התקנה מותנית כמספר אחד`);
  }
});

test("עלות התקנה שאינה מותנית כן מתפרסמת, כולל 0 אמיתי", () => {
  const flat = studioPackage(home({ installationCost: 0 }));
  assert.equal(flat.installation, 0, "אפס שהפרוזה אינה מכחישה הוא נתון");
  assert.equal(studioPackage(home({ installationCost: 299 })).installation, 299);
  // ובקטלוג החי נשארו הרשומות שהפרוזה שלהן אינה מתנה.
  const ids = studioPackages()
    .filter((p) => p.category === "home" && p.installation != null)
    .map((p) => p.id);
  assert.ok(ids.length > 0, "כל ההתקנות נשמטו — השער רחב מדי");
});

test("אותה הכחשה גם בלי מספר קריא בפרוזה", () => {
  // id 3: "התקנה ללא עלות בבניין בית פרטי 499" — בלי יחידת מטבע, כלומר
  // המחלץ אינו קורא את 499, והרשומה נשארת מותנית בלי מספר.
  const pkg = home(
    { installationCost: 0 },
    { description: "התקנה ללא עלות בבניין בית פרטי 499" },
  );
  assert.equal(studioPackage(pkg).installation, null);
});

test("התקנה מתפרסמת רק על חבילת בית", () => {
  assert.equal(studioPackage(electricity({})).installation, null);
});

/* ── שערי הרענון: spec פגום ─────────────────────────────────────────── */

/*
 * ⚠️ `p.spec.hoursText` ישירות זרק `Cannot read properties of null`,
 * כלומר רשומת חשמל אחת פגומה הפילה את רינדור **כל** הסטודיו — אותה
 * נפילה ש-`specOf` נבנה נגדה ב-`format.ts` ולא הוחלה על המשטח הזה.
 */
test("רשומה בלי spec אינה מפילה את הסטודיו", () => {
  for (const base of [home({}), electricity({})]) {
    for (const spec of [null, undefined, "x", 5, []]) {
      const sp = studioPackage({ ...base, spec });
      assert.equal(sp.stat, null, `${base.category} / ${JSON.stringify(spec)}`);
      assert.equal(sp.installation, null);
    }
  }
});

/*
 * ⚠️ `hoursText` הוא השדה היחיד שמודפס **כמות שהוא**, בלי `nf.format`
 * ובלי `shekels` שידרדרו ערך פגום. הכרטיס ושורת הפירוט גודרו
 * ב-`typeof === "string"`; בפוסט ערך שאינו מחרוזת היה מתפרסם
 * כ-"[object Object]" בשם של אלירן.
 */
test("שעות ההנחה מתפרסמות רק כמחרוזת", () => {
  for (const hoursText of [{ from: "23:00" }, 7, ["23:00-07:00"], true]) {
    const sp = studioPackage(electricity({ hoursText }));
    assert.equal(sp.stat, null, JSON.stringify(hoursText));
  }
  assert.equal(studioPackage(electricity({ hoursText: "23:00-07:00" })).stat, "23:00-07:00");
  // מחרוזת ריקה אינה נתון, ו-`allHours` ממשיך לתפוס במקומה.
  assert.equal(studioPackage(electricity({ hoursText: "", allHours: true })).stat, "כל שעות היממה");
  assert.equal(studioPackage(electricity({ hoursText: "" })).stat, null);
});

/* ── אותם שערים בשכבה שמדפיסה ב-/lp ─────────────────────────────────── */

/*
 * ⚠️ `NaN` **הוא** number, ו-`=== 0` לא תפס אותו: האריח הדפיס "—"
 * מתחת לכיתוב "התקנה" ועוד תפס אחד משלושת המקומות בשלישיית הכותרות,
 * כלומר דחק עובדה אמיתית לטובת חור.
 */
test("אריח התקנה נשמט על ערך שאינו מספר שמיש", () => {
  for (const installationCost of [NaN, Infinity]) {
    const stats = cardStats(home({ installationCost, channels: 40 }));
    assert.deepEqual(
      stats.map((s) => s.caption),
      ["ערוצים"],
      `installationCost: ${installationCost}`,
    );
    // שורת הפירוט מדרדרת לקו מפריד, שם מקומו של ערך חסר.
    assert.deepEqual(
      detailRows(home({ installationCost })).filter((r) => r.label === "עלות התקנה"),
      [{ label: "עלות התקנה", value: "—" }],
    );
  }
  // ואפס אמיתי ממשיך לקבל אריח.
  assert.deepEqual(cardStats(home({ installationCost: 0 })), [
    { value: "ללא עלות", caption: "התקנה" },
  ]);
});

/*
 * ⚠️ מפת אובייקט יורשת את `Object.prototype`, ולכן `customerType`
 * שערכו שם של מתודה החזיר **פונקציה** טרות'ית מ-`CUSTOMER_TYPE_HE`
 * ושלח אותה ל-React כערך אריח. השער נכתב כדי להשמיט ערך רביעי ברענון,
 * וזה ערך רביעי שעקף אותו.
 */
test("סוג לקוח שאינו בטיפוס אינו מייצר אריח", () => {
  for (const customerType of ["municipal", "toString", "constructor", "hasOwnProperty", null]) {
    const captions = cardStats(electricity({ customerType })).map((s) => s.caption);
    assert.equal(captions.includes("מיועד ל"), false, `customerType: ${customerType}`);
  }
  assert.deepEqual(cardStats(electricity({ customerType: "house_committee" })), [
    { value: "ועד בית", caption: "מיועד ל" },
  ]);
});
