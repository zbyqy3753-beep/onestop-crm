import type { Role } from "./types";

/**
 * מי רואה מה.
 *
 * מודול נטול תלויות בכוונה — הוא נקרא גם מרכיבי שרת (שליפה) וגם
 * מרכיבי לקוח (הסתרת פקדים חסרי משמעות). הכלל היחיד שחשוב: הצד
 * שקובע הוא השרת. פונקציה שמשמשת להסתרת כפתור בלקוח היא נוחות,
 * לא הרשאה.
 */

/**
 * תפקידים שרואים את כל הלידים בארגון.
 *
 * כל השאר רואים אך ורק לידים שמשויכים אליהם — **כולל לא לידים ללא
 * שיוך**. חלוקת הלידים היא פעולה ניהולית בלבד. ההגבלה נאכפת ב-
 * `src/app/(app)/leads/page.tsx`, בשליפה מהמסד — לא בסינון בלקוח.
 *
 * ⚠️ מנהלי משנה (`bizManager`, `shopOwner`) **לא** נכללים כאן.
 * הם מנהלים תחום מסוים, לא את מאגר הלידים כולו. אם יתברר שהם
 * צריכים ראייה רחבה, זו החלטה עסקית שצריך לקבל במפורש ולא לגלוש
 * אליה בטעות דרך המילה "מנהל".
 */
const FULL_LEAD_ACCESS: readonly Role[] = ["owner", "manager"];

export function canSeeAllLeads(role: Role): boolean {
  return FULL_LEAD_ACCESS.includes(role);
}

/* ── צוות של בעל עסק ──────────────────────────────────────────────── */

/**
 * בעלי עסק — מי שרשאי לצרף אליו עובדים ולראות את הלידים שלהם.
 *
 * ⚠️ זו לא "ראייה מלאה" (`canSeeAllLeads`) אלא חתך: בעל העסק רואה את
 * הלידים שלו ושל העובדים המשויכים אליו (`User.teamOwnerId`), ותו לא.
 * החתך נאכף בשליפה ב-`leads/page.tsx` ובכל Server Action דרך
 * `teamScopeIds` — לא בהסתרה בלקוח.
 */
const TEAM_LEAD_ROLES: readonly Role[] = ["bizManager", "shopOwner"];

export function canLeadTeam(role: Role): boolean {
  return TEAM_LEAD_ROLES.includes(role);
}

/**
 * התפקידים שבעל עסק רשאי לצרף לצוות שלו.
 *
 * ⚠️ רשימת היתר: בעל עסק לא מנפיק חשבון מנהל, ספק או בעל עסק נוסף —
 * גם לא דרך קריאה ישירה ל-Server Action עם תפקיד אחר בטופס.
 */
export const TEAM_MEMBER_ROLES: readonly Role[] = ["employee", "agent", "operator"];

export function canJoinTeam(role: Role): boolean {
  return TEAM_MEMBER_ROLES.includes(role);
}

/**
 * ספק לידים חיצוני — לא חלק מהצוות.
 *
 * הוא רואה מסך יחיד: רשימת הלידים שהוא עצמו הביא — שם, טלפון, סטטוס,
 * הערות הצוות ותאריך הקליטה. לא מי מטפל, לא עלות רכישה, ולא מזהי
 * ליד/עובד. ההצמדה בין ספק ללידים שלו היא `User.leadSourceName` מול
 * `Lead.sourceDetail`.
 *
 * ⚠️ **ההגבלה לא מסתמכת על הסתרת פריטים בתפריט.** `visibleFor` מסתיר
 * את שאר היעדים, אבל מי שמקליד `/admin` בשורת הכתובת עוקף אותה
 * לגמרי. מה שבאמת עוצר הוא `requireStaffUser` בראש כל מסך אחר —
 * ראה `server/auth/session.ts`.
 */
export function isSupplier(role: Role): boolean {
  return role === "supplier";
}

/**
 * מי בכלל רשאי להשתמש ב-CRM.
 *
 * ⚠️ `siteManager` הוא אחראי תוכן האתר `onestop-site`. הוא מזוהה מול
 * אותו Supabase Auth ויושב באותה טבלת `User` — זו כל הסיבה שהתפקיד
 * קיים כאן — אבל הסיסמה שלו פותחת **רק** את `/admin` של האתר. מי
 * שמעדכן מחירים בבלוג לא צריך לראות את מאגר הלידים.
 *
 * ⚠️ הבדיקה נאכפת ב-`getSessionUser` ולא רק במסך ההתחברות. כל מסך
 * וכל Server Action ב-CRM עוברים דרך שם, ולכן חשבון כזה נשאר חסום
 * גם אם מישהו יזריק לו עוגיית סשן ידנית או ינסה להתחזות אליו.
 *
 * ⚠️ שלילה מפורשת ולא רשימת היתר, בניגוד ל-`ADMIN_ROLES` שבצד האתר:
 * שם ברירת המחדל הבטוחה היא "אין גישה", כאן היא "יש גישה" — תפקיד
 * חדש במוקד אמור לעבוד, ותפקיד שאסור לו להיכנס הוא החריג שמצהירים
 * עליו.
 */
export function canUseCrm(role: Role): boolean {
  return role !== "siteManager";
}

/* ── גישה לנתיבים ─────────────────────────────────────────────────── */

