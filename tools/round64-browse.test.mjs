import assert from "node:assert/strict";
import Module from "node:module";
import { test } from "node:test";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף — ראה `lpBrowse.test.mjs` לנימוק
 * המלא (מודול `"use server"` עם `await` ברמת המודול, ש-tsx אינו יכול
 * לקמפל ל-CJS; שרשרת הייבוא היא `CatalogBrowser → PackageCard →
 * LeadForm → ../actions`).
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { basePackages, byCategory, listable } = await import("../src/app/lp/catalog/catalog.ts");
const { matchesFilters, priceBoundsOf } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

const ALL = listable(basePackages());

/*
 * סבב 64, `CatalogBrowser.tsx`. תקרת המחיר לא יושבה מול הטווח שנמדד
 * אחרי שאר המסננים — `priceCap` סגר את הצד העליון בלבד, ו-`filters`
 * המשיך לשאת את המספר הגולמי. שלוש צורות, כולן גומרות ב-0 תוצאות על
 * דף שהגולש אינו יכול לתקן. ראה `effectiveMaxPrice`.
 */

/** אותה גזירה שבקומפוננטה, על הרשימה והמסננים שנמסרו. */
function derive(pkgs, f) {
  const bounds = priceBoundsOf(pkgs.filter((p) => matchesFilters(p, f, "maxPrice")));
  let cap = null;
  if (f.maxPrice != null && bounds != null) {
    const clamped = Math.max(f.maxPrice, bounds.min);
    cap = clamped >= bounds.max ? null : clamped;
  }
  const rendered = bounds != null && bounds.max > bounds.min;
  const results = pkgs.filter((p) => matchesFilters(p, { ...f, maxPrice: cap }));
  return { bounds, cap, rendered, results };
}

test("סבב 64: תקרה שנפלה מתחת לטווח נצמדת לקצה התחתון ולא מרוקנת את הדף", () => {
  /*
   * `בית` + שבב "HOT" (קצוות ₪99–₪199) עם תקרה ₪59 שנבחרה לפני השבב.
   * לפני התיקון: המחוון מרונדר עם `min=99` ו-`value=59`, הדפדפן מצמיד
   * את הידית ל-99 בזמן שהכותרת ו-`aria-valuetext` מכריזים ₪59, ושתי
   * תוויות הקצה מדפיסות ₪99 ו-₪199 — שלושה מספרים על פקד אחד, ומתחתם
   * אפס תוצאות.
   */
  const home = byCategory(ALL, "home");
  const f = { providers: ["hot"], types: [], maxPrice: 59 };
  const { bounds, cap, rendered, results } = derive(home, f);

  assert.deepEqual(
    { min: bounds.min, max: bounds.max },
    { min: 99, max: 199 },
    "הטווח של HOT בבית זז — התרחיש אינו מה שתועד",
  );
  assert.ok(rendered, "המחוון אמור להיות מרונדר בטווח הזה");
  assert.equal(cap, bounds.min, "התקרה חייבת להיצמד לקצה התחתון, שם הידית באמת יושבת");
  assert.ok(results.length > 0, "תקרה מיושבת חייבת להשאיר חבילה אחת לפחות");
  assert.deepEqual(
    results.map((p) => String(p.id)),
    ["153"],
    "תקרה ב-99 מחזירה את החבילה הזולה של HOT",
  );
});

test("סבב 64: תקרה שאינה חותכת דבר אינה מסנן, וגם לא תג", () => {
  /*
   * `סלולר` + שבב "בסיס" משאיר את id 15 לבדה ב-₪29, כלומר
   * `max === min` והמחוון כולו יורד. לפני התיקון נשאר אילוץ פעיל על
   * הדף בלי שום פקד לבטל אותו: תג שמראה 2 ואפס תוצאות.
   */
  const cellular = byCategory(ALL, "cellular");
  const f = { providers: [], types: ["בסיס"], maxPrice: 22 };
  const { bounds, cap, rendered, results } = derive(cellular, f);

  assert.equal(bounds.max, bounds.min, "התרחיש דורש טווח שקצהו אחד — השתנה הנתון");
  assert.equal(rendered, false, "מחוון שקצהו התחתון שווה לעליון אינו מרונדר");
  assert.equal(cap, null, "אין פקד על המסך — אין תקרה");

  const badge = f.providers.length + f.types.length + (cap != null ? 1 : 0);
  assert.equal(badge, 1, "התג סופר את שבב הסוג בלבד");
  assert.deepEqual(results.map((p) => String(p.id)), ["15"], "החבילה היחידה בטווח חוזרת למסך");
});

