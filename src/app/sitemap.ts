import type { MetadataRoute } from "next";

/**
 * מפת האתר של האתר של אלירן — הכתובת היחידה בפריסה שפתוחה לאינדוקס
 * (ראה `robots.ts`). מוגשת ב-`eliran.onestopil.co.il/sitemap.xml` ונשלחה
 * ל-Search Console.
 *
 * ⚠️ כל דף ציבורי חדש באתר של אלירן נכנס לכאן, אחרת גוגל תגלה אותו רק
 * בדרך מקרית. דפי המערכת לא נכנסים — הם חסומים לגוגל בכוונה.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://eliran.onestopil.co.il/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