/**
 * מי נכנס לאיזה מסך — **המקור היחיד**.
 *
 * ⚠️ הכוונה הזו הייתה כתובה פעמיים: בשדה `roles` של כל פריט ב-`nav.ts`,
 * ובנוסף בקבוע `ALLOWED` מקומי בכל `page.tsx` בנפרד. שתי ההצהרות
 * נפרדו זו מזו, ובדיוק שם נפער החור: `nav.ts` אמר ש-`/deals` שייך
 * ל-owner/manager/bizManager/shopOwner, בזמן שהמסך עצמו הסתפק
 * ב-`requireStaffUser` — שחוסם **רק ספק** ולא עובד רגיל. כל עובד
 * שהקליד `/deals` בשורת הכתובת קיבל את כל העסקאות בארגון, את כל
 * מאגר הלידים ואת רשימת המשתמשים המלאה.
 *
 * לכן `NavItem.roles` נמחק לגמרי. התפריט והשומר בשרת קוראים שניהם
 * מכאן, ואין מקום שני שאפשר לעדכן רק אותו ולשכוח את השני.
 *
 * נתיב שאינו ברשימה פתוח לכל הצוות — זו ברירת המחדל הנכונה למערכת
 * שרוב מסכיה משותפים, וההגבלה היא החריג שצריך להצהיר עליו.
 */
const ROUTE_ROLES = {
  "/deals": ["owner", "manager", "bizManager", "shopOwner"],
  "/deals-dashboard": ["owner", "manager", "bizManager"],
  "/registrations": ["owner", "manager", "operator"],
  "/bots": ["owner", "manager"],
  "/renewals": ["owner", "manager"],
  "/mailer": ["owner", "manager"],
  "/broadcast": ["owner", "manager"],
  "/admin": ["owner", "manager"],
  "/team": ["bizManager", "shopOwner"],
} as const satisfies Record<string, readonly Role[]>;

/**
 * נתיב שיש עליו הגבלת תפקיד.
 *
 * הטיפוס נגזר מהמפה ולא נכתב ידנית, כך שכתיב שגוי בקריאה ל-
 * `requireRouteAccess` נופל בקומפילציה ולא נשאר שומר שלא שומר על כלום.
 */
export type RestrictedRoute =
  | keyof typeof ROUTE_ROLES
  | keyof typeof PERSONAL_ROUTES;

/**
 * מסכים אישיים — פתוחים למשתמשים מסוימים לפי מזהה, לא לפי תפקיד.
 *
 * `/posts` הוא סטודיו הפוסטים של אלירן (אלירן תקשורת, @telecom4you):
 * הפוסטים והבקשות שבו שלו בלבד, ושאר הצוות — כולל בעלים — לא נכנס.
 * בעלים שצריך לראות אותו נכנס דרך "כניסה בתור" אלירן.
 *
 * ⚠️ לפי `User.id` ולא לפי מייל או שם: את שניהם אפשר לערוך במסך
 * הניהול, ומשתמש שישנה לעצמו את השם ל"אלירן" לא אמור לקבל את המסך.
 * המזהה לא משתנה לעולם.
 */
const PERSONAL_ROUTES = {
  "/posts": ["cmsycm4b3000004l7504fik26"], // אלירן
} as const satisfies Record<string, readonly string[]>;

/**
 * היעדים היחידים שספק לידים חיצוני רשאי להגיע אליהם.
 *
 * ⚠️ רשימת היתר (allow-list) ולא הגבלה פר-פריט: יעד חדש שמישהו יוסיף
 * בעתיד בלי לחשוב על ספקים נחסם בפניו כברירת מחדל, במקום להיפתח.
 *
 * ישבה קודם ב-`nav.ts` והועברה לכאן, כדי שגם ההסתרה בתפריט וגם
 * החסימה בשרת ייגזרו מאותה שורה.
 */
const SUPPLIER_HREFS: readonly string[] = ["/leads"];

/**
 * האם המשתמש רשאי להגיע לנתיב.
 *
 * ⚠️ `userId` נדרש למסכים אישיים (`PERSONAL_ROUTES`). בלעדיו הם נחסמים —
 * ברירת המחדל הבטוחה למסך שהוגדר כפרטי.
 */
export function canAccessRoute(
  role: Role,
  href: string,
  userId?: string,
): boolean {
  if (isSupplier(role)) return SUPPLIER_HREFS.includes(href);

  const personal: readonly string[] | undefined =
    PERSONAL_ROUTES[href as keyof typeof PERSONAL_ROUTES];
  if (personal) return !!userId && personal.includes(userId);

  const allowed: readonly Role[] | undefined =
    ROUTE_ROLES[href as keyof typeof ROUTE_ROLES];
  return !allowed || allowed.includes(role);
}

/**
 * מי רשאי לשנות הגדרות ארגוניות — עלויות רכישת ליד וכיוצא בזה.
 *
 * ⚠️ בכוונה **לא** נגזר מ-`ROUTE_ROLES`. מסך החבילות פתוח לכל הצוות
 * בצדק — עובד פותח אותו באמצע שיחה כדי לבדוק מחיר — ורק עורך
 * העלויות שבתוכו הוא ניהולי. המצאת "נתיב" מדומה בשביל פקד בודד
 * הייתה מעוותת את מפת הנתיבים ומקשה לקרוא אותה.
 */
export function canManageSettings(role: Role): boolean {
  return role === "owner" || role === "manager";
}
