import catalogJson from "./packages.json";
import type { Catalog, Category, Package } from "./types";

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

export const CATEGORY_META: Record<Category, { he: string; blurb: string }> = {
  cellular: {
    he: "סלולר",
    blurb: "חבילות סלולר מכל החברות — כולל המחיר אחרי תום ההטבה",
  },
  home: {
    he: "אינטרנט וטלוויזיה",
    blurb: "סיבים, טריפל, טלוויזיה וקו ביתי — מחיר, מהירות ועלות התקנה",
  },
  electricity: {
    he: "חשמל",
    blurb: "מסלולי הנחה על חשבון החשמל, לבית ולעסק",
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

/** כמה חבילות מגלות את המחיר שאחרי ההטבה — נתון האמון של הדף. */
export function disclosedRiseCount(packages: Package[]): number {
  return listable(packages).filter(
    (p) =>
      p.category !== "electricity" &&
      (p.priceAfterPromo != null || p.priceAfterPromoNote != null),
  ).length;
}
