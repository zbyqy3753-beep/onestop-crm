"use client";

import { btnPrimary } from "./ui/button";

/**
 * גבול שגיאה לדף הנחיתה (קונבנציית `error.tsx` של Next App Router).
 *
 * ⚠️ נפרד מזה של `/leads` **ובשפה של הדף**: `/lp` הוא הדף שמבקר חיצוני
 * רואה, ומסך השגיאה הגנרי של Next מפיל עליו קיר לבן באנגלית באמצע
 * השארת פרטים. הפעולה עצמה כבר מחזירה שגיאה מנומסת בתוך הטופס
 * (`actions.ts`); הקובץ הזה הוא רשת הביטחון לכל השאר — כשל ברינדור
 * ה-RSC, בטעינת הקטלוג, או חריגה שלא נתפסה.
 */
export default function LandingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // ההודעה עצמה לא מוצגת למבקר — היא שלנו, לקונסול.
  console.error("[lp] שגיאה בדף הנחיתה:", error.digest ?? error.message);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lp-card border border-lp-line bg-lp-surface-2 p-6 text-center">
        <p className="text-lg font-bold text-lp-ink">משהו השתבש בטעינת הדף</p>
        <p className="mt-2 text-sm text-lp-ink-2">
          נסו שוב — ואם זה חוזר, חייגו אלינו ונשמח לבדוק את החשבון שלכם ידנית.
        </p>
        <button type="button" onClick={reset} className={`${btnPrimary} mt-4 w-full py-3`}>
          לנסות שוב
        </button>
      </div>
    </main>
  );
}
