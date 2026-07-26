import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "כניסה — ONE STOP CRM",
  robots: { index: false, follow: false },
};

/**
 * חי מחוץ ל-route group `(app)/` בכוונה — הוא חייב לרנדר בלי
 * סרגל צד, בדיוק כמו `/form/[token]`.
 */
export default function LoginPage() {
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

        <LoginForm />

        <p className="mt-6 text-center text-xs text-ink-4">
          גרסת בדיקה — האימות עדיין לא מחובר.
        </p>
      </div>
    </main>
  );
}
