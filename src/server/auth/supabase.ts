import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * קליינט Supabase Auth בלבד — לאימות מייל/סיסמה מול `auth.users`.
 * לא ניגש לטבלאות שלנו; זה תפקיד ה-repositories (src/server/repositories).
 * המפתח הניתן־לפרסום (publishable) מספיק כאן — אין צורך במפתח סודי
 * ב-runtime, רק בסקריפטים חד־פעמיים ליצירת משתמשים (ראה README/AGENTS).
 */
function createAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY חסרים. הגדר אותם ב-.env.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifySupabasePassword(
  email: string,
  password: string,
): Promise<boolean> {
  const supabase = createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}
