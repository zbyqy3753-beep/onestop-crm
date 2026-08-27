import type { Role } from "@/lib/domain/types";
import { canAccessRoute } from "@/lib/domain/permissions";

export interface NavItem {
  href: string;
  label: string;
  /** תיאור קצר שמופיע כ-title ולקוראי מסך */
  hint: string;
  icon: IconName;
  /*
   * ⚠️ **אין כאן שדה `roles`, ואין להחזיר אותו.** מי רואה איזה יעד
   * מוגדר ב-`lib/domain/permissions.ts` (`ROUTE_ROLES`), ומשם קוראים
   * גם התפריט וגם השומר בשרת. כשההגדרה ישבה כאן היא הייתה הצהרה
   * שנייה לצד זו שבמסכים, השתיים נפרדו, ועובד שהקליד `/deals` קיבל
   * מסך ניהולי מלא. שדה כזה כאן יחזיר בדיוק את אותו פער.
   */
  /** המסך עדיין לא נבנה — יוצג כמושבת */
  planned?: boolean;
  /**
   * מיקום בסרגל התחתון בטלפון. מספר נמוך = שמאלי יותר.
   *
   * ⚠️ פריט **בלי** הערך הזה נוחת אוטומטית בגיליון "עוד". זו הנקודה:
   * אין רשימה שנייה שאפשר לשכוח לעדכן — יעד חדש ב-`NAV` תמיד נגיש,
   * גם אם אף אחד לא חשב על הטלפון כשהוסיף אותו.
   */
  mobileOrder?: number;
  /**
   * תווית קצרה לסרגל התחתון, כשהמלאה לא נכנסת ב-75px.
   * ⚠️ רק לסרגל — הגיליון והסרגל הצדדי מציגים תמיד את התווית המלאה,
   * כי שם יש מקום ושתי תוויות שונות לאותו יעד מבלבלות.
   */
  shortLabel?: string;
}

export type IconName =
  | "leads"
  | "packages"
  | "deals"
  | "dashboard"
  | "myDeals"
  | "registrations"
  | "admin"
  | "upload"
  | "whatsapp"
  | "mail"
  | "feedback";

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * מבנה הניווט. המסלולים תואמים למערכת הקיימת, כך שקישורים
 * וזיכרון שריר של המשתמשים נשמרים.
 */
