import { EmptyState } from "@/components/ui/primitives";
import { date, dateTime, TONE_CLASS } from "@/lib/format";
import { STATUS_CONFIG, type LeadStatus } from "@/lib/domain/types";

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
 */
export interface SupplierLeadRow {
  /** מפתח רינדור בלבד. **לא** מזהה הליד — ראה ההערה למעלה. */
  key: string;
  name: string;
  phone: string;
  status: LeadStatus;
  createdAt: string;
  /** הערות הצוות על הליד, מהישנה לחדשה. טקסט ותאריך בלבד. */
  notes: { body: string; createdAt: string }[];
}

export function SupplierLeadsList({
  supplierName,
  rows,
}: {
  supplierName: string;
  rows: SupplierLeadRow[];
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink-1">
          הלידים שלי
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {supplierName} · {rows.length}{" "}
          {rows.length === 1 ? "ליד" : "לידים"} במערכת
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            title="עדיין לא התקבלו לידים"
            body="לידים שיישלחו למערכת יופיעו כאן."
          />
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
