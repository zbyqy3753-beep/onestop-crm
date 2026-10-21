"use client";

import { useState } from "react";
import { Card } from "./Card";
import { ProviderLogo } from "./ProviderLogo";
import { LeadForm } from "./LeadForm";
import { compareCheckboxId, MAX_COMPARE } from "./CompareTray";
import {
  cardStats,
  detailRows,
  discountIsCapped,
  headlineValue,
  priceNote,
  promoNoteLabel,
  promoNoteText,
  promoRise,
  PROMO_PERIOD_TEXT,
  shekels,
} from "../catalog/format";
import {
  freeText,
  isRecommended,
  packageLabel,
  packageTitle,
  providerLogo,
  providerName,
} from "../catalog/catalog";
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
  /*
   * ⚠️ המצב הזה חי בכרטיס ולא בטופס. `LeadForm` מחזיק את "נשלח"
   * ב-`useActionState`, והטופס מרונדר מאחורי `formOpen` — כלומר
   * לחיצה על "סגירה" מפרקת אותו ומוחקת את העובדה שהפנייה נשלחה.
   * מי שלחץ "שיחזרו אליי", שלח, סגר ופתח שוב קיבל טופס ריק בלי
   * שום סימן, ושלח שוב; השרת רק מצרף את הכפילות כהערה. מרגע
   * שנשלחה פנייה הכרטיס מחזיק את פאנל האישור ואינו מציע טופס נוסף.
   */
  const [sent, setSent] = useState(false);

  const stats = cardStats(pkg);
  const rows = detailRows(pkg);
  const isElectric = pkg.category === "electricity";

  // The whole point of the site: when the price jumps after the promo, say so
  // on the card rather than in the small print.
  /*
   * ⚠️ `promoRise` מ-`format.ts` ולא שרשרת מקומית. השער עצמו נכון כאן
   * מאז ש-`priceAfterPromo: 0` גודר ב-`> 0` (הצורה שהמחלץ כותב כשלא
   * קרא מספר — `price: 0` כבר קיים ב-ids 18, 22), אבל הוא נכתב **פעמיים
   * ועוד פעם**: פס המחיר בהירו (`page.tsx`) שאל `!= null` ולכן היה
   * מדפיס "ואחרי ההטבה ₪0" ובולע את ההערה המילולית, ו-`CompareTray`
   * מחזיק עותק שלישי (`afterPriceKnown`). שער אחד, במקום אחד.
   */
  const rise = promoRise(pkg);

  /*
   * ⚠️ מחיר שמותנה בכמות מנויים אינו מחיר חודשי שטוח, ואחוז הנחה על
   * רכיב אחד בחשבון אינו הנחה על החשבון. שרשרת ההסתייגויות עברה
   * ל-`priceNote` ב-`format.ts` כדי ש**גם טבלת ההשוואה** תראה אותה
   * (ראה ההערה שם) — כאן נשארת רק ההצגה, צמוד למספר שהיא מסתייגת ממנו.
   */
  const note = priceNote(pkg);

  /*
   * ⚠️ כשאין מספר אין גם סיומת — בדיוק הכלל ש-`headlineCell`
   * ב-`CompareTray` כבר אוכף ("'— הנחה' הוא תווית שמבטיחה נתון שהתא
   * עצמו מכחיש"), ושנוסף שם בלבד. הכרטיס המשיך להרכיב את החיבור
   * בעצמו, ולכן על אותה רשומה — id 144, `discountPercent: null` —
   * הטבלה הדפיסה "—" והכרטיס שמעליה "עד — הנחה": שלוש מילים שמצהירות
   * שיש כאן שיעור הנחה, סביב מקף שאומר שאין. זו הפעם הששית שאותו
   * שער נוסף לצד אחד ולא לשני (ראה `discountIsCapped`).
   *
   * השדה אינו מוצג היום (`isListable` פוסל אותו, ושני נתיבי הכרטיס
   * מקבלים `listable(...)`), אבל `headlineValue` מדרדר ל-"—" גם על
   * עמלה פגומה ברענון הבא — והכרטיס הוא הנתיב שאינו מגודר בעצמו.
   */
  const headline = headlineValue(pkg);
  const headlineKnown = headline !== "—";

  /*
   * ⚠️ `Array.isArray` ולא `pkg.badges.map` ישירות — בדיוק השער
   * ש-`detailRows` קיבלה על `lineTiers` ("**למחרוזת יש `length`**"),
   * רק שכאן אין אפילו `?.`: `badges` הוא השדה היחיד בכרטיס שמפוענח
   * מהפרוזה ומגיע כמערך, והקטלוג נכנס דרך `as unknown as Catalog`
   * כלומר **אין ולידציה בזמן ריצה**. אומת בפועל: `badges: null`
   * זורק `Cannot read properties of null (reading 'map')` ו-
   * `badges: "5G"` זורק `pkg.badges.map is not a function` — בתוך
   * רינדור שרת, ולכן **כל** דף `/lp` מחזיר 500 במקום שכרטיס אחד
   * יציג תג אחד פחות. 109 הרשומות של היום נקיות; זה שער לרענון הבא,
   * מאותה מחלקה של `spec: null` ושל `hoursText` כאובייקט.
   *
   * ⚠️ גם כל תג בנפרד: תג שאינו מחרוזת היה מגיע ל-React כאובייקט
   * ("Objects are not valid as a React child") ומפיל את אותו רינדור,
   * ותג ריק היה מצייר כפתולית ריקה. ו-`badges.includes(pkg.type)`
   * מתחת קורא את אותו מערך מגודר — על מחרוזת `includes` הוא בדיקת
   * תת-מחרוזת, כלומר `badges: "5G פלוס"` היה מעלים בשקט את שבב הסוג.
   */
  const badges = Array.isArray(pkg.badges) ? pkg.badges.filter((b) => freeText(b) != null) : [];

  /*
   * ⚠️ אותו שער בדיוק על `type`, `description` ו-`benefits` — ראה
   * `freeText` ב-`text.ts`. ההערה על `badges` למעלה הצהירה ש-`badges`
   * הוא "השדה היחיד בכרטיס שמפוענח מהפרוזה", וזה לא נכון: שלושת
   * האלה הם טקסט חופשי מאותו מחלץ, ושלושתם הודפסו חשופים. `type: {}`
   * הפיל את רינדור השרת של הדף כולו (אומת), ו-`description`/`benefits`
   * פגומים הפילו את הפאנל בלחיצה — כשדווקא `benefits` הוא אחד
   * משלושת התנאים שמציירים את הכפתור.
   */
  const type = freeText(pkg.type);
  const description = freeText(pkg.description);
  const benefits = freeText(pkg.benefits);

  /*
   * ⚠️ שם החבילה דרך `packageTitle` — ראה `text.ts`. `name: {}` זרק
   * כאן `Objects are not valid as a React child` בתוך רינדור השרת,
   * ולכן רשומה אחת פגומה החזירה את `/lp` כולו ב-500.
   */
  const provider = providerName(pkg);
  const title = packageTitle(pkg);
  const label = packageLabel(pkg, provider);

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
        <ProviderLogo logo={providerLogo(pkg)} name={provider} size={34} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {/*
             * ⚠️ `isRecommended` ולא הדגל עצמו — ההגדרה המשותפת
             * לכל ארבעת הקוראים (ראה `catalog.ts`). דווקא המשטח
             * שמדפיס נשאר לא מגודר: `recommended: "false"` כמחרוזת
             * הדליק את התג, ו-`recommended: 0` הדפיס "0" לשורת
             * התגים (`0 && jsx` מחזיר `0`, ו-React מרנדר אותו).
             */}
            {isRecommended(pkg) && (
              <span className="rounded-full bg-lp-brand/10 px-2 py-0.5 text-lp-2xs font-semibold text-lp-brand">
                מומלץ
              </span>
            )}
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-lp-surface-3 px-2 py-0.5 text-lp-2xs font-medium text-lp-ink-2">
                {b}
              </span>
            ))}
            {type && !badges.includes(type) && (
              <span className="rounded-full bg-lp-surface-3 px-2 py-0.5 text-lp-2xs font-medium text-lp-ink-2">
                {type}
              </span>
            )}
          </div>
          <h3 className="text-sm leading-snug font-semibold text-lp-ink">{title}</h3>
          {/*
            ⚠️ `lp-ink-2` ולא `lp-ink-3` — וזה חל על **כל** הטקסט הקטן
            בכרטיס, במגש ובעמודת המסננים.

            `#7d8b99` על לבן הוא 3.49:1, ועל `lp-surface-2` 3.27:1 (חושב),
            כלומר מתחת ל-AA (4.5:1) לכל טקסט שאינו "גדול" — ו-`lp-2xs`
            הוא 11px ו-`text-xs` הוא 12px. ההכרעה הזאת כבר נעשתה בסבב
            הקודם, אבל הוחלה על שני מופעים (ההסתייגות הארוכה במחשבון
            והפקד "לשנות את הנתונים") ולא על האחים שלהם — אותו דפוס
            שהקבצים האלה מתעדים שוב ושוב. מה שעבר כאן הוא דווקא הטקסט
            שנושא את המידע: שם הספק, כיתובי האריחים (שהם המשמעות של
            המספרים שמעליהם), תוויות שורות הפירוט, שורת התנאים המחייבים,
            התווית של תיבת ההשוואה, מוני המסננים, קצות מחוון המחיר
            ותוויות השורות בטבלת ההשוואה.

            ⚠️ שני מופעים נשארו `lp-ink-3` בכוונה: החץ של "סינון"
            (`aria-hidden`, קישוט) וה-✕ של חלון ההשוואה (24px, ולכן
            תחת הסף של "טקסט גדול" — 3:1).

            ⚠️ התיקון במקור היה אסימון אחד ב-`globals.css`; הוא לא כאן
            (ראה הדיווח).
          */}
          <p className="text-xs text-lp-ink-2">{provider}</p>
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
              compareFull && !compareChecked ? "cursor-not-allowed text-lp-ink-3 opacity-50" : "cursor-pointer text-lp-ink-2"
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

                ⚠️ דרך `compareCheckboxId` ולא תבנית מחרוזת כתובה כאן.
                התבנית הייתה כתובה פעמיים — כאן וב-`CompareTray`, שהוא
                היחיד שמחפש את ה-`id` הזה — כלומר שינוי בצד אחד היה
                שובר את החזרת הפוקוס **בשקט**, בלי שום שגיאה: הקוד שם
                קורא `getElementById` ומתעלם מ-`null`. שני הצדדים
                קוראים עכשיו הגדרה אחת.
              */
              id={compareCheckboxId(pkg)}
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
                  ? `הוסף את ${label} להשוואה — לא זמין, ניתן להשוות עד ${compareMax} חבילות`
                  : `${compareChecked ? "הסר את" : "הוסף את"} ${label} ${compareChecked ? "מההשוואה" : "להשוואה"}`
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
                <div className="mt-0.5 text-lp-2xs leading-tight text-lp-ink-2">{s.caption}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto">
          <div className="flex items-end justify-between gap-2">
            {/*
              ⚠️ המספר עצמו נבנה ב-`headlineValue` ולא כאן: הוא היה
              מודפס "₪0 לחודש" על `price: 0` ו-"null% הנחה" על
              `discountPercent: null`, שני ערכים שקיימים בקטלוג של
              היום (ids 18, 22, 144) ונעצרים ב-`isListable` בלבד.
              ראה את ההערה שם.
            */}
            {isElectric ? (
              <div>
                {/* ⚠️ "עד" כשההנחה מדורגת — ראה `discountIsCapped`. */}
                {headlineKnown && discountIsCapped(pkg) && (
                  <span className="me-1 text-sm text-lp-ink-2">עד</span>
                )}
                <span className="nums text-3xl font-extrabold text-lp-ink">{headline}</span>
                {headlineKnown && <span className="ms-1 text-sm text-lp-ink-2">הנחה</span>}
              </div>
            ) : (
              <div>
                <span className="nums text-3xl font-extrabold text-lp-ink">{headline}</span>
                {headlineKnown && <span className="ms-1 text-sm text-lp-ink-2">לחודש</span>}
              </div>
            )}
          </div>

          {note && (
            <p className="crm-text mt-2 rounded-lg bg-lp-surface-2 px-3 py-2 text-xs text-lp-ink-2">
              {note.value}
            </p>
          )}
          {rise?.kind === "amount" && (
            <p className="mt-2 rounded-lg bg-lp-rise-soft px-3 py-2 text-xs text-lp-rise">
              <span className="font-semibold">אחרי תום ההטבה: {shekels(rise.amount)} לחודש</span>
            </p>
          )}
          {/*
           * ⚠️ התווית והנוסח מגיעים מ-`format.ts` ולא נכתבים כאן:
           * "בתום ההטבה: <נוסח>" הוא הצהרה שלנו על המחיר שאחרי, ועל
           * שמונה מ-11 הרשומות הנוסח פותח במחיר **המבצע** (id 81:
           * "39 ש"ח למשך 3 חודשים" מתחת למחיר ₪99), כלומר הכרטיס
           * הודיע שהמחיר יורד. פס המחיר בהירו הדפיס את אותה תווית
           * מנוסח משלו — שתי אמירות על אותו מספר — ולכן השער והנוסח
           * יושבים ב-`promoNoteText`, מקום אחד לשני המשטחים.
           */}
          {rise?.kind === "note" && (
            <p className="crm-text mt-2 rounded-lg bg-lp-surface-2 px-3 py-2 text-xs text-lp-ink-2">
              <span className="font-semibold">{promoNoteLabel(pkg, rise.note)}</span>{" "}
              {promoNoteText(pkg, rise.note)}
            </p>
          )}
          {/*
           * הכרטיס שתק לגמרי על 19 חבילות שהתיאור שלהן מצהיר על תקופת
           * מבצע בלי שהמספר הגיע לשדה. הנוסח אינו מצהיר על עלייה —
           * ראה `PromoRise` ב-`format.ts`.
           */}
          {rise?.kind === "period" && (
            <p className="crm-text mt-2 rounded-lg bg-lp-surface-2 px-3 py-2 text-xs text-lp-ink-2">
              {PROMO_PERIOD_TEXT}
            </p>
          )}
        </div>

        {!sent && (
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
        )}

        {(formOpen || sent) && (
          <div className="animate-lp-rise mt-3 rounded-lp-card bg-lp-surface-2 p-3">
            <LeadForm pkg={pkg} compact onSent={() => setSent(true)} />
          </div>
        )}

        {/*
          ⚠️ השער מונה את **שלושת** הדברים שהפאנל מדפיס, ולא שניים.
          `pkg.benefits` נשכח ממנו: רשומה שנושאת הטבות בלי `description`
          ובלי אף שורת פירוט (ids 51, 29 ו-100 הם בדיוק הצורה הזו —
          `detailRows` ריק ו-`description` null) קיבלה פאנל שאינו ניתן
          לפתיחה, כלומר בלוק "הטבות" שאין שום דרך להגיע אליו, ואיתו גם
          השורה על התנאים המחייבים של הספק. 8 רשומות בקטלוג נושאות
          `benefits`, ובכולן יש היום גם `description` — זה שער לרענון
          הבא, מאותה מחלקה של "הפאנל מדפיס ערך שהשער אינו מכיר".
        */}
        {(rows.length > 0 || description || benefits) && (
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
                        <dt className="min-w-0 text-lp-ink-2">{r.label}</dt>
                        <dd className="nums min-w-0 text-end font-medium text-lp-ink">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {description && (
                  <div className="crm-text text-xs leading-relaxed text-lp-ink-2">{description}</div>
                )}
                {benefits && (
                  <div className="rounded-lg bg-lp-brand/5 p-3">
                    <p className="mb-1 text-xs font-semibold text-lp-brand">הטבות</p>
                    <div className="crm-text text-xs leading-relaxed text-lp-ink-2">{benefits}</div>
                  </div>
                )}
                <p className="text-lp-2xs text-lp-ink-2">
                  התנאים המחייבים הם אלה של {provider}. ייתכנו שינויים ותנאי סף.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
