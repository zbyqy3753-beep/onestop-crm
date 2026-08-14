"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, inputClass } from "@/components/ui/primitives";

/** אין דבר להירשם עליו — ה-origin לא משתנה תוך כדי חיי העמוד. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): string {
  return window.location.origin;
}

/** מה שהשרת "רואה" — לא קיים origin, ולכן `null` עד שהלקוח נרשם. */
function getServerSnapshot(): null {
  return null;
}

/**
 * מציג את קישור ההפניה האישי של המשתמש הנוכחי (`/form/user_<id>`)
 * ומאפשר העתקה ללוח.
 *
 * ה-origin לא ידוע בשרת (ולא רלוונטי — זה קישור לצד הלקוח). נקרא דרך
 * `useSyncExternalStore` ולא `useState`+`useEffect`, באותה רוח כמו
 * `useNow()` ב-`src/lib/clock.ts` — כך ה-render הראשון בשרת ובלקוח
 * מסכימים ואין אי-התאמת הידרציה.
 */
export function CopyReferralLink({ userId }: { userId: string }) {
  const origin = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [copied, setCopied] = useState(false);

  const link = origin ? `${origin}/form/user_${userId}` : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // אין הרשאת לוח גזירה — לא קריטי, המשתמש יכול לסמן ידנית
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5">
      <span className="shrink-0 text-xs font-medium text-ink-2">
        קישור הפניה אישי
      </span>
      <input
        readOnly
        value={link || "טוען…"}
        onFocus={(e) => e.target.select()}
        aria-label="קישור הפניה אישי"
        className={`${inputClass} ltr-num min-w-0 flex-1 sm:min-w-[220px]`}
      />
      <Button variant="secondary" onClick={copy} disabled={!link}>
        {copied ? "הועתק!" : "העתקה"}
      </Button>
    </div>
  );
}