test("סבב 64: אין טווח למדוד ממנו — אין תקרה", () => {
  /*
   * הצורה השלישית, שהבדיקה המתוקנת ב-`lpBrowse.test.mjs` העלתה:
   * `סלולר` + "הוט מובייל" + "בסיס" אינו משאיר אף רשומה, ולכן
   * `priceBounds` הוא `null` — ואז הגזירה החזירה את התקרה הגולמית,
   * שהמשיכה לסנן ולהיספר בתג בזמן שהפקד אינו קיים.
   */
  const cellular = byCategory(ALL, "cellular");
  const f = { providers: ["hot-mobile"], types: ["בסיס"], maxPrice: 30 };
  const { bounds, cap, rendered } = derive(cellular, f);

  assert.equal(bounds, null, "התרחיש דורש צירוף בלי אף רשומה");
  assert.equal(rendered, false, "בלי טווח אין מחוון");
  assert.equal(cap, null, "בלי ציר מחיר על המסך אין תקרה");
});

test("סבב 64: תקרה מעל הקצה החדש נקראת כ'בלי תקרה' — וכך גם בתג", () => {
  /*
   * הצד שההערה המקורית סגרה, עם התוספת היחידה שזזה על המסך: התג.
   * `סלולר` + "כשר" (קצה חדש ₪39) עם תקרה ₪40 — התג ירד מ-2 ל-1,
   * כי תקרה שאינה חותכת דבר אינה פקד שיש מה לבטל בו.
   */
  const cellular = byCategory(ALL, "cellular");
  const f = { providers: [], types: ["כשר"], maxPrice: 40 };
  const { bounds, cap, results } = derive(cellular, f);

  assert.ok(f.maxPrice > bounds.max, "התרחיש דורש תקרה מעל הקצה המסונן");
  assert.equal(cap, null, "תקרה שאינה חותכת דבר שקולה לאין-תקרה");
  assert.equal(f.providers.length + f.types.length + (cap != null ? 1 : 0), 1, "התג סופר 1");
  assert.equal(results.length, 8, "כל שמונה החבילות הכשרות נשארות על המסך");
});

test("סבב 64: תקרה שבתוך הטווח נשארת בדיוק כפי שנבחרה", () => {
  /* השער אינו נוגע במצב התקין — זו המחצית השנייה של 'אין תזוזה'. */
  const home = byCategory(ALL, "home");
  const f = { providers: ["hot"], types: [], maxPrice: 120 };
  const { cap, results } = derive(home, f);

  assert.equal(cap, 120, "תקרה בתוך הטווח אינה מוצמדת ואינה מאופסת");
  assert.deepEqual(
    results.map((p) => String(p.id)).sort(),
    ["153", "154", "70", "73"],
    "אותן ארבע חבילות שהתקרה הזו החזירה לפני התיקון",
  );
});

test("סבב 64: הגזירה אינה מאפסת את הבחירה — הסרת השבב מחזירה את התקרה", () => {
  /*
   * ⚠️ הכוונה נשמרת. התקרה **נגזרת** ולא נמחקת, ולכן גולש שסימן שבב
   * שהפיל את התקרה מחוץ לטווח ואז הסיר אותו מקבל את התקרה שבחר.
   */
  const home = byCategory(ALL, "home");
  const withChip = derive(home, { providers: ["hot"], types: [], maxPrice: 59 });
  const withoutChip = derive(home, { providers: [], types: [], maxPrice: 59 });

  assert.equal(withChip.cap, 99, "עם השבב התקרה מוצמדת לקצה התחתון שלו");
  assert.equal(withoutChip.cap, 59, "בלי השבב התקרה שהגולש בחר חוזרת כמות שהיא");
  assert.ok(withoutChip.results.length > 0, "ובטווח המלא היא חותכת ומשאירה תוצאות");
});
