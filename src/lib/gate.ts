/**
 * עוגיות הגישה — הגדרה משותפת.
 *
 * חיות כאן ולא ב-`proxy.ts` וגם לא ב-`server/auth/session.ts`, כי שלושה
 * צדדים כותבים אותן: ה-proxy (כשמגיעים עם `?k=<ACCESS_KEY>`, וכשהוא
 * מחדש סשן פעיל), פעולת ההתחברות, ופעולת ההתחזות. מודול נייטרלי בלי
 * `server-only` ובלי תלויות, כדי שגם ה-proxy — שרץ ב-Edge runtime ולא
 * יכול לייבא את שכבת ה-DB — יוכל לייבא אותו.
 */

export const GATE_COOKIE = "os_gate";

/**
 * תוכן העוגייה הוא **טוקן אקראי** — ראה `server/auth/token.ts`.
 *
 * ⚠️ קדם לזה מזהה המשתמש עצמו, בטקסט גלוי. אל תחזיר את זה: עריכת
 * העוגייה ב-DevTools למזהה של הבעלים נתנה גישת בעלים מלאה, ומזהי
 * משתמשים מגיעים לדפדפן בשדה `assigneeId` של כל ליד — לא היה אפילו
 * מה לנחש.
 */
export const SESSION_COOKIE = "os_session";

/**
 * שבוע — אבל **מתגלגל**: `proxy.ts` קובע את שתי העוגיות מחדש בכל ניווט
 * מסמך, כך שמשתמש פעיל לא מתנתק לעולם ומשתמש נטוש פג אחרי שבוע.
 *
 * בלי החידוש הזה הבעלים היה נזרק מהאפליקציה המותקנת כל שבוע, באמצע
 * התור, בלי שום רמז למה.
 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const MAX_AGE = SESSION_MAX_AGE;

export const GATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;

/** זהות ל-`GATE_COOKIE_OPTIONS` — שתי העוגיות אמורות למות יחד. */
export const SESSION_COOKIE_OPTIONS = GATE_COOKIE_OPTIONS;