export const NAV: NavGroup[] = [
  {
    title: "עבודה יומית",
    items: [
      {
        href: "/",
        label: "בית",
        hint: "סיכום יומי",
        icon: "dashboard",
      },
      {
        href: "/leads",
        label: "לידים",
        hint: "תור העבודה — מי לחייג עכשיו",
        icon: "leads",
        // ראשון בסרגל התחתון לכל תפקיד — זה גם `start_url` של האפליקציה
        mobileOrder: 1,
      },
      {
        href: "/packages",
        label: "חבילות",
        hint: "קטלוג הספקים והעמלות",
        icon: "packages",
        // מה שהעובד פותח באמצע שיחה כדי לבדוק מחיר
        mobileOrder: 4,
      },
      {
        href: "/my-deals",
        label: "העסקאות שלי",
        shortLabel: "שלי",
        hint: "מה סגרתי וכמה הרווחתי",
        icon: "myDeals",
        mobileOrder: 5,
      },
    ],
  },
  {
    title: "ניהול",
    items: [
      {
        href: "/deals",
        label: "מעקב עסקאות",
        shortLabel: "עסקאות",
        hint: "כל העסקאות בארגון",
        icon: "deals",
        // גובר על "חבילות" למי שרואה אותו — זה מסך הניהול היומי
        mobileOrder: 2,
      },
      {
        href: "/deals-dashboard",
        label: "דשבורד עסקאות",
        hint: "רווח, עמלות וביצועים",
        icon: "dashboard",
      },
      {
        href: "/registrations",
        label: "טפסי רישום",
        shortLabel: "רישום",
        hint: "פניות שהגיעו מטפסים",
        icon: "registrations",
        mobileOrder: 3,
      },
      {
        href: "/bots",
        label: "בוטים",
        hint: "בוט תזכורות הוואטסאפ — מצב, הגדרות ותור",
        icon: "whatsapp",
      },
      {
        href: "/mailer",
        label: "דיוור",
        hint: "שליחת מייל לרשימה מקובץ",
        icon: "mail",
      },
      {
        href: "/broadcast",
        label: "דיוור וואטסאפ",
        shortLabel: "וואטסאפ",
        hint: "שליחת הודעת וואטסאפ לרשימת מספרים",
        icon: "whatsapp",
      },
      {
        href: "/renewals",
        label: "חידושים",
        hint: "העלאת מסמכי לקוחות שהשנה שלהם הסתיימה",
        icon: "upload",
      },
      {
        href: "/admin",
        label: "ניהול מערכת",
        hint: "משתמשים, הרשאות ועלויות",
        icon: "admin",
      },
    ],
  },
  /*
   * ⚠️ קבוצה שלישית בשביל פריט אחד — בכוונה.
   *
   * המשוב ישב בסוף "עבודה יומית", ולכן בסרגל הצד (ש**משטח** את כל
   * הקבוצות לרשימה אחת) הוא נחת באמצע התפריט, בין "העסקאות שלי" לבין
   * מסכי הניהול. הוא לא מסך שנכנסים אליו כל יום והוא לא הצדיק את
   * המקום הזה.
   *
   * להעביר אותו פשוט לסוף "ניהול" לא היה עובד: `MoreSheet` מרנדר לפי
   * קבוצות **עם כותרותיהן**, ובנייד המשוב היה מופיע תחת הכותרת
   * "ניהול" — שקר, ומסך שכל עובד אמור להגיע אליו היה נראה כמוגבל
   * להנהלה. קבוצה משלו פותרת את שני הרנדררים בבת אחת.
   */
  {
    title: "אחר",
    items: [
      {
        href: "/feedback",
        label: "משוב",
        hint: "דיווח באגים ובקשות שיפור על המערכת",
        icon: "feedback",
      },
    ],
  },
];

/**
 * היעדים שהתפקיד רואה בתפריט.
 *
 * ⚠️ **זו הסתרה ולא הרשאה** — הפרדה שחשוב לשמור עליה חדה. הפונקציה
 * הזו רק מונעת מהמשתמש לראות קישור שאין לו מה לעשות איתו; מי שמקליד
 * את הכתובת ידנית לא עובר כאן בכלל. מה שבאמת חוסם הוא
 * `requireRouteAccess` בראש כל מסך מוגבל.
 *
 * הסינון היחיד קורא ל-`canAccessRoute`, שמטפל גם בספק וגם בתפקידי
 * הצוות — כך שהתפריט מציג בדיוק את מה שהשרת מוכן לתת, לא פחות ולא
 * יותר.
 */
export function visibleFor(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccessRoute(role, i.href)),
  })).filter((g) => g.items.length > 0);
}

/** כמה יעדים נכנסים לסרגל התחתון לפני שהרביעי הופך ל"עוד". */
export const MOBILE_TABS = 4;

/**
 * היעדים שיופיעו בסרגל התחתון בטלפון, לפי תפקיד.
 *
 * ⚠️ נגזר מ-`NAV` ולא מרשימה נפרדת. בעלים רואה 9 יעדים ועובד 5, ואי
 * אפשר להציג את שניהם בסרגל אחד — אבל אפשר להציג את הארבעה הראשונים
 * שרלוונטיים לכל תפקיד, וכל השאר נגיש דרך "עוד".
 */
export function mobileTabsFor(role: Role): NavItem[] {
  return visibleFor(role)
    .flatMap((g) => g.items)
    .filter((i) => !i.planned && i.mobileOrder !== undefined)
    .sort((a, b) => a.mobileOrder! - b.mobileOrder!)
    .slice(0, MOBILE_TABS);
}
