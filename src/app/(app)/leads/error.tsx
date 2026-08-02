"use client";

import { Button, EmptyState } from "@/components/ui/primitives";

/**
 * גבול שגיאה למסך הלידים (קונבנציית `error.tsx` של Next App Router).
 *
 * למה זה קיים: עד עכשיו כשל בשליפת ה-RSC או ב-server action של `/leads`
 * פשוט לא רינדר כלום — המשתמש נשאר מול מסך ריק בלי שום דרך להתאושש.
 * הקובץ הזה תופס את השגיאה ומציג פאנל עם כפתור `reset()` שמנסה
 * לרנדר מחדש את המקטע שנכשל.
 */
export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // הודעת השגיאה עצמה לא מוצגת למשתמש — רק נרשמת לקונסול לצורך דיבוג.
  console.error("שגיאה בטעינת מסך הלידים:", error.digest ?? error.message);

  return (
    <div className="mx-auto flex max-w-[1600px] items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md rounded-card border border-line bg-surface-2">
        <EmptyState
          title="משהו השתבש בטעינת הלידים"
          body="נסה לרענן — אם זה חוזר, ספר לנו במסך המשוב."
          action={
            <Button variant="primary" onClick={reset}>
              נסה שוב
            </Button>
          }
        />
      </div>
    </div>
  );
}
