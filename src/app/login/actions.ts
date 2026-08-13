"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, GATE_COOKIE_OPTIONS } from "@/lib/gate";
import { NEXT_PARAM, safeReturnTo } from "@/lib/returnTo";
import {
  endSessionRecord,
  startSession,
  verifyCredentials,
} from "@/server/auth/session";

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
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return "יש למלא אימייל וסיסמה.";

  const user = await verifyCredentials(email, password);
  if (!user) return "אימייל או סיסמה שגויים.";

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
