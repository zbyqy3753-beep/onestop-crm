import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * הפריסה פרטית (גרסת בדיקה בקישור סודי) — אין שום נתיב שאמור
 * להופיע בתוצאות חיפוש. משלים את כותרת `X-Robots-Tag` ב-next.config.ts.
 *
 * ⚠️ חוץ מהאתר של אלירן, שפתוח לאינדוקס — ראה ההערה ב-next.config.ts.
 * קריאת `host` הופכת את הקובץ לדינמי, וזה מכוון: אותו `robots.txt`
 * מוגש לשתי כתובות שצריכות תשובות הפוכות, וגרסה שמורה הייתה מגישה
 * לאחת מהן את התשובה של השנייה.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")?.split(":")[0];
  if (host === "eliran.onestopil.co.il") {
    return { rules: { userAgent: "*", allow: "/" } };
  }
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
