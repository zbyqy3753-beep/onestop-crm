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
