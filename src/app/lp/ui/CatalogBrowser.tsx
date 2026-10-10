"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { PackageCard } from "./PackageCard";
import { CompareTray, MAX_COMPARE } from "./CompareTray";
import { PACKAGES_CAPTION, PLANS_CAPTION, shekels } from "../catalog/format";
import { afterPrice, byPrice, electricityRank, hasKnownAfterPrice } from "../catalog/catalog";
import type { Package } from "../catalog/types";

export type SortKey = "price-asc" | "price-desc" | "after-asc" | "recommended";

/*
 * ⚠️ בחשמל אין מחיר — `byPrice` ממפה מסלול חשמל ל-`electricityRank`,
 * ולכן `price-asc` הוא בפועל "ההנחה הגדולה תחילה". התוויות
 * ה"מחיריות" הן שקר מול כרטיס שמדפיס אחוז ותו לא: הגולש שבחר
 * "מהיקר לזול" קיבל בראש הרשימה את ההנחות הקטנות ביותר. הדף כבר
 * מכיר בזה בשני מקומות אחרים — מחוון המחיר מוסתר בחשמל, וטבלת
 * ההשוואה מחליפה את תווית השורה — רק תפריט המיון נשאר מאחור.
 */
const SORTS: { key: SortKey; label: string; electricLabel?: string }[] = [
  { key: "recommended", label: "מומלצים תחילה" },
  /*
   * ⚠️ התווית אומרת את הסדר ש-`electricityRank` באמת מחזירה. היא
   * הבטיחה סדר מונוטוני לפי האחוז, וההנחה שחלה על כל החשבון מדורגת
   * לפני כל מסלול שעות — בכוונה, ראה `electricityRank` — ולכן הסדר
   * שהתקבל בפועל היה "6%, 6%, 6%, 5%, 20%, 20%…". גולש שקרא "מהגבוהה
   * לנמוכה" ראה 6% מעל 20% בלי שום הסבר על המסך.
   */
  { key: "price-asc", label: "מחיר: מהזול ליקר", electricLabel: "הנחה: על כל החשבון תחילה" },
  { key: "price-desc", label: "מחיר: מהיקר לזול", electricLabel: "הנחה: מסלולי שעות תחילה" },
  // No competitor offers this, and it is the honest way to rank a promo market.
  { key: "after-asc", label: "מחיר אחרי ההטבה: מהזול ליקר" },
];

/*
 * ⚠️ ציר ה**סינון** של מחוון המחיר בלבד — המיון עובר ב-`byPrice`.
 * הגרסה הקודמת שירתה את שניהם ושחזרה ביד את מה ש-`byPrice` עושה,
 * עם שתי ברירות המחדל שהקובץ ההוא תיקן במפורש: `?? 0` מדרג רשומת
 * חשמל פגומה כבעלת ההנחה הגדולה (כלומר ראשונה בעמוד) בזמן ש-`byPrice`
 * שולח אותה לסוף, ומיון בחיסור מחזיר `NaN` על שתי רשומות ללא מחיר
 * (`Infinity - Infinity`). שתי מחלקות הפגם האלה אינן ניתנות להגעה
 * היום (`page.tsx` מעביר `listable(...)`), ולכן זו הסרת כפילות
 * ושער לרענון הבא — לא תיקון פגם מוצג.
 *
 * ⚠️ המחוון מוסתר בחשמל, ולכן כאן אין ענף חשמל כלל: הציר הזה הוא כסף.
 */
/*
 * ⚠️ `isMoney` ולא `?? Infinity`, וזו בדיוק הבעיה שההערה למעלה מצהירה
 * שתוקנה ואז נשארה חצי. `catalog.ts` מרכז את ההגדרה של "מספר שמותר
 * לדרג לפיו" כדי שכל קוראי שדה המחיר יסכימו — `isListable`, `afterPrice`
 * ו-`byPrice` עוברים בה — אבל היא אינה מיוצאת משם, ולכן היא נאמרת כאן
 * במפורש (בדיוק כמו `afterPriceKnown` ב-`CompareTray`). `?? Infinity`
 * מכסה `null` לבדו: `price: 0` — הצורה שהמחלץ מייצר כשלא קרא מחיר,
 * ids 18/22 בקטלוג של היום — היה מוריד את קצה המחוון ל-₪0, מופיע
 * במוני השבבים, ונכנס לתוצאות של כל ערך מחוון, בעוד `byPrice` שולחת
 * אותו לסוף הרשימה. שתי קריאות הפוכות לאותו שדה בשני פקדים שיושבים
 * זה מעל זה.
 */
