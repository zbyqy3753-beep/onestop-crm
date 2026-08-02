/**
 * עוגיית רמז הרוחב — הגדרה משותפת.
 *
 * ⚠️ מודול נייטרלי בלי `"use client"`, ובכוונה **לא** בתוך `media.ts`.
 * מודול עם `"use client"` שמיובא מ-Server Component מחזיר לכל היצוא
 * שלו client reference ולא את הערך עצמו — כלומר `cookies().get(...)`
 * קיבל אובייקט פרוקסי במקום את המחרוזת, החזיר `undefined`, והרמז
 * מעולם לא הגיע לשרת. זה נכשל בשקט: הכל מתקמפל, הכל רץ, והטלפון
 * פשוט ממשיך לצייר טבלה.
 */

export const WIDTH_COOKIE = "os_w";

/** ערך העוגייה כשהמסך צר. כל ערך אחר נחשב שולחן. */
export const NARROW_VALUE = "n";
export const WIDE_VALUE = "w";
