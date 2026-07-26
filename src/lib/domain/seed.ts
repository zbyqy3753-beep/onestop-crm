import type { Deal, Lead, Registration, User } from "./types";

/**
 * המערכת ריקה — אין נתוני דוגמה.
 *
 * כל הנתונים האמיתיים מגיעים מ-MySQL (DATA_SOURCE=prisma). כל עוד לא
 * חובר DB, המערכת רצה במצב זיכרון ריק: כל המסכים עולים ומראים מצבי
 * "אין נתונים עדיין". ברגע שמחברים MySQL, הנתונים האמיתיים מופיעים
 * בלי שינוי קוד.
 */

/** נקודת ייחוס קבועה לתאריכים דטרמיניסטיים (בשימוש דשבורד ה-LIVE). */
export const SEED_EPOCH = new Date("2026-07-20T09:00:00.000Z").getTime();

/**
 * זהות המשתמש שהמעטפת מרנדרת לפיה (סרגל צד, הרשאות תצוגה, אווטאר).
 *
 * זו אינה "נתוני דוגמה" ואינה נכתבת ל-DB — זהו מציין מקום לפיתוח
 * בלבד, כל עוד אין מערכת התחברות אמיתית. תפקיד owner כדי שכל פריטי
 * הניווט יוצגו. בחיבור auth אמיתי הוא יוחלף במשתמש מה-session.
 */
export const DEV_USER: User = {
  id: "dev-user",
  name: "משתמש פיתוח",
  role: "owner",
  email: "dev@onestop.local",
  active: true,
};

/** המזהה של המשתמש המחובר. בחיבור auth אמיתי יגיע מה-session. */
export const CURRENT_USER_ID = DEV_USER.id;

/* ── נתונים ריקים — יתמלאו מ-MySQL ────────────────────────────────────── */

/** רשימת המשתמשים בארגון. ריקה עד שמחברים MySQL. */
export const SEED_USERS: User[] = [];

export const SEED_LEADS: Lead[] = [];

export const SEED_DEALS: Deal[] = [];

export const SEED_REGISTRATIONS: Registration[] = [];
