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
 * משתמש "כניסת בדיקה" — הכניסה המהירה במסך /login שלא דורשת סיסמה.
 * נזרע כשורה אמיתית ב-DB (ראה prisma/seed.ts) כדי ש-createdById/
 * assigneeId לא ייכשלו על מפתח זר. תפקיד owner כדי שכל פריטי הניווט
 * יוצגו. שאר המסכים מזהים את המשתמש דרך הסשן האמיתי (getSessionUser),
 * לא דרך הקבוע הזה.
 */
export const DEV_USER: User = {
  id: "dev-user",
  name: "משתמש פיתוח",
  role: "owner",
  email: "dev@onestop.local",
  active: true,
};

/* ── נתונים ריקים — יתמלאו מ-MySQL ────────────────────────────────────── */

/** רשימת המשתמשים בארגון. ריקה עד שמחברים MySQL. */
export const SEED_USERS: User[] = [];

export const SEED_LEADS: Lead[] = [];

export const SEED_DEALS: Deal[] = [];

export const SEED_REGISTRATIONS: Registration[] = [];