function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function sliderPrice(p: Package): number {
  return isMoney(p.price) ? p.price : Infinity;
}

/**
 * האם ל-`byPrice` יש בכלל מה לדרג ברשומה — או שהיא מקבלת `Infinity`.
 *
 * ⚠️ נדרש כדי שהמיון היורד לא יהיה היפוך עיוור של `byPrice`. `byPrice`
 * שולחת רשומה שאין בה מחיר שמיש לסוף הרשימה **בכוונה** (ההערה שם
 * מתארת את זה כ"שער שכל תפקידו"), והיפוך הקומפרטור הפך בדיוק את
 * השער הזה: `sorted.sort((a, b) => byPrice(b, a))` היה מעלה את אותן
 * רשומות ל**ראש** העמוד, כלומר "מחיר: מהיקר לזול" פותח בחבילות
 * שהמחיר שלהן לא נקרא. אותו דפוס בדיוק ש-`byAfterPrice` מתחת כבר
 * מיישמת (לא-ידוע תמיד בסוף, בשני הכיוונים).
 */
function priceRankable(p: Package): boolean {
  return p.category === "electricity"
    ? Number.isFinite(electricityRank(p))
    : isMoney(p.price);
}

function byPriceDesc(a: Package, b: Package): number {
  const ra = priceRankable(a);
  const rb = priceRankable(b);
  if (ra !== rb) return ra ? -1 : 1;
  return byPrice(b, a);
}

/*
 * ⚠️ המיון "מחיר אחרי ההטבה" אינו יכול לדרג חבילה שלא ידוע מה יעלה
 * אחרי ההטבה. `afterPrice` נופלת ל-`price` כשאין `priceAfterPromo`,
 * ולכן 11 החבילות שמצהירות על העלייה **בטקסט חופשי בלבד** דורגו לפי
 * מחיר ההטבה תחת תווית שמבטיחה את ההפוך: id 23 ("כשר") עמד ראשון
 * ב-₪25 בזמן שהכרטיס שלו מדפיס "לאחר מכן 59 ₪". זה בדיוק הפגם שתוקן
 * כבר בטבלת ההשוואה (`priceAfterPromoNote` נקרא שם לצד השדה המספרי)
 * ושנותר כאן.
 *
 * ⚠️ לא מנחשים את המספר מההערה — הנוסח חופשי לגמרי ("+ 10 ₪ נתב",
 * "מ-100 ₪"), וזו הסיבה ש-`hasKnownAfterPrice` קיימת ולא פרסר. חבילה
 * כזו יורדת לסוף הרשימה, שם היא מדורגת לפי המחיר של היום; הכרטיס
 * עצמו ממילא מדפיס את ההערה, ולכן הקורא רואה למה.
 */
function byAfterPrice(a: Package, b: Package): number {
  const ka = hasKnownAfterPrice(a);
  const kb = hasKnownAfterPrice(b);
  if (ka !== kb) return ka ? -1 : 1;
  // ⚠️ השוואה ולא חיסור, מאותו טעם שכתוב ב-`byPrice`: `afterPrice`
  // מחזירה `Infinity` לרשומה בלי מחיר שמיש, ו-`Infinity - Infinity`
  // הוא `NaN` — קומפרטור שמחזיר NaN נותן סדר שתלוי בסדר הקלט.
  if (!ka) return byPrice(a, b);
  const va = afterPrice(a);
  const vb = afterPrice(b);
  return va === vb ? 0 : va < vb ? -1 : 1;
}

/** המצב שהגולש בנה בעמודה הצדדית. */
export interface CatalogFilters {
  providers: string[];
  types: string[];
  maxPrice: number | null;
}

