import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { toLoginEmail } from "@/lib/loginId";
import { hasOpenReset } from "@/server/auth/resetCode";

export const metadata: Metadata = {
  title: "קביעת סיסמה — ONE STOP CRM",
  robots: { index: false, follow: false },
};

/**
 * מסך קביעת הסיסמה אחרי איפוס יזום.
 *
 * ⚠️ **אין לכאן קישור משום מקום, ובכוונה.** מגיעים אליו רק דרך מסך
 * הכניסה: עובד שההנהלה איפסה לו את הסיסמה מנסה להיכנס, נכשל, ו-
 * `signIn` מזהה שממתין לו איפוס ומעביר אותו לכאן עם שם המשתמש.
 *
 * ⚠️ הזכאות נבדקת **גם כאן ולא רק ב-`signIn`**. הכתובת גלויה ואפשר
 * להקליד אותה עם כל `?u=` שרוצים; בלי הבדיקה הזו היא הייתה חוזרת
 * להיות נקודת קצה פתוחה שכל אחד מפעיל בה וואטסאפ לעובד.
 *
 * ⚠️ **חייב להופיע ב-`PUBLIC_PREFIXES` של `proxy.ts`** — מי שמגיע
 * לכאן הוא בדיוק מי שאין לו סשן.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).u;
  const loginId = typeof raw === "string" ? raw.trim() : "";
  const entitled = loginId ? await hasOpenReset(toLoginEmail(loginId)) : false;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="brand-rule mb-8 h-[3px] rounded-full" />

        <div className="mb-7 text-center">
          <p className="brand-word font-display text-[26px] font-bold leading-none tracking-tight">
            ONE STOP
          </p>
          <p className="mt-1.5 text-xs font-medium tracking-wide text-ink-4">CRM</p>
        </div>

        {entitled ? (
          <ForgotPasswordForm loginId={loginId} />
        ) : (
          /*
           * ⚠️ אותה הודעה למי שלא אופס, למי שהאיפוס שלו כבר נוצל,
           * ולמי שהמציא שם משתמש. שלושתם מקבלים "פנה למנהל" — הפרדה
           * ביניהם הייתה מגלה מי קיים במערכת ומי ממתין לאיפוס.
           */
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="font-semibold text-ink">אין כאן מה לעשות</p>
            <p className="mt-2 text-sm text-ink-3">
              המסך הזה נפתח רק כשההנהלה מאפסת סיסמה. אם אינך מצליח להיכנס — פנה
              למנהל.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
            >
              חזרה לכניסה
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
