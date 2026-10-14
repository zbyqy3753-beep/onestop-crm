"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { inputClass } from "@/components/ui/primitives";
import { useDetailsAutoClose } from "@/lib/overlay";
import { number } from "@/lib/format";
import {
  FROM_PARAM,
  PERIOD_LABEL,
  PERIOD_PARAM,
  TO_PARAM,
  periodLabel,
  toDateInput,
  type Period,
  type PeriodKey,
} from "@/lib/domain/period";

/**
 * לשונית חודש — "תיקייה" אחת בשורת החודשים.
 *
 * ⚠️ הכול כבר מחושב בשרת (`leads/page.tsx`): התווית, המספר, והאם היא
 * הנבחרת. כאן אין `Date.now()` — חישוב "החודש הנוכחי" בלקוח היה מסכים
 * עם השרת בכל רגע חוץ מבחצות של היום הראשון בחודש, ואז הלשוניות היו
 * זזות אחת הצידה בהידרציה.
 */
export interface MonthTab {
  /** `YYYY-MM-DD` — היום הראשון בחודש, לפרמטר `from` */
  from: string;
  /** `YYYY-MM-DD` — היום האחרון בחודש (כולל), לפרמטר `to` */
  to: string;
  /** "אוקטובר", או "דצמבר 2025" כשהשנה אינה השנה הנוכחית */
  label: string;
  /** לידים **חמים** שנכנסו בחודש — אותו מונה כמו "N לידים" בסיכום */
  count: number;
  /** החודש הנוכחי. נבחר דרך `thisMonth` — ברירת המחדל — ולא כטווח קבוע */
  current: boolean;
  /** זה הטווח שמוצג עכשיו */
  active: boolean;
}

/**
 * כל מה ששורת החודשים צריכה. נבנה ב-`leads/page.tsx` ועובר כמו שהוא —
 * נתונים בלבד, בלי פונקציות, כדי שיוכל לחצות את גבול השרת/לקוח.
 */
export interface PeriodNav {
  period: Period;
  /** מהחדש לישן — הנוכחי ראשון */
  months: MonthTab[];
  /** לידים חמים מכל הזמן — המספר על "הכל" */
  allCount: number;
  /** שם הטווח כשהוא אינו אחת הלשוניות ("30 יום אחרונים", "ינואר 2025") */
  otherLabel: string | null;
  /** הטווח מגיע עד היום — כלומר כל ליד פתוח שמחוצה לו ישן ממנו */
  reachesNow: boolean;
  /**
   * לידים פתוחים שמחוץ לטווח, לפי סוג. ראה `page.tsx` — הפיצול קיים כדי
   * שהמספר על האזהרה יהיה בדיוק מה שיופיע בלחיצה עליה.
   */
  openOutside: { hot: number; data: number };
}

/** תקופות מהירות בתוך "תקופה אחרת" — מה שלשוניות החודשים לא מכסות. */
const OTHER_KEYS: PeriodKey[] = ["last30", "thisYear"];

/**
 * צ׳יפ של המקור — אותן מחלקות בדיוק כמו התצוגות המהירות (`QueueHeader`),
 * כדי ששתי שורות הצ׳יפים במסך ייראו כמשפחה אחת.
 *
 * `min-h-11` בטלפון ו-`active:` ולא רק `hover:` — ראה התצוגות המהירות.
 */
function chip(on: boolean): string {
  return `inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors active:scale-95 lg:min-h-0 lg:active:scale-100 ${
    on
      ? "border-brand bg-brand text-on-brand"
      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1"
  }`;
}

