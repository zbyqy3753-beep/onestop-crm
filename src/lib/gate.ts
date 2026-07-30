/**
 * עוגיית שער הגישה — הגדרה משותפת.
 *
 * חיה כאן ולא ב-`proxy.ts` כי שני צדדים כותבים אותה: ה-proxy כשמגיעים
 * עם `?k=<ACCESS_KEY>`, ופעולת ההתחברות אחרי אימות מוצלח. מודול נייטרלי
 * בלי `server-only` ובלי תלויות, כדי שגם ה-proxy (שרץ ב-Edge runtime)
 * וגם Server Action רגיל יוכלו לייבא אותו.
 */

export const GATE_COOKIE = "os_gate";

/** שבוע — זהה ל-`SESSION_COOKIE_OPTIONS`, שתי העוגיות אמורות למות יחד. */
const MAX_AGE = 60 * 60 * 24 * 7;

export const GATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;
