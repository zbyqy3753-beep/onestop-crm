"use server";

import { completeReset, resetTarget } from "@/server/auth/passwordReset";
import { passwordProblem } from "@/lib/password";

/**
 * ⚠️ מצב מפורש ולא `string | null`. עם `null` בתור "אין שגיאה", מצב
 * ההתחלה ומצב ההצלחה נראים זהים — והמסך לא יכול לדעת אם להציג טופס
 * או "הסיסמה נקבעה".
 */
export type SetPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done" };

/**
 * קביעת הסיסמה בידי העובד עצמו.
 *
 * ⚠️ **הנתיב הזה פתוח לגמרי** — הוא חייב להיות, כי עובד שננעל בחוץ
 * מגיע אליו בלי סשן ובלי עוגיית שער. מה שמגן עליו הוא הטוקן בלבד:
 * 256 ביט אקראיים, חד-פעמי, ופג תוך 72 שעות.
 *
 * ⚠️ `passwordProblem` נקרא **כאן** ולא רק בטופס. Server Action היא
 * נקודת קצה HTTP לכל דבר, ומי ששולח אליה בקשה ישירות עוקף כל בדיקה
 * שקיימת בדפדפן בלבד.
 */
export async function setPassword(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password) return { status: "error", message: "יש להזין סיסמה" };
  if (password !== confirm) {
    return { status: "error", message: "שתי הסיסמאות אינן זהות" };
  }

  // ⚠️ הטוקן נפתר עוד לפני בדיקת החוזק, כדי שכלל "הסיסמה לא יכולה
  // להכיל את השם שלך" יידע מהו השם. בלי זה הכלל הזה פשוט לא היה חל
  // במסך שבו הסיסמאות באמת נבחרות.
  const target = await resetTarget(token);
  if (!target) {
    return { status: "error", message: "הקישור אינו תקף. בקש קישור חדש." };
  }

  const weak = passwordProblem(password, {
    email: target.email,
    name: target.name,
  });
  if (weak) return { status: "error", message: weak };

  const result = await completeReset(token, password);
  if (!result.ok) return { status: "error", message: result.error };

  // ⚠️ אין כאן `startSession`. העובד עובר למסך ההתחברות ומקליד את
  // הסיסמה שבחר — כך הוא מגלה מיד אם שמר משהו שהוא לא זוכר, במקום
  // לגלות את זה מחר בבוקר.
  return { status: "done" };
}
