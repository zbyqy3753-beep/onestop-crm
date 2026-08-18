import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "שחזור סיסמה — ONE STOP CRM",
  robots: { index: false, follow: false },
};

/**
 * חי מחוץ ל-route group `(app)/`, כמו `/login` ו-`/set-password`: אין
 * כאן סרגל צד ואין סשן להישען עליו.
 *
 * ⚠️ **חייב להופיע ב-`PUBLIC_PREFIXES` של `proxy.ts`.** בלי זה השער
 * הסודי מחזיר 404 בדיוק למי שנעול בחוץ ומחפש דרך לחזור.
 */
export default function ForgotPasswordPage() {
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

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