/**
 * הפרדיקט של הסינון — **אחד**.
 *
 * ⚠️ הוא היה כתוב שלוש פעמים: בתוצאות, במוני החברות (בלי ציר החברה)
 * ובמוני הסוגים (בלי ציר הסוג). שלוש העתקות של אותו תנאי הן בדיוק
 * הצורה שבה מונה מפסיק להסכים עם הרשימה שמתחתיו — וזה כבר קרה כאן
 * פעמיים (מסנן החברה ואז מסנן הסוג שנעלמו עם המסנן הפעיל שבתוכם).
 * `except` מנטרל ציר אחד, וזו כל ההגדרה של "כמה תוצאות האפשרות הזו
 * מוסיפה".
 */
export function matchesFilters(
  p: Package,
  f: CatalogFilters,
  except?: keyof CatalogFilters,
): boolean {
  if (except !== "providers" && f.providers.length > 0 && !f.providers.includes(p.provider.slug)) {
    return false;
  }
  if (except !== "types" && f.types.length > 0 && !(p.type != null && f.types.includes(p.type))) {
    return false;
  }
  if (except !== "maxPrice" && f.maxPrice != null && sliderPrice(p) > f.maxPrice) return false;
  return true;
}

export function priceBoundsOf(packages: Package[]): { min: number; max: number } | null {
  const values = packages.map(sliderPrice).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  /*
   * ⚠️ `Math.ceil` על הקצה התחתון, לא `Math.floor`.
   *
   * המסנן הוא `price <= maxPrice` וה-`step` הוא 1, ולכן הקצה התחתון
   * חייב להיות מחיר שחבילה אחת לפחות **עומדת בו**. החבילה הזולה
   * בסלולר היא 21.9 ובביתי 19.9: עיגול למטה נתן 21 ו-19, ושני הקצאות
   * האלה החזירו "אין חבילות שמתאימות לסינון" — כלומר המחוון נגמר
   * במקום שבו הדף ריק תמיד. עיגול למעלה מגיע ל-22 ול-20, שם
   * החבילה הזולה באמת נמצאת.
   */
  return { min: Math.ceil(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
}

/**
 * Counts are computed against the *other* active filters, so each option
 * shows how many results it would actually add — the SmartCut pattern.
 */
/*
  ⚠️ חברה **מסומנת** נשארת ברשימה גם כשהמונה שלה 0. הרשימה
  מחושבת אחרי מסנני הסוג והמחיר, ולכן חברה שאין לה תוצאה בצירוף
  הנוכחי נעלמה מהמסך — אבל ה-slug שלה נשאר ב-`filters.providers`
  והמשיך לסנן. הגולש קיבל "0 חבילות", תג סינון שמראה 2,
  ושום תיבת סימון לבטל — המוצא היחיד היה "נקה הכל", שמוחק
  גם את מסנן הסוג. מסנן פעיל חייב להיות ניתן לביטול.
*/
export function providerFacets(packages: Package[], f: CatalogFilters) {
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const p of packages) {
    const passes = matchesFilters(p, f, "providers");
    if (!passes && !f.providers.includes(p.provider.slug)) continue;
    const entry =
      map.get(p.provider.slug) ?? { slug: p.provider.slug, name: p.provider.name, count: 0 };
    if (passes) entry.count++;
    map.set(p.provider.slug, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/* אותו דבר לשבבי הסוג: סוג מסומן נשאר ברשימה כדי שאפשר לבטל אותו. */
export function typeFacets(packages: Package[], f: CatalogFilters): [string, number][] {
  const map = new Map<string, number>();
  for (const p of packages) {
    if (!p.type) continue;
    const passes = matchesFilters(p, f, "types");
    if (!passes && !f.types.includes(p.type)) continue;
    map.set(p.type, (map.get(p.type) ?? 0) + (passes ? 1 : 0));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function sortCatalog(packages: Package[], sort: SortKey): Package[] {
  const sorted = [...packages];
  if (sort === "price-asc") sorted.sort(byPrice);
  else if (sort === "price-desc") sorted.sort(byPriceDesc);
  else if (sort === "after-asc") sorted.sort(byAfterPrice);
  else sorted.sort((a, b) => Number(b.recommended) - Number(a.recommended) || byPrice(a, b));
  return sorted;
}

export function catalogResults(
  packages: Package[],
  f: CatalogFilters,
  sort: SortKey,
): Package[] {
  return sortCatalog(
    packages.filter((p) => matchesFilters(p, f)),
    sort,
  );
}

export function CatalogBrowser({ packages, category }: { packages: Package[]; category: string }) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [compare, setCompare] = useState<Package[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isElectric = category === "electricity";

  const filters = useMemo<CatalogFilters>(
    () => ({ providers: selectedProviders, types: selectedTypes, maxPrice }),
    [selectedProviders, selectedTypes, maxPrice],
  );

  const priceBounds = useMemo(() => priceBoundsOf(packages), [packages]);
  const providerOptions = useMemo(() => providerFacets(packages, filters), [packages, filters]);
  const typeOptions = useMemo(() => typeFacets(packages, filters), [packages, filters]);
  const results = useMemo(() => catalogResults(packages, filters, sort), [packages, filters, sort]);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const toggleCompare = (pkg: Package) =>
    setCompare((prev) =>
      prev.some((p) => p.id === pkg.id)
        ? prev.filter((p) => p.id !== pkg.id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, pkg],
    );

  /*
   * ⚠️ בחירה להשוואה שורדת סינון שמוציא אותה מהתוצאות — וזה נכון,
   * אחרת כל נגיעה במסנן הייתה מוחקת את מה שהגולש בחר. אבל `compareFull`
   * נגזר מהבחירה הגולמית, ו-`PackageCard` חוסם כל תיבה שאינה מסומנת
   * כשהמגש מלא: מי שסימן ארבע חבילות של גולן ואז סינן לפלאפון קיבל
   * מסך שבו **כל** התיבות אפורות ומכריזות "ניתן להשוות עד 4 חבילות",
   * ואף כרטיס על המסך אינו מסומן. ההודעה נכונה והמסך נראה שבור.
   *
   * המונה הזה אומר כמה מהבחירות מוסתרות, כך שהסיבה נמצאת באותה שורה
   * שבה נמצאת התוצאה — ולא רק כשבבים במגש שמרחף בתחתית המסך.
   */
  const hiddenCompare = compare.filter((p) => !results.some((r) => r.id === p.id)).length;

  const activeFilters =
    selectedProviders.length + selectedTypes.length + (maxPrice != null ? 1 : 0);
  const hasFilters = activeFilters > 0;

  /*
   * ⚠️ המונה שעל כל אפשרות נאמר בשם הנגיש במפורש, ולא נשאר כ-`<span>`
   * צמוד. חישוב השם הנגיש משרשר את טקסט הילדים **בלי** להוסיף רווח
   * כשאין רווח ב-DOM, ולכן תיבת הסימון של גולן הכריזה "גולן טלקום18"
   * ולשונית הסלולר "סלולר55" — מספר שנדבק למילה ונקרא כמלמול אחד.
   * שבבי הסוג דווקא כן הפרידו (`{type} <span>`), כלומר אותו נתון
   * הוכרז בשלוש צורות בשלושה פקדים שיושבים זה מעל זה.
   *
   * ⚠️ והמונה גם אומר **מה** הוא מונה. "18" לבדו אינו מידע, והמילה
   * מגיעה מאותם `PACKAGES_CAPTION`/`PLANS_CAPTION` שכבר נבחרים לפי
   * הקטגוריה בשורת התוצאות — כולל צורת היחיד ("1 חבילה", הסוג "בסיס").
   */
  const countLabel = (n: number) =>
    `${n} ${(isElectric ? PLANS_CAPTION : PACKAGES_CAPTION)(n)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 lg:mb-3">
            {/*
              ⚠️ מקופל בנייד, פרוש בדסקטופ.

              בדסקטופ זו עמודה צדדית ליד התוצאות, אבל בנייד ה-grid קורס
              לעמודה אחת והפאנל נפרס כבלוק מלא **מעל** הקטלוג: רשימת כל
              החברות, שבבי הסוג ומחוון המחיר: מסך שלם של פקדים לפני שרואים
              חבילה אחת.

              ⚠️ `useState(false)` ולא `useIsNarrow()`. הספק ש-`useIsNarrow`
              קורא (`InitialNarrowProvider`) יושב ב-layout של `(app)`, והדף
              הזה מחוץ לקבוצה: הערך בשרת היה תמיד `false`, כלומר הפאנל היה
              נפרס בטלפון ונסגר בהידרציה. כאן הסגירה היא מצב התחלתי אמיתי
              והדסקטופ נפתח דרך CSS בלבד (`max-lg:hidden`), ולכן אין פער
              בין השרת ללקוח ואין הבהוב.
            */}
            {/*
              ⚠️ `lg:hidden` על הכפתור וכותרת נפרדת לדסקטופ, ולא
              `lg:pointer-events-none` על אותו כפתור. `pointer-events` מנטרל
              את העכבר בלבד: בדסקטופ הכפתור נשאר בסדר ה-Tab, הכריז על עצמו
              `aria-expanded="false"` בזמן שהפאנל פרוש ונראה במלואו, ולחיצה
              ממקלדת הפכה אותו ל-"true" בלי שדבר על המסך ישתנה. פקד שמצהיר
              על מצב שאינו נכון ואינו עושה דבר גרוע מפקד שאינו קיים.
            */}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="lp-filters"
              className="-my-2 flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-lp-ink lg:hidden"
            >
              סינון
              {hasFilters && (
                <span className="nums rounded-full bg-lp-brand px-2 py-0.5 text-lp-2xs font-bold text-lp-ink-invert">
                  {activeFilters}
                </span>
              )}
              <span
                aria-hidden
                className={`text-lp-ink-3 transition ${filtersOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
            <span className="hidden items-center gap-2 text-sm font-semibold text-lp-ink lg:flex">
              סינון
              {hasFilters && (
                <span className="nums rounded-full bg-lp-brand px-2 py-0.5 text-lp-2xs font-bold text-lp-ink-invert">
                  {activeFilters}
                </span>
              )}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProviders([]);
                  setSelectedTypes([]);
                  setMaxPrice(null);
                }}
                className="-my-2 flex min-h-11 items-center py-2 text-xs text-lp-brand hover:underline lg:my-0 lg:min-h-0 lg:py-0"
              >
                נקה הכל
              </button>
            )}
          </div>

          <div id="lp-filters" className={filtersOpen ? "mt-3" : "max-lg:hidden"}>
            <fieldset className="mb-4">
              <legend className="mb-2 text-xs font-medium text-lp-ink-2">חברה</legend>
              <div className="space-y-1.5">
                {providerOptions.map((o) => (
                  <label key={o.slug} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(o.slug)}
                      onChange={() => toggle(selectedProviders, o.slug, setSelectedProviders)}
                      aria-label={`${o.name} — ${countLabel(o.count)}`}
                      className="h-4 w-4 accent-lp-brand"
                    />
                    <span className="flex-1 text-lp-ink">{o.name}</span>
                    <span className="nums text-xs text-lp-ink-3">{o.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/*
              ⚠️ התנאי בודק גם `selectedTypes` ולא רק את מספר האפשרויות.
              ה-memo למעלה כבר משאיר סוג מסומן ברשימה גם כשהמונה שלו 0,
              אבל שער של `> 1` בלבד זרק את העבודה הזו: ברגע שמסנן אחר
              צמצם את התוצאות לסוג יחיד, כל ה-fieldset נעלם מה-DOM יחד
              עם השבב הפעיל. הגולש ראה תג סינון שמראה 2, תוצאות מסוננות,
              ושום שבב לבטל — בדיוק התקלה שהערה על מסנן החברה מתארת.
              מסנן פעיל חייב להיות ניתן לביטול.
            */}
            {(typeOptions.length > 1 || selectedTypes.length > 0) && (
              <fieldset className="mb-4">
                <legend className="mb-2 text-xs font-medium text-lp-ink-2">סוג</legend>
                <div className="flex flex-wrap gap-1.5">
                  {typeOptions.map(([type, count]) => {
                    const active = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${type} — ${countLabel(count)}`}
                        onClick={() => toggle(selectedTypes, type, setSelectedTypes)}
                        className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? "border-lp-brand bg-lp-brand text-lp-ink-invert"
                            : "border-lp-line bg-lp-surface text-lp-ink-2 hover:border-lp-brand"
                        }`}
                      >
                        {type} <span className="nums opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {priceBounds && !isElectric && (
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-lp-ink-2">
                  מחיר עד{" "}
                  <span className="nums font-semibold text-lp-ink">
                    {shekels(maxPrice ?? priceBounds.max)}
                  </span>
                </legend>
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={1}
                  value={maxPrice ?? priceBounds.max}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMaxPrice(v >= priceBounds.max ? null : v);
                  }}
                  className="w-full accent-lp-brand"
                  aria-label="מחיר מקסימלי"
                />
                <div className="nums mt-1 flex justify-between text-lp-2xs text-lp-ink-3">
                  <span>{shekels(priceBounds.min)}</span>
                  <span>{shekels(priceBounds.max)}</span>
                </div>
              </fieldset>
            )}
          </div>
        </Card>
      </aside>

      {/*
        הריפוד שמפנה מקום למגש ההשוואה עבר לשורש הדף (`lp-tray-open`
        ב-`lp.css`, מסומן ע"י `CompareTray`). כאן הוא כיסה את עמודת
        התוצאות בלבד והשאיר את הפוטר מתחת לסרגל.
      */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/*
            ⚠️ `aria-live` על המונה. סימון תיבת חברה או שבב סוג משאיר את
            הפוקוס על הפקד ומחליף את הרשת שמתחתיו בלי מילה אחת: גולש
            קורא-מסך שסימן "גולן" לא שמע ש-55 הפכו ל-18, כלומר אין שום
            אישור שהמסנן בכלל נקלט. מיון אינו משנה את הטקסט ולכן אינו
            מכריז דבר.

            ⚠️ והכיתוב ביחיד וברבים — ראה `PACKAGES_CAPTION`.

            ⚠️ ובחשמל אלה **מסלולים**. רצועת השירותים ב-`page.tsx` קוראת
            לאותן 18 רשומות `PLANS_CAPTION`, והשורה הזו קראה להן "חבילות"
            — שתי תצוגות של אותו נתון, בשני שמות, באותו מסך.
          */}
          <p className="text-sm text-lp-ink-2" aria-live="polite">
            <span className="nums font-semibold text-lp-ink">{results.length}</span>{" "}
            {(isElectric ? PLANS_CAPTION : PACKAGES_CAPTION)(results.length)}
            {hasFilters && (
              <span className="nums text-lp-ink-3"> מתוך {packages.length}</span>
            )}
            {hiddenCompare > 0 && (
              <span className="nums text-lp-ink-3">
                {" "}
                · {hiddenCompare} מההשוואה {hiddenCompare === 1 ? "מוסתרת" : "מוסתרות"} בסינון
              </span>
            )}
          </p>
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-lp-ink-2">מיון</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="max-w-full min-w-0 rounded-lg border border-lp-line bg-lp-surface px-2 py-1.5 text-sm transition focus:border-lp-brand"
            >
              {SORTS.filter((s) => !(isElectric && s.key === "after-asc")).map((s) => (
                <option key={s.key} value={s.key}>
                  {isElectric ? (s.electricLabel ?? s.label) : s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {results.length === 0 ? (
          <p className="rounded-lp-card border border-lp-line bg-lp-surface p-8 text-center text-sm text-lp-ink-2">
            {isElectric ? "אין מסלולים שמתאימים לסינון." : "אין חבילות שמתאימות לסינון."} נסו
            להסיר חלק מהמסננים.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                compareChecked={compare.some((p) => p.id === pkg.id)}
                compareFull={compare.length >= MAX_COMPARE}
                onCompareToggle={toggleCompare}
              />
            ))}
          </div>
        )}
      </div>

      <CompareTray items={compare} onRemove={toggleCompare} onClear={() => setCompare([])} max={MAX_COMPARE} />
    </div>
  );
}
