import type { LeadCategoryKey } from "@/lib/domain/types";
import type { Package } from "./catalog/types";

/**
 * הגדרות דף הנחיתה הציבורי (`/lp`).
 *
 * הקובץ משותף לשרת ולקליינט בכוונה — הרשימה שהטופס מצייר והרשימה
 * שהשרת מאמת מולה חייבות להיות אותו מערך. שתי רשימות נפרדות היו
 * נפרדות בשקט ברגע שמישהו מוסיף קטגוריה לטופס.
 */

/** הקטגוריות שהדף מציע — תת-קבוצה סגורה של `LEAD_CATEGORY_CONFIG`. */
export const LANDING_CATEGORIES: readonly {
  key: LeadCategoryKey;
  label: string;
  icon: string;
}[] = [
  { key: "mobile", label: "סלולר", icon: "📱" },
  { key: "internet", label: "אינטרנט וסיבים", icon: "🌐" },
  { key: "tv", label: "טלוויזיה", icon: "📺" },
  { key: "electricity", label: "חשמל", icon: "⚡" },
  { key: "general", label: "כללי", icon: "✦" },
];

/**
 * קטגוריית הקטלוג → קטגוריית הליד ב-CRM.
 *
 * ⚠️ שני מודלים שונים שנפגשים כאן. בקטלוג `home` הוא דלי אחד לסיבים,
 * לטלוויזיה ולטריפל; ב-CRM אלה שלוש קטגוריות נפרדות, וההבדל ביניהן
 * הוא ההבדל בין שתי שיחות מכירה. לכן `home` נפתח לפי `type` של החבילה
 * במקום ליפול תמיד ל"אינטרנט".
 *
 * הערך נשלח מהדפדפן ולכן אינו נאמן בפני עצמו — `actions.ts` מאמת אותו
 * מול הרשימה הסגורה שלמעלה, בדיוק כמו כל שדה אחר בטופס.
 */
export function crmCategory(pkg: Package): LeadCategoryKey {
  if (pkg.category === "electricity") return "electricity";
  if (pkg.category === "cellular") return "mobile";

  const text = `${pkg.type ?? ""} ${pkg.name}`;
  if (text.includes("טריפל")) return "tv";
  if (text.includes("טלוויזיה") || text.includes("TV")) return "tv";
  return "internet";
}

/** ברירת המחדל לערך שנרשם בעמודת "מקור" של כל ליד מהדף. */
export const DEFAULT_SOURCE_DETAIL = "האתר של אלירן";

/**
 * ברירת המחדל לנמען — המייל של אלירן ב-CRM.
 *
 * ⚠️ כאן ישב `aliran@onestop.co.il`, כתובת שאינה קיימת: המייל האמיתי
 * הוא `eliranklein@`. התוצאה הייתה כשל שקט לגמרי — `getByEmail`
 * החזיר null, הליד נשמר בלי שיוך, ואיש לא ראה שגיאה. אותה טעות בדיוק
 * ישבה גם ב-LEADS_API_PARTNER_ASSIGNEE בייצור.
 */
export const DEFAULT_ASSIGNEE_EMAIL = "eliranklein@onestop.co.il";
