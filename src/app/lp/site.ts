import type { Metadata } from "next";
import type { LeadCategoryKey } from "@/lib/domain/types";
import type { Category } from "./catalog/types";

/**
 * מפת העמודים של האתר של אלירן (`eliran.onestopil.co.il`).
 *
 * ⚠️ הכתובות כאן הן הכתובות **הציבוריות**, בלי `/lp`. העמודים יושבים
 * פיזית תחת `src/app/lp/`, ו-`eliranSite` ב-`proxy.ts` משכתב אליהם —
 * לכן קישור בתוך האתר הוא `/cellular` ולא `/lp/cellular`.
 *
 * ⚠️ בלי ייבוא של הקטלוג: `proxy.ts` קורא את הקובץ הזה, ומשיכה של
 * `packages.json` לפרוקסי הייתה מכניסה את כל הקטלוג לכל בקשה.
 */

export const SITE_ORIGIN = "https://eliran.onestopil.co.il";

/**
 * עמוד שירות — תוכן עריכה לכל קטגוריה.
 *
 * ⚠️ הטקסט אומר רק מה שנכון לכל חבילה בקטגוריה, בלי מחירים ובלי
 * הבטחות על חברה מסוימת. המספרים בעמוד נשלפים מהקטלוג; משפט כאן
 * שמצטט מחיר היה מתיישן ברענון הקטלוג הבא בלי שאיש ישים לב.
 */
export interface ServicePage {
  slug: string;
  category: Category;
  /** הקטגוריה שהטופס בעמוד שולח ל-CRM. */
  lead: LeadCategoryKey;
  /** כותרת הלשונית ותוצאת החיפוש. */
  title: string;
  description: string;
  h1: string;
  intro: string[];
}

export const SERVICE_PAGES: readonly ServicePage[] = [
  {
    slug: "cellular",
    category: "cellular",
    lead: "mobile",
    title: "השוואת חבילות סלולר — כולל המחיר אחרי המבצע | אלירן תקשורת",
    description:
      "כל חבילות הסלולר של סלקום, פרטנר, פלאפון, HOT mobile, גולן ו-WeCom במקום אחד, עם המחיר שתשלמו אחרי שתקופת ההטבה נגמרת. ייעוץ אישי ללא עלות.",
    h1: "השוואת חבילות סלולר",
    intro: [
      "רוב חבילות הסלולר נמכרות במחיר מבצע לתקופה מוגבלת, ואחריה המחיר עולה — לפעמים פי שניים ויותר. לכן אני משווה כאן גם את המחיר של היום וגם את המחיר שתשלמו אחרי שההטבה נגמרת, בכל מקום שהחברה מסרה אותו.",
      "לפני שבוחרים, כדאי לבדוק כמה גלישה אתם באמת צורכים, כמה קווים יש בבית, והאם החבילה כוללת דקות לחו״ל. לא בטוחים? שלחו לי צילום של החשבונית ואחזור אליכם עם השוואה.",
    ],
  },
  {
    slug: "internet-tv",
    category: "home",
    lead: "internet",
    title: "השוואת חבילות סיבים, אינטרנט וטלוויזיה | אלירן תקשורת",
    description:
      "חבילות סיבים אופטיים, טריפל וטלוויזיה של בזק, HOT, yes, פרטנר, סלקום וסטינג — מחיר, מהירות, עלות התקנה והמחיר אחרי המבצע. ייעוץ אישי ללא עלות.",
    h1: "השוואת חבילות סיבים, אינטרנט וטלוויזיה",
    intro: [
      "בחבילה ביתית המחיר החודשי הוא רק חלק מהתמונה: יש עלות התקנה, ציוד (נתב, ממיר), התחייבות, ומחיר שעולה בתום המבצע. כאן כל חבילה מוצגת עם הנתונים האלה, כפי שהחברה מסרה אותם.",
      "מהירות גבוהה יותר לא תמיד שווה את ההפרש. אם אתם לא בטוחים מה צריך בבית — כמה מכשירים, עבודה מהבית, סטרימינג — השאירו פרטים ואעזור לבחור.",
    ],
  },
  {
    slug: "electricity",
    category: "electricity",
    lead: "electricity",
    title: "הנחה בחשבון החשמל — השוואת ספקי חשמל פרטיים | אלירן תקשורת",
    description:
      "מסלולי הנחה על חשבון החשמל של סלקום, HOT אנרג'י ובזק אנרג'י — לפי שעות, לבית ולעסק. משווים את אחוז ההנחה ואת תנאי המסלול. ייעוץ אישי ללא עלות.",
    h1: "הנחה בחשבון החשמל",
    intro: [
      "מאז פתיחת שוק החשמל אפשר לקנות חשמל מספק פרטי בהנחה על התעריף של חברת החשמל. ההבדל בין המסלולים הוא בעיקר באחוז ההנחה ובשעות שבהן היא חלה.",
      "מסלול עם הנחה גבוהה בלילה משתלם למי שצורך בעיקר בלילה, ופחות למי שבבית בצהריים. שלחו לי את חשבון החשמל ואבדוק איזה מסלול מתאים לצריכה שלכם.",
    ],
  },
];

export function servicePage(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((s) => s.slug === slug);
}

export function servicePath(category: Category): string {
  const page = SERVICE_PAGES.find((s) => s.category === category);
  return page ? `/${page.slug}` : "/";
}

export function providerPath(slug: string): string {
  return `/provider/${slug}`;
}

/**
 * האם נתיב ציבורי של האתר של אלירן הוא עמוד תוכן — לשימוש `proxy.ts`.
 * ה-`slug` של ספק נבדק רק בצורתו; ספק שאינו קיים מקבל 404 מהעמוד.
 */
export function isContentPath(pathname: string): boolean {
  if (SERVICE_PAGES.some((s) => pathname === `/${s.slug}`)) return true;
  return /^\/provider\/[a-z0-9-]+$/.test(pathname);
}

/**
 * ⚠️ כל עמוד באתר של אלירן חייב לדרוס את `index: false` של
 * `app/layout.tsx` — בלי זה הוא יורש אותו ונשאר מחוץ לגוגל בשקט.
 */
export const INDEXABLE: Metadata["robots"] = { index: true, follow: true };