/**
 * בורר התקופה — שורת "תיקיות" של חודשים, עם מונה לכל חודש.
 *
 * ⚠️⚠️ **הבורר כותב לכתובת ולא ל-state.** הטווח משנה מה נשלף בשרת
 * (`page.tsx` → `LeadFilter`), ולכן הוא חייב לשרוד רענון, ניווט חזרה,
 * ושיתוף קישור. state מקומי היה מציג טווח אחד בזמן שהנתונים שייכים
 * לאחר — בדיוק הסתירה שהמסך הזה נועד למנוע.
 *
 * לשוניות החודשים משתמשות **באותם פרמטרים בדיוק** שהיו קיימים: החודש
 * הנוכחי הוא `thisMonth`, וכל חודש אחר הוא `custom` עם היום הראשון
 * והאחרון שלו. אין כאן מנגנון חדש, רק פנים חדשות למנגנון הקיים.
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
  nav,
  openOutsideRange,
  onReveal,
}: {
  nav: PeriodNav;
  /**
   * לידים פתוחים שנפלו מחוץ לטווח. 0 = אין מה להזהיר.
   *
   * ⚠️ זה המספר **שיוצג**, והקורא אחראי שיתאים למה שהלחיצה מראה —
   * ראה `LeadsClient` › `openOutsideCount`.
   */
  openOutsideRange: number;
  /**
   * נקרא כשלוחצים על האזהרה, **בנוסף** למעבר ל"כל הזמן".
   *
   * ⚠️ מעבר תקופה לבדו לא מספיק: המסך נפתח מסונן ל"חדשים", וליד
   * ישן שכבר עבר ל"אין מענה" היה נשאר מוסתר גם בכל הזמן. הקורא מנקה
   * כאן את מסנן הסטטוס כדי שהלידים שהאזהרה ספרה באמת יופיעו.
   */
  onReveal?: () => void;
}) {
  const { period } = nav;
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const otherRef = useRef<HTMLDetailsElement>(null);
  useDetailsAutoClose(otherRef);

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

  const setMonth = (m: MonthTab) =>
    m.current
      ? setKey("thisMonth")
      : push({ [PERIOD_PARAM]: "custom", [FROM_PARAM]: m.from, [TO_PARAM]: m.to });

  /** "תקופה אחרת" נסגר אחרי בחירה — אחרת הוא נשאר פתוח מעל התוצאה */
  const pickOther = (key: PeriodKey) => {
    otherRef.current?.removeAttribute("open");
    setKey(key);
  };

  const reveal = () => {
    onReveal?.();
    setKey("all");
  };

  /*
    ⚠️ חודש ריק לא מוצג — חוץ מהנוכחי ומהנבחר. שש לשוניות שחצין "0"
    הן רעש שדוחף את החודשים שיש בהם עבודה מחוץ למסך בטלפון. הנוכחי
    נשאר כי הוא ברירת המחדל (ובבוקר ה-1 בחודש הוא ריק ועדיין הנכון),
    והנבחר נשאר כי לשונית שנעלמת מתחת לאצבע אחרי הלחיצה היא מסך
    שלא אומר איזה חתך הוא מציג.
  */
  const months = nav.months.filter((m) => m.count > 0 || m.current || m.active);

  const onTab = period.key === "all" || nav.months.some((m) => m.active);
  // הטווח הנוכחי, כשאינו אחת הלשוניות — מוצג על "תקופה אחרת" עצמו,
  // כדי שתמיד יהיה כתוב על המסך איזה חתך מוצג
  const otherLabel = onTab ? null : (nav.otherLabel ?? periodLabel(period));

  const outsideLabel = nav.reachesNow
    ? "לידים פתוחים מחודשים קודמים לא מוצגים כאן."
    : "לידים פתוחים נמצאים מחוץ לטווח שנבחר ולא מוצגים כאן.";

  /** שדה תאריך אחד — אותו שדה בשולחן (גלוי) ובטלפון (בתוך הפופאובר). */
  const dateInput = (which: "from" | "to", className: string) => (
    <input
      type="date"
      aria-label={which === "from" ? "מתאריך" : "עד תאריך"}
      value={which === "from" ? toDateInput(period.from) : toDateInput(period.to, true)}
      onChange={(e) => setBound(which, e.target.value)}
      disabled={pending}
      className={className}
    />
  );

  return (
    <div className={`mb-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        {/*
          ⚠️ `scroll-x-cue` — שישה חודשים ועוד "הכל" הם ~700px, ובטלפון
          הם יושבים ב-~290px. בלי הרמז אין שום סימן שיש עוד חודשים מעבר
          לקצה (פס הגלילה במגע מופיע רק תוך כדי גלילה).

          `min-w-0 flex-1`: בסיס 0 משאיר את הרצועה באותה שורה עם "תקופה
          אחרת" בטלפון, במקום לשבור אותה לשורה משלה.
        */}
        <div
          role="group"
          aria-label="תקופה"
          className="scroll-thin scroll-x-cue -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5"
        >
          {/*
            "הכל" ראשון, לפני החודשים: זה החתך הרחב ביותר, וכך הוא גלוי
            גם בטלפון, שבו סוף הרצועה מחוץ למסך.
          */}
          <button
            type="button"
            onClick={() => setKey("all")}
            disabled={pending}
            aria-pressed={period.key === "all"}
            className={chip(period.key === "all")}
          >
            הכל
            <Count value={nav.allCount} />
          </button>

          {months.map((m) => (
            <button
              key={m.from}
              type="button"
              onClick={() => setMonth(m)}
              disabled={pending}
              aria-pressed={m.active}
              className={chip(m.active)}
            >
              {m.label}
              <Count value={m.count} />
            </button>
          ))}
        </div>

        {/*
          "תקופה אחרת" — 30 יום והשנה, ובטלפון גם שדות התאריך.

          ⚠️ מחוץ לרצועה הנגללת ולא בסופה: פאנל צף בתוך `overflow-x-auto`
          נחתך בקצה הרצועה. בטלפון אייקון בלבד — הלשוניות מקבלות את רוב
          הרוחב — אלא אם הטווח המוצג הוא "אחר", ואז שמו כתוב עליו.
        */}
        <details ref={otherRef} className="relative shrink-0">
          <summary
            aria-label={otherLabel ? `תקופה: ${otherLabel}` : "תקופה אחרת"}
            title={otherLabel ?? "תקופה אחרת"}
            className={`${chip(otherLabel !== null)} min-w-11 cursor-pointer list-none justify-center [&::-webkit-details-marker]:hidden`}
          >
            <Icon name="calendar" size={15} />
            {otherLabel ? (
              <span className="max-w-36 truncate">{otherLabel}</span>
            ) : (
              <span className="max-lg:sr-only">תקופה אחרת</span>
            )}
            <Icon name="chevronDown" size={13} className="max-lg:hidden" />
          </summary>

          {/* `max-w` — שלא יחרוג מהמסך בטלפון של 360px */}
          <div className="absolute end-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface p-3 shadow-pop">
            {/* בטלפון שדות התאריך יושבים כאן — ראה ההערה על הגרסה הגלויה */}
            <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
              <label className="text-xs text-ink-4">
                מתאריך
                {dateInput("from", `${inputClass} mt-1`)}
              </label>
              <label className="text-xs text-ink-4">
                עד תאריך
                {dateInput("to", `${inputClass} mt-1`)}
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OTHER_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickOther(k)}
                  disabled={pending}
                  aria-pressed={period.key === k}
                  className={chip(period.key === k)}
                >
                  {PERIOD_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        </details>

        {/*
          ⚠️ בשולחן שני שדות תאריך **גלויים תמיד** ולא מאחורי "תקופה
          אחרת": הבחירה הזו היא בדיוק מה שהתבקש כאן ("עמודה שאפשר לבחור
          בה תאריכים"), והסתרתה מאחורי עוד קליק הופכת אותה למשהו שלא
          יודעים שקיים.

          בטלפון הם בתוך "תקופה אחרת": כשורה משלהם הם דחפו את הכרטיס
          הראשון עוד 56px למטה. CSS ולא `useIsNarrow` — שני שדות קלט, לא
          טבלה, ואין כאן רינדור כפול יקר.

          כל שדה עטוף ברוחב קבוע, ולא `w-auto` על השדה: `inputClass` נושא
          `w-full`, וב-Tailwind 4 מי שגובר נקבע לפי הסדר בקובץ ה-CSS ולא
          לפי הסדר ב-className.
        */}
        <div className="flex shrink-0 items-center gap-2 text-xs text-ink-4 max-lg:hidden">
          <label className="flex items-center gap-1">
            מ
            <span className="block w-36">
              {dateInput("from", `${inputClass} h-7 px-1.5 py-0 text-xs`)}
            </span>
          </label>
          <label className="flex items-center gap-1">
            עד
            <span className="block w-36">
              {dateInput("to", `${inputClass} h-7 px-1.5 py-0 text-xs`)}
            </span>
          </label>
        </div>
      </div>

      {/*
        ⚠️ האזהרה מופיעה רק כשיש מה להזהיר, ומנוסחת כמספר ולא כטקסט
        כללי: "יש לידים ישנים" לא גורם לאף אחד ללחוץ, "7 לידים פתוחים
        מחוץ לטווח" כן. בשורה משלה ולא בסוף רצועת החודשים — שם היא
        הייתה מחוץ למסך בטלפון, כלומר אזהרה שאיש לא רואה.
      */}
      {openOutsideRange > 0 && period.key !== "all" && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-card border border-warn/30 bg-warn-soft px-3 py-1.5 text-xs text-warn">
          <Icon name="alert" size={14} className="shrink-0" />
          <span>
            <b className="nums">{number(openOutsideRange)}</b> {outsideLabel}
          </span>
          <button
            type="button"
            onClick={reveal}
            disabled={pending}
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-2 lg:min-h-0"
          >
            הצג את כל הזמן
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * המונה שעל הלשונית. `opacity` ולא צבע משלו — כך הוא קריא גם על הצ׳יפ
 * הנבחר (כחול מלא) וגם על הלבן, בלי להוסיף צבע למסך.
 */
function Count({ value }: { value: number }) {
  return <span className="nums text-xs font-semibold opacity-70">{number(value)}</span>;
}
