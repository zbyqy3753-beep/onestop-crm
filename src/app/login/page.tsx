import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/server/auth/session";
import { NEXT_PARAM, safeReturnTo } from "@/lib/returnTo";

export const metadata: Metadata = {
  title: "כניסה — ONE STOP CRM",
  robots: { index: false, follow: false },
};

/**
 * חי מחוץ ל-route group `(app)/` בכוונה — הוא חייב לרנדר בלי
 * סרגל צד, בדיוק כמו `/form/[token]`.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams)[NEXT_PARAM];
  const next = safeReturnTo(typeof raw === "string" ? raw : null);

  // ⚠️ משתמש שכבר מחובר לא אמור לראות טופס התחברות. זה נראה כמו מקרה
  // קצה ובטלפון הוא שגרתי: `proxy.ts` מפנה לכאן על כל עוגייה חסרה,
  // והאפליקציה המותקנת נפתחת לפעמים לפני שהעוגייה נקראה.
  if (await getSessionUser()) redirect(next);

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

        <LoginForm next={next} />
      </div>
    </main>
  );
}
