import type { Metadata } from "next";
import { Field, inputClass, Button } from "@/components/ui/primitives";
import { submitRegistrationAction } from "./actions";

export const metadata: Metadata = {
  title: "הצטרפות כשותף | ONE STOP",
  robots: { index: false, follow: false },
};

/**
 * טופס ציבורי, בלי אימות ובלי מעטפת CRM (בכוונה מחוץ ל-route group
 * `(app)`, ראה `src/app/(app)/layout.tsx` — כך שאין כאן סרגל צד/עליון).
 *
 * Next.js 16: גם `params` וגם `searchParams` הם `Promise` — חובה `await`.
 */
export default async function PublicRegistrationForm(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { token } = await props.params;
  const { submitted, error } = await props.searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-pop sm:p-8">
        <div className="mb-6 text-center">
          <p className="font-display text-lg font-bold tracking-tight text-ink-1">
            ONE STOP
          </p>
          <h1 className="mt-1 text-sm text-ink-3">הצטרפות כבעל עסק שותף</h1>
        </div>

        {submitted === "1" ? (
          <div className="rounded-card border border-good/30 bg-good-soft px-4 py-6 text-center">
            <p className="font-semibold text-good">הפנייה נשלחה בהצלחה!</p>
            <p className="mt-1.5 text-sm text-ink-2">
              ניצור איתך קשר בהקדם. תודה שפנית ל-ONE STOP.
            </p>
          </div>
        ) : (
          <form action={submitRegistrationAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />

            {error && (
              <p className="rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
                {error}
              </p>
            )}

            <Field label="שם העסק">
              <input
                name="businessName"
                required
                minLength={2}
                className={inputClass}
                placeholder="לדוגמה: מובייל סנטר צפון"
              />
            </Field>

            <Field label="שם איש הקשר">
              <input
                name="contactName"
                required
                minLength={2}
                className={inputClass}
                placeholder="שם מלא"
              />
            </Field>

            <Field label="טלפון" hint="מספר ישראלי, מתחיל ב-0">
              <input
                name="phone"
                type="tel"
                required
                className={`${inputClass} ltr-num`}
                placeholder="050-1234567"
                dir="ltr"
              />
            </Field>

            <Field label="אימייל (לא חובה)">
              <input
                name="email"
                type="email"
                className={`${inputClass} ltr-num`}
                placeholder="business@example.co.il"
                dir="ltr"
              />
            </Field>

            <Button type="submit" variant="primary" className="w-full">
              שליחת פנייה
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
