"use server";

import { toLoginEmail } from "@/lib/loginId";
import { passwordProblem } from "@/lib/password";
import { isCodeShape } from "@/lib/resetCode";
import { issueCode, redeemCode, sendCode } from "@/server/auth/resetCode";
import { isLockedOut, recordFailure } from "@/server/auth/lockout";

/**
 * שחזור סיסמה שהעובד יוזם בעצמו.
 *
 * ⚠️ **הנתיב פתוח לגמרי** — הוא חייב להיות, כי מי שמגיע אליו הוא
 * בדיוק מי שאין לו דרך להיכנס. מה שמגן עליו: הקוד קצר-מועד, מוגבל
 * בניסיונות, והבקשות עצמן מוגבלות בקצב.
 */

export type ForgotState =
  | { step: "request"; error?: string }
  | { step: "verify"; loginId: string; maskedPhone?: string; error?: string }
  | { step: "done" };

/**
 * שלב א׳ — בקשת קוד.
 *
 * ⚠️ **עובר ל-`verify` תמיד, גם כשהמשתמש לא קיים.** מסך שמבחין בין
 * "נשלח קוד" ל"אין משתמש כזה" הוא כלי לגילוי שמות המשתמשים בארגון.
 * מי שהקליד שם שגוי פשוט לא יקבל הודעה, ויגלה זאת כשהקוד לא יגיע.
 */
export async function requestCode(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const raw = String(formData.get("loginId") ?? "").trim();
  if (!raw) return { step: "request", error: "יש להזין שם משתמש" };

  const email = toLoginEmail(raw);

  /*
   * ⚠️ אותה נעילה של מסך ההתחברות, ובכוונה — היא מוגבלת לפי מזהה
   * וכבר אומתה בייצור. בלעדיה אפשר לבקש קוד חדש בלי סוף, וכל בקשה
   * מאפסת את מונה הניסיונות ומחדשת את חלון הניחוש.
   */
  if (await isLockedOut(email)) {
    return {
      step: "request",
      error: "יותר מדי בקשות. נסה שוב בעוד רבע שעה.",
    };
  }
  await recordFailure(email);

  const issued = await issueCode(email);
  if (issued) {
    try {
      await sendCode(issued);
    } catch (error) {
      console.error("[forgot] שליחת הקוד נכשלה:", error);
      // ⚠️ ממשיכים ל-`verify` גם בכישלון שליחה: הודעת שגיאה כאן
      // הייתה מסגירה שהמשתמש קיים.
    }
  }

  // ⚠️ `maskedPhone` קיים רק כשבאמת נשלח משהו. המסך מציג בזכותו
  // "נשלח ל-•••0008" למי שזכאי, ומשפט כללי לכל השאר — בלי לגלות
  // למי מהם יש חשבון.
  return { step: "verify", loginId: raw, maskedPhone: issued?.maskedPhone };
}

/** שלב ב׳ — אימות הקוד וקביעת הסיסמה. */
export async function submitCode(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const back = (error: string): ForgotState => ({ step: "verify", loginId, error });

  if (!isCodeShape(code)) return back("הקוד הוא שש ספרות");
  if (password !== confirm) return back("שתי הסיסמאות אינן זהות");

  const email = toLoginEmail(loginId);

  // ⚠️ נבדק בשרת ולא רק בטופס — Server Action היא נקודת קצה HTTP.
  const weak = passwordProblem(password);
  if (weak) return back(weak);

  const result = await redeemCode(email, code, password);
  if (!result.ok) return back(result.error);

  return { step: "done" };
}
