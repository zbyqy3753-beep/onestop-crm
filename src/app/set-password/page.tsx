import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { resetTarget } from "@/server/auth/passwordReset";

export const metadata: Metadata = {
  title: "קביעת סיסמה — ONE STOP CRM",
  robots: { index: false, follow: false },
};

/**
 * המסך שאליו מגיע עובד מהקישור החד-פעמי.
 *
 * חי מחוץ ל-route group `(app)/` בכוונה, כמו `/login`: אין כאן סרגל
 * צד, ואין סשן שאפשר להישען עליו — העובד מגיע לכאן דווקא כשאין לו
 * דרך להיכנס.
 *
 * ⚠️ **חייב להופיע ב-`PUBLIC_PREFIXES` של `proxy.ts`.** בלי זה השער
 * הסודי חוסם אותו, והקישור שנשלח בוואטסאפ מחזיר 404 — כשלון שנראה
 * כמו קישור שבור ולא כמו הגדרה חסרה.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : "";
  const target = await resetTarget(token);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="brand-rule mb-8 h-[3px] rounded-full" />

        <div className="mb-7 text-center">
          <p className="brand-word font-display text-[26px] font-bold leading-none tracking-tight">
            ONE STOP
          </p>
          <p className="mt-1.5 text-xs font-medium tracking-wide text-ink-4">
            CRM
          </p>
        </div>

        {target ? (
          <SetPasswordForm token={token} name={target.name} />
        ) : (
          /*
           * ⚠️ הודעה אחת לשלושת המקרים — פג, כבר נוצל, ולא קיים.
           * הפרדה ביניהם הייתה מאפשרת למי שמנחש טוקנים לגלות אילו
           * מהם אמיתיים. לעובד זה לא משנה: התשובה בכל המקרים היא
           * לבקש קישור חדש.
           */
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="font-semibold text-ink">הקישור אינו תקף</p>
            <p className="mt-2 text-sm text-ink-3">
              ייתכן שהוא פג, שכבר השתמשת בו, או שהועתק חלקית. בקש קישור חדש
              מהמנהל.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
            >
              למסך הכניסה
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
