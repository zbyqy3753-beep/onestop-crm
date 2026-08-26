import Link from "next/link";

import { EmptyState } from "@/components/ui/primitives";
import { date, dateTime, number, TONE_CLASS, TONE_SOFT_VAR, TONE_VAR } from "@/lib/format";
import { STATUS_CONFIG, STATUS_ORDER, type LeadStatus } from "@/lib/domain/types";

/**
 * המסך היחיד של ספק לידים חיצוני: מה הוא הביא, למי, ומה עלה בגורלו.
 *
 * ⚠️ **רכיב שרת, ובלי `"use client"` — בכוונה.** אין כאן מצב, אין
 * אינטראקציה, ואין שום דבר שהדפדפן צריך לדעת עליו. המשמעות היא
 * שהנתונים מגיעים כ-HTML מוכן ולא כ-payload של React שאפשר לקרוא
 * ב-DevTools.
 *
 * ⚠️ **הטיפוס מונה שדות מפורשים, ולא מקבל `Lead`.** הרשימה כאן
 * (שם, טלפון, סטטוס, הערות, תאריך) היא בדיוק מה שהוסכם שספק רואה;
 * `Lead` נושא מעבר לזה גם אימייל, עלות רכישה, מזהה המטפל והיסטוריית
 * סטטוסים מלאה — וכל אחד מהם היה זולג לדפדפן ברגע שמישהו יעביר
 * לכאן את האובייקט המלא "כי ככה יותר נוח". ההמרה קורית בשרת,
 * ב-`leads/page.tsx`, לפני שמשהו עוזב אותו.
 *
 * ⚠️ **ההערות מגיעות כטקסט ותאריך, בלי `authorId`.** הספק אמור לדעת
 * מה נאמר על הליד שלו, לא מי מהצוות אמר את זה — מזהי עובדים הם
 * המפתח לכל Server Action במערכת, ולספק אין בהם שום שימוש לגיטימי.
 *
 * ⚠️ **"הערה" כאן היא גם פירוט של שינוי סטטוס.** רוב מה שעובד כותב
 * נכנס לתיבת הפירוט של הסטטוס ולא להערה חופשית; המיזוג של שני
 * המקורות קורה בשרת, ב-`teamNotes` שב-`leads/page.tsx`.
 */
export interface SupplierLeadRow {
  /** מפתח רינדור בלבד. **לא** מזהה הליד — ראה ההערה למעלה. */
  key: string;
  name: string;
  phone: string;
  status: LeadStatus;
  createdAt: string;
  /**
   * הערות הצוות על הליד, מהישנה לחדשה. טקסט, תאריך, ו-`status` —
   * הסטטוס שאליו הליד עבר כשההערה נכתבה, כשהיא הגיעה משינוי סטטוס.
   * `undefined` = הערה חופשית שאינה קשורה למעבר.
   */
  notes: { body: string; createdAt: string; status?: LeadStatus }[];
}

