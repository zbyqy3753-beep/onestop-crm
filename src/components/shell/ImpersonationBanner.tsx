"use client";

import { useTransition } from "react";
import { stopImpersonationAction } from "@/app/(app)/admin/impersonation";
import { Icon } from "@/components/ui/Icon";

/**
 * הבאנר שמוצג כשבעלים מחובר בתור משתמש אחר.
 *
 * קבוע, בולט, ובכל מסך — בכוונה. הסכנה האמיתית של התחזות היא לשכוח
 * שאתה בתוכה: לשנות סטטוסים, למחוק לידים ולכתוב הערות כשכל פעולה
 * נרשמת על שם העובד. הבאנר הוא התזכורת המתמדת, והכפתור הוא הדרך
 * החוצה — תמיד לחיצה אחת, בלי סיסמה.
 */
export function ImpersonationBanner({
  impersonatedName,
  realName,
}: {
  impersonatedName: string;
  realName: string;
}) {
  const [pending, startExit] = useTransition();

  return (
    // `flex-wrap` ו-`min-w-0`: בטלפון של 360px השורה הזו לא נכנסת
    // בשורה אחת, ובלי העטיפה הכפתור נדחק אל מחוץ למסך — כלומר הדרך
    // היחידה לצאת מהתחזות נעלמת דווקא במכשיר שבו קל לשכוח שאתה בתוכה
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warn px-4 py-1.5 text-sm font-medium text-[#1a1200]">
      <Icon name="admin" size={15} />
      <span className="min-w-0 truncate">
        מחובר בתור <b>{impersonatedName}</b>
        <span className="opacity-70"> (אתה {realName})</span>
      </span>
      <button
        onClick={() => startExit(async () => stopImpersonationAction())}
        disabled={pending}
        className="rounded-md border border-[#1a1200]/30 px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-[#1a1200]/10 active:scale-95"
      >
        {pending ? "חוזר…" : "חזרה לחשבון שלי"}
      </button>
    </div>
  );
}
