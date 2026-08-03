import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * אחסון קבצי ה-PDF של החידושים.
 *
 * דלי **פרטי** ב-Supabase Storage. הקבצים האלה הם חשבוניות של לקוחות
 * אמיתיים — שם, טלפון, כתובת וצריכה — ודלי ציבורי היה הופך כל אחד
 * מהם לכתובת שניתן לנחש ולפתוח בלי שום הזדהות.
 *
 * הקובץ עצמו לא נשמר במסד: מאות חשבוניות היו מנפחות אותו לגיגה,
 * ובמסד שגם משרת את מסך הלידים זה משפיע על כל שאילתה.
 */

export const RENEWALS_BUCKET = "renewals";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY חסרים");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * שם הקובץ בדלי.
 *
 * ⚠️ נגזר מה-hash ולא משם הקובץ המקורי. שמות של חשבוניות מגיעים
 * בעברית ובתווים שהדלי דוחה, ושני לקוחות עם `חשבונית.pdf` היו דורסים
 * זה את זה. ה-hash גם הופך העלאה חוזרת לכתיבה לאותו מקום במקום
 * לעותק שני.
 */
export function storagePathFor(hash: string): string {
  return `${hash.slice(0, 2)}/${hash}.pdf`;
}

export async function uploadPdf(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const { error } = await client()
    .storage.from(RENEWALS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });

  if (error) throw new Error(`שמירת הקובץ נכשלה: ${error.message}`);
}

/**
 * קישור זמני לצפייה בקובץ המקורי.
 *
 * חתום ולתוקף קצר — הדלי פרטי, ולכן זו הדרך היחידה להציג את המסמך
 * במסך בלי לפתוח אותו לעולם.
 */
export async function signedUrl(
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const { data, error } = await client()
    .storage.from(RENEWALS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  return error ? null : data.signedUrl;
}

export async function deletePdf(path: string): Promise<void> {
  await client().storage.from(RENEWALS_BUCKET).remove([path]);
}