export function SupplierLeadsList({
  supplierName,
  rows,
  counts,
  active,
}: {
  supplierName: string;
  rows: SupplierLeadRow[];
  /**
   * כמה לידים בכל סטטוס — **מכלל הלידים של הספק**, לא מהחתך המוצג.
   *
   * ⚠️ קוביה שמתאפסת ברגע שלוחצים עליה היא קוביה שאי אפשר לחזור ממנה.
   * לכן הספירה נשלפת בלי מסנן הסטטוס, ראה `leads/page.tsx`.
   */
  counts: Record<LeadStatus, number>;
  /** הסטטוס שמסונן כרגע, מה-URL. `null` = הכל. */
  active: LeadStatus | null;
}) {
  /*
   * ⚠️ רק סטטוסים שיש בהם לידים. לספק אין מה לעשות עם 19 השלבים
   * הפנימיים של המוקד — "אין מענה 2" ו"נמכר ע״י משווק מקביל" הם אוצר
   * מילים של הצוות, וקוביה ריקה שלהם היא רעש במסך שכל תפקידו לענות על
   * "מה קרה למה שהבאתי".
   */
  const shown = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0);
  const total = shown.reduce((sum, s) => sum + counts[s], 0);
  const activeLabel = active ? STATUS_CONFIG[active].label : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <header className="mb-4">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink-1">
          הלידים שלי
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {supplierName} ·{" "}
          {activeLabel ? (
            <>
              <span className="nums">{number(rows.length)}</span> מתוך{" "}
              <span className="nums">{number(total)}</span> לידים ·{" "}
              <span className="text-ink-2">{activeLabel}</span>
            </>
          ) : (
            <>
              <span className="nums">{number(total)}</span>{" "}
              {total === 1 ? "ליד" : "לידים"} במערכת
            </>
          )}
        </p>
      </header>

      {/*
        ⚠️ **קישורים, לא כפתורים.** המסך הזה הוא רכיב שרת בכוונה (ראה
        ההערה בראש הקובץ), וסינון דרך ה-URL הוא הדרך היחידה להוסיף לו
        סינון בלי להפוך אותו לרכיב לקוח שנושא payload.

        מוצג רק כשיש יותר מסטטוס אחד — סרגל סינון עם אפשרות אחת הוא
        פקד שלוחצים עליו, לא רואים שינוי, ומפסיקים להאמין לו.
      */}
      {shown.length > 1 && (
        <nav
          className="mb-5 grid grid-cols-3 gap-1.5 sm:grid-cols-4"
          aria-label="סינון לפי סטטוס"
        >
          <Link
            href="/leads"
            aria-current={active ? undefined : "true"}
            className={`relative block rounded-card border bg-surface-2 py-1.5 pe-2 ps-2.5 text-start transition-all active:scale-95 ${
              active
                ? "border-transparent hover:brightness-105"
                : "border-brand bg-brand-soft"
            }`}
          >
            <span
              className="nums block text-base font-bold leading-none"
              style={{ color: active ? "var(--c-ink-2)" : "var(--c-brand)" }}
            >
              {number(total)}
            </span>
            <span
              className={`mt-0.5 block truncate text-[11px] ${
                active ? "text-ink-2" : "text-brand"
              }`}
            >
              הכל
            </span>
          </Link>

          {shown.map((status) => {
            const meta = STATUS_CONFIG[status];
            const on = active === status;
            return (
              <Link
                key={status}
                // לחיצה על הסטטוס הפעיל מנקה — אותה מחווה כמו בקוביות
                // של המוקד, ובלי זה "הכל" הוא המילוט היחיד
                href={on ? "/leads" : `/leads?status=${status}`}
                aria-current={on ? "true" : undefined}
                title={`${meta.label} — ${counts[status]}`}
                style={
                  {
                    "--spine-c": TONE_VAR[meta.tone],
                    "--spine-w": "4px",
                    ...(on ? {} : { background: TONE_SOFT_VAR[meta.tone] }),
                  } as React.CSSProperties
                }
                className={`spine relative block min-w-0 rounded-card border py-1.5 pe-2 ps-2.5 text-start transition-all active:scale-95 ${
                  on
                    ? "border-brand bg-brand-soft"
                    : "border-transparent hover:brightness-105"
                }`}
              >
                <span
                  className="nums block text-base font-bold leading-none"
                  style={{ color: on ? "var(--c-brand)" : TONE_VAR[meta.tone] }}
                >
                  {number(counts[status])}
                </span>
                {/* truncate: "נמכר ע״י משווק מקביל" היה מותח את הקוביה
                    שלו לרוחב שלוש אחרות */}
                <span
                  className={`mt-0.5 block truncate text-[11px] ${
                    on ? "text-brand" : "text-ink-2"
                  }`}
                >
                  {meta.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          {active ? (
            /*
              ⚠️ "עדיין לא התקבלו לידים" בתוך חתך הוא שקר: יש לידים, הם
              פשוט בסטטוס אחר. מצב ריק שמכחיש נתונים קיימים הוא הדרך
              המהירה ביותר לגרום למישהו לחשוב שמשהו נמחק.
            */
            <EmptyState
              title={`אין לידים בסטטוס "${activeLabel}"`}
              body="נסה סטטוס אחר, או חזור לרשימה המלאה."
              action={
                <Link
                  href="/leads"
                  className="text-sm font-medium text-brand underline underline-offset-2"
                >
                  הצג את כל הלידים
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="עדיין לא התקבלו לידים"
              body="לידים שיישלחו למערכת יופיעו כאן."
            />
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((row) => {
            const status = STATUS_CONFIG[row.status];
            return (
              <li key={row.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-1">
                      {row.name}
                    </div>
                    {/*
                      `tel:` ולא טקסט בלבד: המסך הזה נפתח כמעט תמיד
                      בטלפון, והמספר הוא הדבר היחיד כאן שיש מה לעשות
                      איתו. `dir="ltr"` כי מספר בתוך פסקה RTL מוצג
                      עם הקידומת בצד הלא נכון.
                    */}
                    <a
                      href={`tel:${row.phone}`}
                      dir="ltr"
                      className="nums mt-0.5 inline-block text-sm text-ink-2 underline-offset-2 hover:text-ink-1 hover:underline"
                    >
                      {row.phone}
                    </a>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[status.tone]}`}
                    >
                      {status.label}
                    </span>
                    {/*
                      `date` ולא `relative`: זמן יחסי ("לפני 3 שע׳")
                      נגזר מ"עכשיו" ולכן לא מסכים בין שרת ללקוח, ומסך
                      שרת טהור הוא בדיוק המקום שבו זה נשבר.
                      ראה format.ts › relative.
                    */}
                    <span className="nums text-xs text-ink-3">
                      {date(row.createdAt)}
                    </span>
                  </div>
                </div>

                {row.notes.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
                    {row.notes.map((note, i) => (
                      <li key={i} className="text-sm text-ink-2">
                        {/*
                          הסטטוס שקדם להערה, כשיש — "מחר ב-10" בלי לדעת
                          שזה נכתב במעבר ל"חיזור" הוא חצי משפט. הערה
                          חופשית נשארת בלי תגית: אין לה שלב להצמיד אליו.
                        */}
                        {note.status && (
                          <span
                            className="me-1.5 text-xs font-medium"
                            style={{
                              color: TONE_VAR[STATUS_CONFIG[note.status].tone],
                            }}
                          >
                            {STATUS_CONFIG[note.status].label}
                          </span>
                        )}
                        <span className="whitespace-pre-wrap">{note.body}</span>
                        <span className="nums mr-2 text-xs text-ink-3">
                          {dateTime(note.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
