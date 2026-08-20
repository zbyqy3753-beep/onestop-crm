import type { LeadCategoryKey } from "@/lib/domain/types";

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

/** ברירת המחדל לערך שנרשם בעמודת "מקור" של כל ליד מהדף. */
export const DEFAULT_SOURCE_DETAIL = "האתר של אלירן";

/** ברירת המחדל לנמען — המייל של אלירן ב-CRM. */
export const DEFAULT_ASSIGNEE_EMAIL = "aliran@onestop.co.il";
