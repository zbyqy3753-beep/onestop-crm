"use client";

import { useState } from "react";
import { Card } from "./Card";
import { ProviderLogo } from "./ProviderLogo";
import { LeadForm } from "./LeadForm";
import { MAX_COMPARE } from "./CompareTray";
import { cardStats, detailRows, discountIsCapped, shekels } from "../catalog/format";
import { familyPriceOnly, requiresMultipleLines } from "../catalog/savings";
import type { Package } from "../catalog/types";

/*
 * ⚠️ שני דברים ירדו מהעותק של האתר הציבורי, ושניהם לא "ניקוי":
 *
 * 1. `<Link href={`/p/${pkg.slug}`}>` על שם החבילה. עמודי החבילה
 *    (`/p/[slug]`) קיימים רק באתר הציבורי; כאן הם 404. שם החבילה נשאר
 *    טקסט — "פרטים מלאים" למטה כבר פותח את מה שהקישור היה מראה.
 * 2. כפתור הוואטסאפ, שנשען על `ContactProvider` עם המספר של המוקד.
 *    לדף הזה אין מספר מוגדר, וכפתור שמוביל למספר שגוי גרוע מכפתור
 *    שאינו קיים. הליד נשאר הערוץ היחיד — וזה גם מה שמבטיח שכל פנייה
 *    מהדף מגיעה לאלירן ולא לתיבה כללית.
 */

interface Props {
  pkg: Package;
  compareChecked?: boolean;
  /** מגש ההשוואה מלא — תיבה שאינה מסומנת לא תוכל להוסיף עוד. */
  compareFull?: boolean;
  onCompareToggle?: (pkg: Package) => void;
  /** Detail pages already show everything, so they render the card expanded. */
  defaultOpen?: boolean;
  /**
   * תקרת ההשוואה. המגש מדפיס `(n/max)` מהקבוע; התיבה כאן הכריזה "4"
   * כמחרוזת, וזה הטקסט היחיד שמסביר למשתמש מקלדת למה כל התיבות יצאו
   * מסדר ה-Tab — שני המספרים חייבים לבוא מאותו מקור.
   */
  compareMax?: number;
}

