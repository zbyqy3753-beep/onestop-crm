import catalogJson from "./packages.json";
import type { Catalog, Category, HomeSpec, Package, Provider } from "./types";

/**
 * ── הקטלוג של דף הנחיתה ────────────────────────────────────────────────
 *
 * ⚠️ **עותק.** המקור הוא פרויקט האתר הציבורי (`onestop-site`), שם
 * `data/packages.json` נשאב מ-`crm.onestopil.co` בכלי נפרד. הקובץ הועתק
 * לכאן במודע כדי שדף הנחיתה יחיה על הדומיין של ה-CRM בלי תלות באתר —
 * וזה אומר שרענון קטלוג צריך לקרות **בשני המקומות**.
 *
 * ⚠️ **בלי שכבת העריכה.** באתר הציבורי הקטלוג ממוזג עם טבלת
 * `PackageOverride` (הסתרה, הצמדה, מחיר מתוקן) לפני שהוא מוצג. כאן אין
 * מסד כזה, ולכן מוצגת שכבת הבסיס בלבד: חבילה שהוסתרה במערכת הניהול של
 * האתר **תופיע** בדף הזה. זו התנהגות מודעת ולא באג — אבל אם מסתירים
 * חבילה שם, צריך לזכור אותה גם כאן.
 *
 * הייבוא הוא build-time ולא קריאת רשת: הקובץ משתנה רק כשמריצים את
 * מחלץ הקטלוג מחדש.
 */
export const catalog = catalogJson as unknown as Catalog;

export function basePackages(): Package[] {
  return catalog.packages;
}

/**
 * ⚠️ `hash` ולא `path`, בשונה מהאתר הציבורי.
 *
 * שם לכל קטגוריה יש עמוד משלה (`/cellular`, `/home`, `/electricity`).
 * כאן הכול עמוד אחד, והקטלוג מחליף קטגוריה בצד הלקוח — ראה
 * `CatalogTabs`, שמאזין לעוגן הזה. נתיב אמיתי כאן היה קישור מת.
 */
export const CATEGORY_META: Record<Category, { he: string; blurb: string; hash: string }> = {
  cellular: {
    he: "סלולר",
    blurb: "חבילות סלולר מכל החברות — כולל המחיר אחרי תום ההטבה",
    hash: "#cellular",
  },
  home: {
    he: "אינטרנט וטלוויזיה",
    blurb: "סיבים, טריפל, טלוויזיה וקו ביתי — מחיר, מהירות ועלות התקנה",
    hash: "#home",
  },
  electricity: {
    he: "חשמל",
    blurb: "מסלולי הנחה על חשבון החשמל, לבית ולעסק",
    hash: "#electricity",
  },
};

export const CATEGORY_ORDER: Category[] = ["cellular", "home", "electricity"];

export function byCategory(packages: Package[], category: Category): Package[] {
  return packages.filter((p) => p.category === category);
}

/**
 * חבילה שאפשר להציג. חבילת חשמל נמדדת באחוז הנחה ולא במחיר, ולכן
 * לשתיהן תנאי משלהן.
 *
 * ⚠️ `editorial?.hidden` נשמר בבדיקה למרות שאין כאן שכבת עריכה: השדה
 * קיים בטיפוס, וקובץ קטלוג שיועתק בעתיד מגרסה שכן נשמרה איתו יכובד
 * מעצמו במקום להציג בשקט חבילה שהוסתרה.
 */
export function isListable(p: Package): boolean {
  if (p.editorial?.hidden) return false;
  return p.category === "electricity" ? p.discountPercent != null : p.price != null && p.price > 0;
}

export function listable(packages: Package[]): Package[] {
  return packages.filter(isListable);
}

/**
 * ערך הדירוג של "כמה תשלמו כשההטבה נגמרת".
 *
 * ⚠️ משותף למיון ב-`CatalogBrowser` — פונקציה אחת. חשמל הוא אחוז הנחה
 * ולכן מדורג בשלילה (הנחה גדולה = "זול יותר"); חבילה שלא דיווחה על
 * עלייה שומרת על מחירה, כי הקריאה הכנה של "לא פורסמה עלייה" היא "אותו
 * מחיר" ולא "לא ידוע, לסוף הרשימה".
 */
export function afterPrice(p: Package): number {
  if (p.category === "electricity") return -(p.discountPercent ?? 0);
  return p.priceAfterPromo ?? p.price ?? Infinity;
}

