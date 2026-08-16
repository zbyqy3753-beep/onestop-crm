import { EmptyState } from "@/components/ui/primitives";
import { date } from "@/lib/format";

/**
 * המסך היחיד של ספק לידים חיצוני: מה הוא הביא, ומתי.
 *
 * ⚠️ **רכיב שרת, ובלי `"use client"` — בכוונה.** אין כאן מצב, אין
 * אינטראקציה, ואין שום דבר שהדפדפן צריך לדעת עליו. המשמעות היא
 * שהנתונים מגיעים כ-HTML מוכן ולא כ-payload של React שאפשר לקרוא
 * ב-DevTools.
 *
 * ⚠️ **הטיפוס מקבל שם ותאריך בלבד, ולא `Lead`.** זה לא קמצנות אלא
 * הגבול עצמו: `Lead` נושא טלפון, אימייל, סטטוס, עלות רכישה ומזהה
 * המטפל, וכל אחד מהם היה זולג לדפדפן ברגע שמישהו יעביר לכאן את
 * האובייקט המלא "כי ככה יותר נוח". המרה לשדות האלה קורית בשרת,
 * ב-`leads/page.tsx`, לפני שמשהו עוזב אותו.
 */
export interface SupplierLeadRow {
  /** מפתח רינדור בלבד. **לא** מזהה הליד — ראה ההערה למעלה. */
  key: string;
  name: string;
  createdAt: string;
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
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="truncate font-medium text-ink-1">{row.name}</span>
              {/*
                `date` ולא `relative`: זמן יחסי ("לפני 3 שע׳") נגזר
                מ"עכשיו" ולכן לא מסכים בין שרת ללקוח, ומסך שרת טהור
                הוא בדיוק המקום שבו זה נשבר. ראה format.ts › relative.
              */}
              <span className="nums shrink-0 text-sm text-ink-3">
                {date(row.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
