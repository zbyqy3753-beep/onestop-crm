import type { MetadataRoute } from "next";
import { basePackages, providers } from "./lp/catalog/catalog";
import { providerPath, SERVICE_PAGES, SITE_ORIGIN } from "./lp/site";

/**
 * מפת האתר של האתר של אלירן — הכתובת היחידה בפריסה שפתוחה לאינדוקס
 * (ראה `robots.ts`). מוגשת ב-`eliran.onestopil.co.il/sitemap.xml` ונשלחה
 * ל-Search Console.
 *
 * ⚠️ כל דף ציבורי חדש באתר של אלירן נכנס לכאן, אחרת גוגל תגלה אותו רק
 * בדרך מקרית. דפי המערכת לא נכנסים — הם חסומים לגוגל בכוונה. עמודי
 * החברות נבנים מאותה רשימה כמו `generateStaticParams` שלהם, כך שספק
 * חדש בקטלוג נכנס לשניהם יחד.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    ...SERVICE_PAGES.map((s) => ({
      url: `${SITE_ORIGIN}/${s.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...providers(basePackages()).map((p) => ({
      url: `${SITE_ORIGIN}${providerPath(p.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
