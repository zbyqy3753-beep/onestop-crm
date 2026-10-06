"use client";

import { useEffect } from "react";

import { btnPrimary } from "./ui/button";

/**
 * גבול שגיאה לדף הנחיתה (קונבנציית `error.tsx` של Next App Router).
 *
 * ⚠️ נפרד מזה של `/leads` **ובשפה של הדף**: `/lp` הוא הדף שמבקר חיצוני
 * רואה, ומסך השגיאה הגנרי של Next מפיל עליו קיר לבן באנגלית באמצע
 * השארת פרטים. הפעולה עצמה כבר מחזירה שגיאה מנומסת בתוך הטופס
 * (`actions.ts`); הקובץ הזה הוא רשת הביטחון לכל השאר — כשל ברינדור
 * ה-RSC, בטעינת הקטלוג, או חריגה שלא נתפסה.
 *
 * ⚠️ הכפתור קורא ל-`unstable_retry` ולא ל-`reset`. ב-Next 16 שני הפרופים
 * מועברים לגבול השגיאה, ולכן הגרסה עם `reset` התקמפלה בלי אזהרה
 * — אבל `reset` רק מנקה את מצב השגיאה ומרנדר מחדש את **אותו**
 * payload שכבר נכשל, בלי לשלוף אותו שוב. בכשל רשת חולף — בדיוק
 * המקרה שהכפתור נועד לו — הלחיצה החזירה מיד את אותו מסך,
 * לנצח. `unstable_retry` עוטף `router.refresh()` ואז מנקה — והוא מה
 * שהמסמכים מורים לכפתור "לנסות שוב".
 */
export default function LandingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // ההודעה עצמה לא מוצגת למבקר — היא שלנו, לקונסול.
  /*
   * ⚠️ ב-`useEffect` ולא בגוף הרינדור, כמו בדוגמה ב-`error.md` של
   * Next 16: בגוף זו תופעת לוואי ברינדור, וכל רינדור מחדש של הגבול
   * הדפיס שוב — ב-StrictMode פעמיים לכל שגיאה, ועוד שורה לכל
   * "לנסות שוב" שנכשל. `error.digest` הוא החוט היחיד שמקשר את המסך
   * הזה ללוג בייצור, ושורות כפולות הופכות אותו לאות רועש.
   */
  useEffect(() => {
    console.error("[lp] שגיאה בדף הנחיתה:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lp-card border border-lp-line bg-lp-surface-2 p-6 text-center">
        <p className="text-lg font-bold text-lp-ink">משהו השתבש בטעינת הדף</p>
        <p className="mt-2 text-sm text-lp-ink-2">
          נסו שוב — ואם זה חוזר, חייגו אלינו ונשמח לבדוק את החשבון שלכם ידנית.
        </p>
        <button type="button" onClick={unstable_retry} className={`${btnPrimary} mt-4 w-full py-3`}>
          לנסות שוב
        </button>
      </div>
    </main>
  );
}
