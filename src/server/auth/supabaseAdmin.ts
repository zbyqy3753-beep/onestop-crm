import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * קליינט Supabase עם מפתח סודי (service role) — הרשאות ניהול מלאות.
 * לשימוש בסקריפטים/פעולות ניהול בלבד (יצירת משתמשים דרך מסך הניהול).
 * אסור לחשוף את המפתח הזה לצד לקוח.
 */
function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SECRET_KEY חסרים. הגדר אותם ב-.env.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * יוצר משתמש Auth חדש עם מייל+סיסמה, מאושר אוטומטית (בלי מייל אימות).
 * זורק אם המייל כבר קיים ב-Auth.
 */
export async function createAuthUser(
  email: string,
  password: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
}

/**
 * מאתר חשבון Auth לפי מייל.
 *
 * ל-Supabase אין `getUserByEmail` — רק שליפה לפי מזהה או רשימה. אנחנו
 * לא שומרים את מזהה ה-Auth בטבלת `User` שלנו, ולכן המייל הוא הקישור
 * היחיד בין שתי המערכות. בסדר הגודל כאן (עשרות משתמשים) עמוד אחד
 * מספיק; אם המספר יגדל, זה המקום שיצטרך עימוד.
 */
async function findAuthUserId(email: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(error.message);

  const target = email.trim().toLowerCase();
  const found = data.users.find((u) => u.email?.toLowerCase() === target);
  return found?.id ?? null;
}

/** האם למייל הזה יש בכלל חשבון התחברות. */
export async function hasAuthUser(email: string): Promise<boolean> {
  return (await findAuthUserId(email)) !== null;
}

/**
 * שינוי מייל ו/או סיסמה של חשבון Auth קיים.
 *
 * ⚠️ המייל הוא המפתח שמקשר בין `User` שלנו לחשבון ההתחברות
 * (`verifyCredentials` מאמת מול Supabase ואז מחפש אצלנו לפי אותו
 * מייל). אם השניים יתפצלו — המשתמש ננעל בחוץ: הסיסמה תתקבל אבל
 * לא תימצא לו שורה, או להפך. לכן הקורא **חייב** לעדכן את שתי
 * המערכות, ולגלגל אחורה אם השנייה נכשלה.
 *
 * `email_confirm: true` כדי שהמייל החדש ייחשב מאומת מיד — אחרת
 * Supabase שולח מייל אישור והמשתמש לא יוכל להיכנס עד שילחץ עליו.
 */
export async function updateAuthUser(
  currentEmail: string,
  changes: { email?: string; password?: string },
): Promise<void> {
  if (!changes.email && !changes.password) return;

  const id = await findAuthUserId(currentEmail);
  if (!id) {
    throw new Error(
      `לא נמצא חשבון התחברות עבור ${currentEmail} — לא ניתן לעדכן מייל או סיסמה`,
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(id, {
    ...(changes.email ? { email: changes.email, email_confirm: true } : {}),
    ...(changes.password ? { password: changes.password } : {}),
  });
  if (error) throw new Error(error.message);
}

/**
 * מוחק חשבון Auth לפי מייל.
 *
 * ⚠️ שקט כשאין חשבון, בניגוד ל-`updateAuthUser` שזורק. מחיקת משתמש
 * חייבת להצליח גם כשה-Auth כבר לא מסונכרן איתנו — שורה שנוצרה
 * ישירות במסד, או חשבון שנמחק ידנית ב-Supabase. חסימת המחיקה במקרה
 * הזה הייתה משאירה בדיוק את השורות שהכי צריך לנקות.
 */
export async function deleteAuthUser(email: string): Promise<void> {
  const id = await findAuthUserId(email);
  if (!id) return;

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}
