"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { inputClass } from "@/components/ui/primitives";
import {
  FROM_PARAM,
  PERIOD_LABEL,
  PERIOD_ORDER,
  PERIOD_PARAM,
  TO_PARAM,
  toDateInput,
  type Period,
  type PeriodKey,
} from "@/lib/domain/period";

/**
 * בורר התקופה.
 *
 * ⚠️⚠️ **הבורר כותב לכתובת ולא ל-state.** הטווח משנה מה נשלף בשרת
 * (`page.tsx` → `LeadFilter`), ולכן הוא חייב לשרוד רענון, ניווט חזרה,
 * ושיתוף קישור. state מקומי היה מציג טווח אחד בזמן שהנתונים שייכים
 * לאחר — בדיוק הסתירה שהמסך הזה נועד למנוע.
 *
 * ⚠️⚠️ **`openOutsideRange` הוא לב הרכיב, לא קישוט.**
 *
 * ברירת המחדל היא החודש הנוכחי. המשמעות: ב-1 בחודש, ליד פתוח מלפני
 * חודשיים נעלם מהתור — הוא לא נסגר ולא טופל, הוא פשוט מחוץ לחתך.
 * עובד שמסתמך על התור כדי לדעת מה לעשות היום לא יראה אותו לעולם.
 *
 * לכן המסך סופר במפורש כמה לידים פתוחים נשארו בחוץ, ואומר את זה
 * בקול עם קיצור להצגתם. **אל תסיר את זה** — בלעדיו זהו מסך שמסתיר
 * עבודה ומדווח שהכול תקין.
 */
export function PeriodPicker({
  period,
  openOutsideRange,
}: {
  period: Period;
  /** לידים פתוחים שנפלו מחוץ לטווח. 0 = אין מה להזהיר. */
  openOutsideRange: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  /** כותב פרמטרים לכתובת ומשאיר את כל השאר (חיפוש, מיון) על כנו. */
  const push = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    start(() => router.push(`?${q.toString()}`, { scroll: false }));
  };

  const setKey = (key: PeriodKey) =>
    push({ [PERIOD_PARAM]: key, [FROM_PARAM]: null, [TO_PARAM]: null });

  // בחירת תאריך הופכת את הטווח ל-custom ומשמרת את הצד השני
  const setBound = (which: "from" | "to", value: string) =>
    push({
      [PERIOD_PARAM]: "custom",
      [FROM_PARAM]:
        which === "from" ? value || null : toDateInput(period.from) || null,
      [TO_PARAM]:
        which === "to" ? value || null : toDateInput(period.to, true) || null,
    });

  return (
    <div className={`mb-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="me-0.5 flex items-center gap-1 text-xs text-ink-4">
          <Icon name="clock" size={14} />
          תקופה
        </span>

        {PERIOD_ORDER.map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            disabled={pending}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              period.key === k
                ? "border-brand bg-brand/10 font-medium text-brand"
                : "border-line text-ink-3 hover:bg-surface-2"
            }`}
          >
            {PERIOD_LABEL[k]}
          </button>
        ))}

        <span className="mx-1 hidden h-4 w-px bg-line sm:block" />

        {/*
          שני שדות תאריך גלויים תמיד ולא מאחורי כפתור "מותאם": הבחירה
          הזו היא בדיוק מה שהתבקש כאן ("עמודה שאפשר לבחור בה תאריכים"),
          והסתרתה מאחורי עוד קליק הופכת אותה למשהו שלא יודעים שקיים.
        */}
        <label className="flex items-center gap-1 text-xs text-ink-4">
          מ
          <input
            type="date"
            value={toDateInput(period.from)}
            onChange={(e) => setBound("from", e.target.value)}
            disabled={pending}
            className={`${inputClass} h-7 w-auto px-1.5 py-0 text-xs`}
            aria-label="מתאריך"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-ink-4">
          עד
          <input
            type="date"
            value={toDateInput(period.to, true)}
            onChange={(e) => setBound("to", e.target.value)}
            disabled={pending}
            className={`${inputClass} h-7 w-auto px-1.5 py-0 text-xs`}
            aria-label="עד תאריך"
          />
        </label>
      </div>

      {/*
        ⚠️ האזהרה מופיעה רק כשיש מה להזהיר, ומנוסחת כמספר ולא כטקסט
        כללי: "יש לידים ישנים" לא גורם לאף אחד ללחוץ, "7 לידים פתוחים
        מחוץ לטווח" כן.
      */}
      {openOutsideRange > 0 && period.key !== "all" && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-warn/30 bg-warn-soft px-3 py-1.5 text-xs text-warn">
          <span>
            <b className="nums">{openOutsideRange}</b> לידים פתוחים נמצאים
            מחוץ לטווח שנבחר ולא מוצגים כאן.
          </span>
          <button
            onClick={() => setKey("all")}
            disabled={pending}
            className="font-medium underline underline-offset-2"
          >
            הצג את כל הזמן
          </button>
        </p>
      )}
    </div>
  );
}
