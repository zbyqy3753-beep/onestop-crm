"use client";

import { useEffect } from "react";

import { Button, EmptyState } from "@/components/ui/primitives";

/**
 * גבול שגיאה למסך הלידים (קונבנציית `error.tsx` של Next App Router).
 *
 * למה זה קיים: עד עכשיו כשל בשליפת ה-RSC או ב-server action של `/leads`
 * פשוט לא רינדר כלום — המשתמש נשאר מול מסך ריק בלי שום דרך להתאושש.
 * הקובץ הזה תופס את השגיאה ומציג פאנל עם כפתור ששולף מחדש את
 * המקטע שנכשל.
 *
 * ⚠️ `unstable_retry` ולא `reset`: ב-Next 16 שני הפרופים מועברים לגבול
 * השגיאה ולכן הגרסה עם `reset` התקמפלה בלי אזהרה, אבל `reset` רק
 * מנקה את מצב השגיאה ומרנדר מחדש את **אותו** payload שכבר נכשל —
 * לכן "נסה שוב" החזיר מיד את אותה שגיאה במקום לשלוף מחדש.
 */
export default function LeadsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // הודעת השגיאה עצמה לא מוצגת למשתמש — רק נרשמת לקונסול לצורך דיבוג.
  /*
   * ⚠️ ב-`useEffect` ולא בגוף הרינדור, כמו בדוגמה ב-`error.md` של
   * Next 16: בגוף זו תופעת לוואי ברינדור, וכל רינדור מחדש של הגבול
   * הדפיס שוב — ב-StrictMode פעמיים לכל שגיאה, ועוד שורה לכל
   * "לנסות שוב" שנכשל. `error.digest` הוא החוט היחיד שמקשר את המסך
   * הזה ללוג בייצור, ושורות כפולות הופכות אותו לאות רועש.
   */
  useEffect(() => {
    console.error("שגיאה בטעינת מסך הלידים:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[1600px] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-card border border-line bg-surface-2">
        <EmptyState
          title="משהו השתבש בטעינת הלידים"
          body="נסה לרענן — אם זה חוזר, ספר לנו במסך המשוב."
          action={
            <Button variant="primary" onClick={unstable_retry}>
              נסה שוב
            </Button>
          }
        />
      </div>
    </div>
  );
}
