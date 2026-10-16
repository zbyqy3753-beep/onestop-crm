import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basePackages,
  hasSpec,
  listable,
  listableCounts,
  phoneCount,
  serviceCounts,
} from "../src/app/lp/catalog/catalog.ts";
import { crmCategory } from "../src/app/lp/config.ts";

/*
 * ── סבב 34: שער שחובר לצרכן אחד ולא לאחיו ───────────────────────────
 *
 * שני הממצאים כאן הם שתי הפנים של אותו דפוס:
 *   1. `hasPhone` היה הדגל היחיד ב-`HomeSpec` שאף אריח ב"מה אנחנו
 *      משווקים" לא קרא, ולכן id 83 (קו טלפון של בזק) הופיע בקטלוג
 *      ולא נספר באף מונה — מספר מוצהר שסותר את הרשימה המוצגת, רק
 *      בכיוון של **חיסור**.
 *   2. `hasSpec` נכתב שלוש פעמים בקטלוג (`catalog.ts`, `format.ts`,
 *      `savings.ts`) וחסר ב-`config.ts`, שם `pkg.spec as HomeSpec`
 *      היא הצהרה לקומפיילר ולא בדיקה בזמן ריצה.
 */

/** רשומת בית סינתטית מינימלית שעוברת את `isListable`. */
function homePkg(id, spec, extra = {}) {
  return {
    id,
    slug: `s${id}`,
    category: "home",
    categoryHe: "אינטרנט וטלוויזיה",
    name: `חבילה ${id}`,
    type: null,
    badges: [],
    recommended: false,
    provider: { slug: "bezeq", name: "בזק", logo: "bezeq.png", raw: null },
    description: null,
    benefits: null,
    crmOrderUrl: "",
    priceAfterPromoNote: null,
    priceModel: "monthly",
    price: 49.9,
    priceAfterPromo: null,
    spec,
    ...extra,
  };
}

/* ── 1. אין חבילה שהדף מציג ואף אריח אינו מצהיר עליה ──────────────── */

test("phoneCount סופר את חבילות הבית שכוללות קו טלפון", () => {
  const n = phoneCount(basePackages());
  assert.equal(typeof n, "number");
  assert.ok(n > 0, "הקטלוג של היום מכיל חבילות עם קו טלפון");
});

test("כל חבילת בית שהדף מציג נספרת לפחות באריח אחד", () => {
  const shown = listable(basePackages());
  const home = shown.filter((p) => p.category === "home");
  const uncovered = home.filter((p) => {
    if (!hasSpec(p)) return false; // `serviceCounts` ממילא פוסלת spec לא קריא
    const internet = p.spec.hasInternet === true && p.type !== "TV";
    return !internet && p.spec.hasTv !== true && p.spec.hasPhone !== true;
  });
  assert.deepEqual(
    uncovered.map((p) => p.id),
    [],
    "חבילה שמוצגת בקטלוג וחסרה מכל אריחי 'מה אנחנו משווקים'",
  );
});

test("id 83 — קו הטלפון של בזק — נספר באריח קו הטלפון", () => {
  const shown = listable(basePackages());
  const p83 = shown.find((p) => p.id === "83");
  assert.ok(p83, "id 83 חייב להישאר בקטלוג כדי שהבדיקה תהיה משמעותית");
  assert.equal(p83.spec.hasPhone, true);
  assert.equal(p83.spec.hasInternet, false);
  assert.equal(p83.spec.hasTv, false);
  // זו הרשומה שהפילה את הזהות הזאת: 55 + 29 + 16 + 13 + 18 כיסו 105 מ-106.
  assert.equal(phoneCount([p83]), 1);
});

test("אריחי הקטגוריה מכסים בדיוק את מה שהקטלוג מציג", () => {
  const base = basePackages();
  const shown = listable(base);
  const counts = listableCounts(base);
  const services = serviceCounts(shown);
  assert.equal(counts.cellular + counts.home + counts.electricity, shown.length);
  assert.equal(services.cellular, counts.cellular);
  assert.equal(services.electricity, counts.electricity);
});

/* ── 2. אותם שערים שהאחים כבר קיבלו, על `hasPhone` ────────────────── */

test("hasPhone נספר ב-=== true בלבד", () => {
  // "false" כמחרוזת הוא אמת ב-JS — הצורה שהמחלץ מייצר כשהוא קורא שדה
  // טקסטואלי. זה אותו שער ש-`hasInternet`/`hasTv` כבר נושאים.
  assert.equal(
    phoneCount([
      homePkg("t1", { hasInternet: false, hasTv: false, hasPhone: "false" }),
      homePkg("t2", { hasInternet: false, hasTv: false, hasPhone: 1 }),
    ]),
    0,
  );
});

test("spec לא קריא אינו מפיל את המונים", () => {
  for (const spec of [null, undefined, "קו ביתי", 5, []]) {
    assert.doesNotThrow(() => serviceCounts([homePkg("t3", spec)]));
    assert.doesNotThrow(() => phoneCount([homePkg("t3", spec)]));
    assert.equal(phoneCount([homePkg("t3", spec)]), 0);
  }
});

/* ── 3. `hasSpec` הוא שער אחד שגם `config.ts` קורא ────────────────── */

test("hasSpec פוסל כל מה שאינו אובייקט קריא", () => {
  for (const spec of [null, undefined, "קו ביתי", 5, true, []]) {
    assert.equal(hasSpec(homePkg("t4", spec)), false, `spec=${JSON.stringify(spec)}`);
  }
  assert.equal(hasSpec(homePkg("t4", {})), true);
});

test("crmCategory לא שולחת חבילת סיבים ל'כללי' כש-spec אינו קריא", () => {
  // הבאג: `spec && !spec.hasInternet` — מחרוזת או מערך הם טרות'י שאין
  // בהם `hasInternet`, ולכן חבילת אינטרנט קיבלה "general" והליד נעלם
  // מהנציג שמסנן לפי אינטרנט.
  for (const spec of [null, undefined, "סיבים", [], 1, true]) {
    assert.equal(
      crmCategory(homePkg("t5", spec, { name: "פייבר 1000 מגה" })),
      "internet",
      `spec=${JSON.stringify(spec)}`,
    );
  }
});

test("crmCategory עדיין מכבדת spec קריא", () => {
  assert.equal(crmCategory(homePkg("t6", { hasInternet: true, hasTv: false })), "internet");
  assert.equal(crmCategory(homePkg("t7", { hasInternet: true, hasTv: true })), "tv");
  // קו טלפון ביתי אינו "אינטרנט" — ההכרעה המתועדת ב-`config.ts`.
  assert.equal(
    crmCategory(homePkg("t8", { hasInternet: false, hasTv: false, hasPhone: true })),
    "general",
  );
  const p83 = listable(basePackages()).find((p) => p.id === "83");
  assert.equal(crmCategory(p83), "general");
});
