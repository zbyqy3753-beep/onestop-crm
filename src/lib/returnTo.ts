/**
 * "לאן לחזור אחרי ההתחברות".
 *
 * מודול נייטרלי כי שני צדדים נוגעים בו: `proxy.ts` (Edge) כותב את
 * הפרמטר, ו-`login/actions.ts` קורא אותו.
 */

export const NEXT_PARAM = "next";

/** ברירת המחדל — לא הדשבורד. ראה `manifest.ts`. */
export const DEFAULT_AFTER_LOGIN = "/leads";

/**
 * מנקה יעד חזרה שהגיע מה-URL.
 *
 * ⚠️ ערך מה-URL הוא קלט של תוקף. `//evil.com` הוא נתיב חוקי לכל דבר
 * מבחינת `startsWith("/")`, והדפדפן מפרש אותו כ-`https://evil.com` —
 * הפניה פתוחה קלאסית. גם `/\evil.com` עובד בחלק מהדפדפנים.
 */
export function safeReturnTo(raw: string | null): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  if (!raw.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  return raw;
}
