"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canUseCrm } from "@/lib/domain/permissions";
import { hasOpenReset } from "@/server/auth/resetCode";
import { GATE_COOKIE, GATE_COOKIE_OPTIONS } from "@/lib/gate";
import { NEXT_PARAM, safeReturnTo } from "@/lib/returnTo";
import { toLoginEmail } from "@/lib/loginId";
import {
  endSessionRecord,
  startSession,
  verifyCredentials,
} from "@/server/auth/session";
import {
  clearFailures,
  isLockedOut,
  recordFailure,
} from "@/server/auth/lockout";

/*
 * ⚠️ כאן ישבה `startTestSession` — כפתור "כניסת בדיקה" שכתב עוגיית סשן
 * של DEV_USER (תפקיד owner) בלי שום אימות. היא הוסרה ב-30.7.2026.
 *
 * הסיבה: `ACCESS_KEY` בייצור היה ריק, ולכן השער ב-proxy.ts היה פתוח
 * ו-/login היה נגיש לכל מי שידע את הכתובת. כלומר כל מי שהגיע לכתובת
 * קיבל גישת מנהל ראשי מלאה ללידים אמיתיים בלחיצה אחת.
 *
 * אל תחזיר את זה. גם לא "רק לפיתוח" — זה בדיוק מה שהיה כתוב עליה.
 */

/** שליחת הטופס — מאמת מול Supabase Auth דרך verifyCredentials. */
export async function signIn(_prev: string | null, formData: FormData) {
  const raw = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!raw.trim() || !password) return "יש למלא שם משתמש וסיסמה.";

  // `idan` → `idan@onestop.co.il`; כתובת מלאה עוברת כמות שהיא.
  // אותה המרה בדיוק רצה ביצירת המשתמש — ראה lib/loginId.ts
  const email = toLoginEmail(raw);

  /*
   * ⚠️ הנעילה נבדקת **לפני** אימות הסיסמה, לא אחריו: המטרה היא למנוע
   * את הניחוש עצמו, לא רק להתעלם מתוצאתו. ראה server/auth/lockout.ts
   */
  if (await isLockedOut(email)) {
    return "יותר מדי ניסיונות התחברות. נסה שוב בעוד רבע שעה.";
  }

  const user = await verifyCredentials(email, password);
  // הודעה אחת לשני המקרים (שם לא קיים / סיסמה שגויה): הפרדה ביניהם
  // מסגירה אילו חשבונות קיימים במערכת
  if (!user) {
    await recordFailure(email);

    /*
     * ⚠️⚠️ **כאן מתחיל מסלול האיפוס, ולא בקישור ״שכחת סיסמה?״.**
     *
     * עובד שההנהלה איפסה לו את הסיסמה מנסה להיכנס כרגיל ונכשל — כי
     * הסיסמה שלו נמחקה. במקום להשאיר אותו מול "סיסמה שגויה" בלי דרך
     * קדימה, מזהים שממתין לו איפוס ומעבירים אותו למסך הקוד.
     *
     * זה מה שמאפשר שלא יהיה קישור שחזור גלוי במסך הכניסה: המסלול
     * נפתח רק למי שבאמת אופס, ורק אחרי שהוא ניסה להיכנס בעצמו.
     */
    if (await hasOpenReset(email)) redirect(`/forgot-password?u=${encodeURIComponent(raw)}`);

    return "שם משתמש או סיסמה שגויים.";
  }

  // התחברות מוצלחת מנקה את המונה — אחרת עובד שטעה כמה פעמים בבוקר
  // היה נגרר עם הספירה הזו לאורך היום
  await clearFailures(email);

  /*
   * אחראי האתר — סיסמה נכונה, מערכת לא נכונה.
   *
   * ⚠️ הודעה מפורשת ולא "שם משתמש או סיסמה שגויים": כאן זו לא הסתרה
   * של קיום חשבון (הסיסמה כבר אומתה בהצלחה), וההודעה הסתמית הייתה
   * שולחת אותו לאפס סיסמה שעובדת מצוין.
   *
   * ⚠️ **אין כאן `startSession`.** זו לא הגנה בפני עצמה — `getSessionUser`
   * חוסם אותו בכל מקרה — אלא סירוב לפתוח סשן שממילא לא יעבוד.
   */
  if (!canUseCrm(user.role)) {
    return "החשבון הזה מיועד לניהול תוכן האתר בלבד, ואין לו גישה למערכת הלידים.";
  }

  // שורת סשן ב-DB + טוקן אקראי בעוגייה. ראה server/auth/session.ts
  await startSession(user.id);

  const store = await cookies();

  // גם עוגיית השער, ולא רק הסשן: אפליקציה שהותקנה למסך הבית באייפון
  // מקבלת צנצנת עוגיות נפרדת מספארי, ולכן היא מגיעה לכאן בלי שום
  // עוגייה. בלי השורה הזו היא הייתה נכנסת ומיד חוטפת 404 מהשער.
  store.set(GATE_COOKIE, "1", GATE_COOKIE_OPTIONS);

  // ⚠️ `safeReturnTo` שוב, ולא רק בשרת שרינדר את הטופס: השדה הנסתר
  // הוא קלט של המשתמש ואפשר לערוך אותו לפני השליחה.
  redirect(safeReturnTo(String(formData.get(NEXT_PARAM) ?? "")));
}

export async function endSession() {
  // מוחק גם את שורת הסשן ולא רק את העוגייה: אחרת הטוקן היה נשאר תקף
  // ב-DB, וכל מי שהעתיק אותו קודם יכול היה להמשיך להשתמש בו
  await endSessionRecord();
  redirect("/login");
}
