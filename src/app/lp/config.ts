import type { LeadCategoryKey } from "@/lib/domain/types";
import { hasSpec, logicName } from "./catalog/catalog";
import type { HomeSpec, Package } from "./catalog/types";

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

  const text = `${pkg.type ?? ""} ${logicName(pkg)}`;
  if (text.includes("טריפל")) return "tv";
  if (text.includes("טלוויזיה") || text.includes("TV")) return "tv";
  /*
   * ⚠️ גם לפי ה-`spec`, ולא רק לפי המילים בשם. סטינג "STING פייבר
   * 1000מגה" היא טלוויזיה עם ממיר + אינטרנט 1000 ("חבילה מבית יס") —
   * ב-`spec` היא `hasTv && hasInternet`, אבל אין בשם ולא ב-`type`
   * ("סיבים") אף אחת מהמילים שלמעלה, ולכן הליד שלה הגיע ל-CRM
   * כ"אינטרנט" ונעלם מהנציג שמסנן לפי טלוויזיה. המחשבון הביתי בוחר
   * רק חבילות `hasTv && hasInternet` (ראה `isComparable`), כלומר בלי
   * השורה הזו כל רענון קטלוג שמעלה חבילה כזו לראש הרשימה שולח את
   * לידי המחשבון לקטגוריה הלא-נכונה. הבדיקה הטקסטואלית נשארת ראשונה
   * כי היא מפורשת יותר מדגל שהמחלץ הסיק.
   */
  /*
   * ⚠️ `hasSpec` ולא המרה בלבד. `pkg.spec as HomeSpec` היא הצהרה
   * לקומפיילר ולא בדיקה בזמן ריצה, והקטלוג נכנס דרך
   * `as unknown as Catalog` — כלומר אין ולידציה בכלל. `spec` פרימיטיבי
   * או מערך הוא טרות'י שאין בו `hasInternet`, ולכן השורה
   * `spec && !spec.hasInternet` שמתחת שלחה חבילת **סיבים** ל-`"general"`
   * (אומת: `spec: "סיבים"` ו-`spec: []` החזירו `general` במקום
   * `internet`) — ליד שהנציג שמסנן לפי אינטרנט לא רואה, בשקט מלא.
   * `hasSpec` הוא השער שכבר קיים ב-`catalog.ts` לאותה קריאה בדיוק;
   * כאן הוא פשוט לא היה מחובר.
   */
  const spec = pkg.category === "home" && hasSpec(pkg) ? (pkg.spec as HomeSpec) : null;
  /*
   * ⚠️ `hasTv` לבדו, ולא `hasTv && hasInternet`.
   *
   * התנאי הכפול נכתב בשביל סטינג (טלוויזיה + אינטרנט בלי אף מילה
   * מזהה), אבל הוא השאיר פתוח בדיוק את הכיוון ההפוך: חבילת
   * **טלוויזיה בלבד** שאין בשמה ולא ב-`type` את המילים שלמעלה נפלה
   * ל"אינטרנט". שלוש חבילות הטלוויזיה של היום נתפסות כולן על
   * `type: "TV"`, כלומר השורה הזו אינה משנה דבר בקטלוג הנוכחי — היא
   * השער לרענון הבא. חבילה שיש בה טלוויזיה היא טלוויזיה, בין אם יש
   * בה גם אינטרנט ובין אם לא.
   */
  if (spec?.hasTv) return "tv";
  /*
   * ⚠️ קו טלפון ביתי אינו "אינטרנט".
   *
   * `"internet"` כברירת מחדל לכל מה שנשאר תפס גם את id 83 ("בזק טלפון
   * - מדברים 50 דקות"), חבילה שב-`spec` שלה `hasPhone: true` ואין בה
   * לא אינטרנט ולא טלוויזיה. הליד שלה נרשם בקטגוריה "אינטרנט": הנציג
   * שמסנן לפי אינטרנט מתקשר לאדם שביקש קו טלפון, הנציג שמחפש פנייה
   * כזו לא רואה אותה, והיא נספרת בעלויות הלידים של אינטרנט. אין
   * ב-`LeadCategoryKey` קטגוריה לקו ביתי, ולכן "כללי" — שם החבילה
   * יושב ממילא בעמודה `packageName` — ולא קטגוריה שגויה.
   */
  if (spec && !spec.hasInternet) return "general";
  return "internet";
}

/**
 * פרופיל העסק של "אלירן תקשורת" בגוגל (נפתח ב-24.10.2026). אותו שם,
 * טלפון ואתר כמו בפרופיל — גוגל משווה
 * ביניהם, ופרטים שאינם זהים מחלישים את הפרופיל.
 *
 * ⚠️ `reviewUrl` ריק עד שהעסק יאומת: גוגל לא מנפיקה קישור ביקורת לפרופיל
 * שלא אומת. כשהוא ריק כפתור הדירוג בפוטר פשוט לא מוצג — לא קישור שבור.
 * אחרי האימות: "קריאת הביקורות" ← "בקשת ביקורות" בפרופיל, והקישור נכנס כאן.
 */
export const GOOGLE_BUSINESS = {
  name: "אלירן תקשורת",
  phone: "+972-52-861-1139",
  url: "https://eliran.onestopil.co.il",
  whatsappUrl: "https://wa.me/972528611139",
  instagramUrl: "https://www.instagram.com/telecom4you/",
  reviewUrl: "",
} as const;

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