export function PackageCard({
  pkg,
  compareChecked,
  compareFull = false,
  onCompareToggle,
  defaultOpen = false,
  compareMax = MAX_COMPARE,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [formOpen, setFormOpen] = useState(false);

  const stats = cardStats(pkg);
  const rows = detailRows(pkg);
  const isElectric = pkg.category === "electricity";

  // The whole point of the site: when the price jumps after the promo, say so
  // on the card rather than in the small print.
  /*
   * ⚠️ `> 0` ולא `!= null`, בדיוק כמו `isMoney` ב-`catalog.ts`. הקטלוג
   * נכנס דרך `as unknown as Catalog` ואין ולידציה בזמן ריצה, ו-`0` הוא
   * מה שהמחלץ כותב כשלא קרא מספר — `price: 0` כבר קיים בקטלוג (ids 18,
   * 22) ונעצר ב-`isListable`. לשדה הזה לא היה שער מקביל, ולכן
   * `priceAfterPromo: 0` היה מודפס כ-"אחרי תום ההטבה: ₪0 לחודש" —
   * הבטחה שהחבילה נעשית חינם. עכשיו הוא נופל לענף ההערה המילולית,
   * שאומרת מה שהרשומה באמת מסרה.
   */
  const rise =
    !isElectric && typeof pkg.priceAfterPromo === "number" && pkg.priceAfterPromo > 0
      ? pkg.priceAfterPromo
      : null;
  const riseNote = !isElectric ? pkg.priceAfterPromoNote : null;

  /*
   * ⚠️ מחיר שמותנה בכמות מנויים אינו מחיר חודשי שטוח. `savings.ts` כבר
   * יודעת להסתייג ממנו — `requiresMultipleLines` פוסלת אותו מהכותרת של
   * המחשבון ו-`familyPriceOnly` תלוית-כמות ב-`computeSaving` — אבל
   * הכרטיס, שהוא המקום שבו הגולש קורא את המספר, הכריז אותו בלי שום
   * תנאי: id 110 ("דמי שימוש בסך של 35 ₪ ... לרוכשים 2 מנויים ויותר,
   * עבור מנוי בודד 39.90 ₪") הדפיס "₪35 לחודש", ids 28/29 הדפיסו
   * ₪34/₪32 שהם המחיר **לקו שני** בחבילה של ארבעה, ו-id 117
   * (`wecomFamily`) הדפיס 29.9 במקום 34.9 לקו בודד. אותה הסתייגות
   * בדיוק, באותו מקום שבו מודפסת ההבטחה.
   *
   * ⚠️ הסדר הוא `requiresMultipleLines` קודם: id 16 נושא את שתי
   * ההצהרות ("3 קווים ב 92.70" וגם "משפחתי"), והמחמירה מהן — מינימום
   * חוזי ולא מחיר למנוי — היא זו שצריכה להיאמר.
   */
  const priceCondition =
    isElectric || pkg.price == null
      ? null
      : requiresMultipleLines(pkg)
        ? "המחיר מותנה בכמות המנויים בחבילה"
        : familyPriceOnly(pkg)
          ? "מחיר למנוי במסלול משפחתי — משני מנויים ומעלה"
          : null;

  return (
    /*
     * ⚠️ בלי `interactive`. `Card` מגדיר את הדגל כתשובה לשאלה אחת —
     * "האם לחיצה על הדבר הזה מובילה לאנשהו?" — והתשובה כאן הפכה ל"לא"
     * ברגע שה-`<Link href={`/p/${pkg.slug}`}>` הוסר (ראה ההערה למעלה).
     * הכרטיס המשיך להתרומם בריחוף, כלומר הבטיח ניווט שאינו קיים:
     * לחיצה על כל שטח הכרטיס מלבד שלושת הפקדים אינה עושה דבר.
     */
    <Card as="article" className="flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-lp-line p-4">
        <ProviderLogo logo={pkg.provider.logo} name={pkg.provider.name} size={34} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {pkg.recommended && (
              <span className="rounded-full bg-lp-brand/10 px-2 py-0.5 text-lp-2xs font-semibold text-lp-brand">
                מומלץ
              </span>
            )}
            {pkg.badges.map((b) => (
              <span key={b} className="rounded-full bg-lp-surface-3 px-2 py-0.5 text-lp-2xs font-medium text-lp-ink-2">
                {b}
              </span>
            ))}
            {pkg.type && !pkg.badges.includes(pkg.type) && (
              <span className="rounded-full bg-lp-surface-3 px-2 py-0.5 text-lp-2xs font-medium text-lp-ink-2">
                {pkg.type}
              </span>
            )}
          </div>
          <h3 className="text-sm leading-snug font-semibold text-lp-ink">{pkg.name}</h3>
          <p className="text-xs text-lp-ink-3">{pkg.provider.name}</p>
        </div>

        {onCompareToggle && (
          /*
            ⚠️ התיבה מושבתת כשהמגש מלא, במקום לבלוע את הלחיצה.
            `toggleCompare` מחזיר את המצב כמו שהוא מעל ארבע חבילות, והתיבה
            מבוקרת — כלומר הגולש הקליק, שום דבר לא קרה ואף הודעה לא הופיעה.
            הפקד נראה שבור. המונה "(4/4)" יושב במגש המרחף בתחתית המסך, לא
            ליד התיבה שנלחצה.
          */
          <label
            className={`flex shrink-0 flex-col items-center gap-1 text-lp-2xs ${
              compareFull && !compareChecked ? "cursor-not-allowed text-lp-ink-3 opacity-50" : "cursor-pointer text-lp-ink-3"
            }`}
            title={compareFull && !compareChecked ? `ניתן להשוות עד ${compareMax} חבילות` : undefined}
          >
            <input
              type="checkbox"
              /*
                ⚠️ `id` שנגזר מה-`id` של החבילה. `CompareTray` מחזיר
                לכאן את הפוקוס כשהוסר השבב האחרון והמגש כולו נפרק —
                בלי נקודת אחיזה בדף, משתמש המקלדת היה נזרק ל-`<body>`,
                כלומר לראש הדף אחרי כל הקטלוג.
              */
              id={`lp-compare-${pkg.id}`}
              checked={!!compareChecked}
              /*
                ⚠️ `aria-disabled` ולא `disabled`. ההערה שמתחת כבר קבעה
                שההסבר חייב להיכנס ל-`aria-label` מפני שתיבה `disabled`
                יוצאת מסדר המקלדת — אבל `aria-label` על פקד שיצא מסדר
                המקלדת אף פעם לא נשמע, כי אין לאן למקד. כלומר התיקון
                הקודם כתב את ההסבר הנכון למקום שלא ניתן להגיע אליו, ושתי
                תיבות ההשוואה האחרות של אותו פיצ'ר כבר עשו את זה אחרת
                ומתעדות למה: `CompareTray` ("השוו") ו-`SavingsCalculator`
                (ה-CTA) שתיהן `aria-disabled`. הפקד נשאר בר-מיקוד,
                מכריז "לא זמין" ואת הסיבה, וה-`onChange` מגודר בעצמו —
                שער ולא עיטור, כי `aria-disabled` אינו חוסם כלום.
              */
              aria-disabled={compareFull && !compareChecked}
              onChange={() => {
                if (compareFull && !compareChecked) return;
                onCompareToggle(pkg);
              }}
              className="h-4 w-4 accent-lp-brand aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              /*
                קורא מסך שמע "הוסף" גם כשהלחיצה הבאה תסיר — ההפך מהפעולה.

                ⚠️ הסיבה להשבתה נאמרת כאן ולא רק ב-`title`: `title` על
                ה-`<label>` הוא עכברי בלבד, ואינו נחשף לקורא מסך ואינו
                נגיש למקלדת. `aria-describedby` לא יעזור מאותה סיבה (אין
                טקסט נראה לקשר אליו), ולכן ההסבר נכנס לשם הנגיש עצמו.
              */
              aria-label={
                compareFull && !compareChecked
                  ? `הוסף את ${pkg.name} להשוואה — לא זמין, ניתן להשוות עד ${compareMax} חבילות`
                  : `${compareChecked ? "הסר את" : "הוסף את"} ${pkg.name} ${compareChecked ? "מההשוואה" : "להשוואה"}`
              }
            />
            השוואה
          </label>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {stats.length > 0 && (
          <ul className="mb-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.caption} className="min-w-0 rounded-lg bg-lp-surface-2 px-1 py-2">
                <div className="nums text-sm font-bold text-lp-ink">{s.value}</div>
                <div className="mt-0.5 text-lp-2xs leading-tight text-lp-ink-3">{s.caption}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto">
          <div className="flex items-end justify-between gap-2">
            {isElectric ? (
              <div>
                {/* ⚠️ "עד" כשההנחה מדורגת — ראה `discountIsCapped`. */}
                {discountIsCapped(pkg) && <span className="me-1 text-sm text-lp-ink-2">עד</span>}
                <span className="nums text-3xl font-extrabold text-lp-ink">{pkg.discountPercent}%</span>
                <span className="ms-1 text-sm text-lp-ink-2">הנחה</span>
              </div>
            ) : (
              <div>
                <span className="nums text-3xl font-extrabold text-lp-ink">
                  {pkg.price != null ? shekels(pkg.price) : "—"}
                </span>
                <span className="ms-1 text-sm text-lp-ink-2">לחודש</span>
              </div>
            )}
          </div>

          {priceCondition && (
            <p className="crm-text mt-2 rounded-lg bg-lp-surface-2 px-3 py-2 text-xs text-lp-ink-2">
              {priceCondition}
            </p>
          )}
          {rise != null && (
            <p className="mt-2 rounded-lg bg-lp-rise-soft px-3 py-2 text-xs text-lp-rise">
              <span className="font-semibold">אחרי תום ההטבה: {shekels(rise)} לחודש</span>
            </p>
          )}
          {rise == null && riseNote && (
            <p className="crm-text mt-2 rounded-lg bg-lp-surface-2 px-3 py-2 text-xs text-lp-ink-2">
              <span className="font-semibold">בתום ההטבה:</span> {riseNote}
            </p>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            className="min-h-11 w-full rounded-lg bg-lp-brand px-3 py-2.5 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright"
          >
            {formOpen ? "סגירה" : "שיחזרו אליי"}
          </button>
        </div>

        {formOpen && (
          <div className="animate-lp-rise mt-3 rounded-lp-card bg-lp-surface-2 p-3">
            <LeadForm pkg={pkg} compact />
          </div>
        )}

        {(rows.length > 0 || pkg.description) && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="-mx-1 mt-3 inline-flex min-h-11 items-center self-start px-1 text-xs font-medium text-lp-brand hover:underline"
            >
              {open ? "פחות פרטים ▴" : "פרטים מלאים ▾"}
            </button>

            {open && (
              <div className="animate-lp-rise mt-3 space-y-3 border-t border-lp-line pt-3">
                {rows.length > 0 && (
                  <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                    {rows.map((r) => (
                      <div key={r.label} className="flex justify-between gap-2 border-b border-lp-line/60 pb-1">
                        <dt className="min-w-0 text-lp-ink-3">{r.label}</dt>
                        <dd className="nums min-w-0 text-end font-medium text-lp-ink">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {pkg.description && (
                  <div className="crm-text text-xs leading-relaxed text-lp-ink-2">{pkg.description}</div>
                )}
                {pkg.benefits && (
                  <div className="rounded-lg bg-lp-brand/5 p-3">
                    <p className="mb-1 text-xs font-semibold text-lp-brand">הטבות</p>
                    <div className="crm-text text-xs leading-relaxed text-lp-ink-2">{pkg.benefits}</div>
                  </div>
                )}
                <p className="text-lp-2xs text-lp-ink-3">
                  התנאים המחייבים הם אלה של {pkg.provider.name}. ייתכנו שינויים ותנאי סף.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
