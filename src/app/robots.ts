import type { MetadataRoute } from "next";

/**
 * הפריסה פרטית (גרסת בדיקה בקישור סודי) — אין שום נתיב שאמור
 * להופיע בתוצאות חיפוש. משלים את כותרת `X-Robots-Tag` ב-next.config.ts.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