/** כמה חבילות מציג הדף בפועל, לפי קטגוריה. */
export function listableCounts(packages: Package[]) {
  const shown = listable(packages);
  return {
    total: shown.length,
    cellular: shown.filter((p) => p.category === "cellular").length,
    home: shown.filter((p) => p.category === "home").length,
    electricity: shown.filter((p) => p.category === "electricity").length,
  };
}

/**
 * המספרים שמאחורי רצועת "מה אנחנו משווקים".
 *
 * ⚠️ `internet`, `tv` ו-`bundle` **חופפים בכוונה**: חבילת טריפל נספרת
 * בשלושתם, כי כל אחד מהם עונה על שאלה אחרת שהמבקר שואל ("יש לכם
 * טלוויזיה?"). לכן אין לחבר אותם — הסכום גדול מ-`home`.
 */
export function serviceCounts(packages: Package[]) {
  const shown = listable(packages);
  const home = shown.filter((p) => p.category === "home");
  const spec = (p: Package) => p.spec as HomeSpec;
  return {
    cellular: shown.filter((p) => p.category === "cellular").length,
    internet: home.filter((p) => spec(p).hasInternet).length,
    tv: home.filter((p) => spec(p).hasTv).length,
    bundle: home.filter((p) => spec(p).hasTv && spec(p).hasInternet).length,
    electricity: shown.filter((p) => p.category === "electricity").length,
  };
}

/**
 * ערך הדירוג של "כמה זה עולה היום".
 *
 * ⚠️ מסלול חשמל מדורג לפי אחוז ההנחה בסימן שלילי — כלומר **כל** מסלול
 * חשמל קטן מכל מחיר חודשי. זו הסיבה שכל מי שקורא ל-`cheapest` חייב
 * לסנן לקטגוריה קודם.
 */
export function byPrice(a: Package, b: Package): number {
  const av = a.category === "electricity" ? -(a.discountPercent ?? -Infinity) : (a.price ?? Infinity);
  const bv = b.category === "electricity" ? -(b.discountPercent ?? -Infinity) : (b.price ?? Infinity);
  return av - bv;
}

/** הזולה ביותר לפי המחיר שמוצג היום. */
export function cheapest(packages: Package[], limit = 3): Package[] {
  return listable(packages).slice().sort(byPrice).slice(0, limit);
}

/**
 * הבחירה של הדף לקטגוריה: מוצמד ידנית קודם, אחריו הדגל "מומלץ" שהגיע
 * מהחברה, ורק אז מחיר.
 *
 * ⚠️ באתר הציבורי המיון הזה מגיע משכבת העריכה (`byEditorialThen`).
 * כאן אין מסד כזה, ולכן הסדר משוחזר מהשדות שקיימים בקטלוג עצמו. אם
 * יום אחד תיכנס לכאן שכבת עריכה — זו הפונקציה שצריכה להיעלם לטובתה.
 */
export function highlights(packages: Package[], category: Category, limit = 3): Package[] {
  const rank = (p: Package) => (p.editorial?.featured ? 0 : p.recommended ? 1 : 2);
  return listable(byCategory(packages, category))
    .slice()
    .sort((a, b) => rank(a) - rank(b) || byPrice(a, b))
    .slice(0, limit);
}

/**
 * הספקים שיש להם בפועל חבילה גלויה, לפי עומק הקטלוג.
 *
 * ⚠️ המונה נספר מהרשימה שנמסרה ולא מ-`provider.count` שהגיע מהחילוץ:
 * ספק שכל חבילותיו נפלו ב-`isListable` חייב להיעלם מהרצועה, ולא
 * להישאר כלוגו שאין מאחוריו כלום.
 */
export function providers(packages: Package[]): Provider[] {
  const counts = new Map<string, number>();
  for (const p of listable(packages)) {
    counts.set(p.provider.slug, (counts.get(p.provider.slug) ?? 0) + 1);
  }

  return catalog.providers
    .filter((p) => (counts.get(p.slug) ?? 0) > 0)
    .map((p) => ({ ...p, count: counts.get(p.slug)! }))
    .sort((a, b) => b.count - a.count);
}

/** כמה חבילות מגלות את המחיר שאחרי ההטבה — נתון האמון של הדף. */
export function disclosedRiseCount(packages: Package[]): number {
  return listable(packages).filter(
    (p) =>
      p.category !== "electricity" &&
      (p.priceAfterPromo != null || p.priceAfterPromoNote != null),
  ).length;
}
