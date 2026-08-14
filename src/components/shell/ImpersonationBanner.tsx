"use client";

import { useEffect, useRef, useTransition } from "react";
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
  const ref = useRef<HTMLDivElement>(null);

  /*
   * מפרסם את הגובה בפועל כ-`--banner-h` על `<html>`.
   *
   * ⚠️ זה מה שמונע את ההתנגשות עם הסרגל העליון. שניהם `sticky top-0`
   * בתתי-עצים שונים, ושניהם נדבקים לאותה נקודה — הבאנר ב-`z-[60]`
   * ניצח, וברגע שמנהל מתחזה גלל, כותרת העמוד, אזהרת המנוי ומתג התמה
   * נעלמו לגמרי מאחוריו. עם המשתנה הזה `TopBar` נדבק **מתחת** לבאנר
   * (`top-[var(--banner-h,0px)]`), ו-`--chrome-h` שב-globals.css נגזר
   * ממנו במקום להיות מספר קשיח.
   *
   * ⚠️ `ResizeObserver` ולא מדידה חד-פעמית: הבאנר הוא `flex-wrap`
   * בכוונה, כי ב-360px השורה לא נכנסת. שבור הוא כמעט כפול בגובהו,
   * וכל ערך קבוע היה שגוי בדיוק במכשיר שבו הוא הכי חשוב.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty(
        "--banner-h",
        `${Math.round(entry.contentRect.height)}px`,
      );
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--banner-h");
    };
  }, []);

  return (
    // `flex-wrap` ו-`min-w-0`: בטלפון של 360px השורה הזו לא נכנסת
    // בשורה אחת, ובלי העטיפה הכפתור נדחק אל מחוץ למסך — כלומר הדרך
    // היחידה לצאת מהתחזות נעלמת דווקא במכשיר שבו קל לשכוח שאתה בתוכה
    //
    // הריפודים ב-`max()` הם ה-safe-area: זהו ה-chrome העליון ביותר
    // באפליקציה, ועם `viewportFit: cover` הוא נכנס מתחת למגרעת החיישנים
    // ולפינות המעוגלות — בדיוק על הכפתור שהוא הדרך היחידה החוצה.
    <div
      ref={ref}
      className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warn py-1.5 text-sm font-medium text-[#1a1200] ps-[max(1rem,env(safe-area-inset-right))] pe-[max(1rem,env(safe-area-inset-left))] pt-[max(0.375rem,env(safe-area-inset-top))]"
    >
      <Icon name="admin" size={15} />
      <span className="min-w-0 truncate">
        מחובר בתור <b>{impersonatedName}</b>
        <span className="opacity-70"> (אתה {realName})</span>
      </span>
      {/*
        ⚠️ `after:-inset-3` — הרחבת אזור המגע בלי להגדיל את הכפתור.

        חזותית הוא 22px גובה, הרבה מתחת ל-44px שדרושים לאגודל. להגדיל
        אותו ממש היה מנפח את הבאנר שיושב על כל מסך; הפסאודו מרחיב את
        השטח הלחיץ ל-~46px בלי לגעת בפריסה. זה אותו דפוס שכבר משמש
        בכפתור סגירת המודאל ובמתג התמה.

        חשוב במיוחד כאן: זו **הדרך היחידה** לצאת מהתחזות, וכל פעולה
        שנעשית בטעות בתוכה נרשמת על שם העובד.
      */}
      <button
        onClick={() => startExit(async () => stopImpersonationAction())}
        disabled={pending}
        className="relative rounded-md border border-[#1a1200]/30 px-2.5 py-0.5 text-xs font-semibold transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-[#1a1200]/10 active:scale-95"
      >
        {pending ? "חוזר…" : "חזרה לחשבון שלי"}
      </button>
    </div>
  );
}
