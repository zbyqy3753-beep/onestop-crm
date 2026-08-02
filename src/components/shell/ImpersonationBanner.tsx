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
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warn px-4 py-1.5 text-sm font-medium text-[#1a1200]">
      <Icon name="admin" size={15} />
      <span>
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
