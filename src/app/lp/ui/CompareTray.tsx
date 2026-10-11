"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderLogo } from "./ProviderLogo";
import { compareRows, discountIsCapped, headlineValue, promoRise, shekels } from "../catalog/format";
import { hasKnownAfterPrice } from "../catalog/catalog";
import type { Package } from "../catalog/types";

/**
 * התא בשורת המחיר — **אותו** מספר שהכרטיס מדפיס בגודל 3xl.
 *
 * ⚠️ `headlineValue` ולא הרכבה מקומית. הטבלה בנתה את המחרוזת בעצמה
 * (`p.price != null ? shekels(p.price) : "—"` ו-`${p.discountPercent}%`),
 * ובינתיים הכרטיס עבר לשער אחד ב-`format.ts` — ולכן אותה רשומה
 * הייתה מודפסת בשני ערכים שונים זה לצד זה: `price: 0` (הצורה שהמחלץ
 * מייצר כשלא קרא מחיר, ids 18/22) כ-"₪0" בטבלה מול "—" בכרטיס,
 * ו-`discountPercent: null` (id 144) כ-"null% הנחה" מול "—". זו הפעם
 * החמישית שהערה כאן מתארת שער שנוסף לכרטיס ולא לטבלה; המספר נאמר
 * עכשיו במקום אחד, והטבלה מוסיפה לו רק את מה שהוא שלה: "עד" ו-"הנחה".
 *
 * ⚠️ כשאין מספר אין גם סיומת. "— הנחה" הוא תווית שמבטיחה נתון שהתא
 * עצמו מכחיש, וזה בדיוק מה שתוקן כבר בשורת "אחרי ההטבה".
 */
function headlineCell(p: Package): string {
  const value = headlineValue(p);
  if (p.category !== "electricity" || value === "—") return value;
  return `${discountIsCapped(p) ? "עד " : ""}${value} הנחה`;
}

/**
 * תקרת ההשוואה. יושבת כאן ולא ב-`CatalogBrowser` כי גם `PackageCard`
 * מכריז אותה לקורא מסך, ו-`CatalogBrowser` מייבא את שניהם — ייבוא
 * ממנו היה מעגלי.
 */
/*
 * ⚠️ `promoRise` מ-`format.ts` ולא שער מקומי. כאן ישב `afterPriceKnown`
 * — העותק **השלישי** של אותה הגדרה (הכרטיס ב-`> 0`, פס ההירו
 * ב-`!= null`) — והתא בנה בעצמו את אותה שרשרת של "מספר, אחרת הערה".
 * `promoRise` מחזירה את שלוש התשובות האפשריות כנתון אחד, ולכן הכרטיס,
 * פס ההירו והטבלה אומרים את אותו דבר על אותה רשומה מעצם הבנייה.
 *
 * ⚠️ חשמל נעצר **לפני** הקריאה: `promoRise` מחזירה `null` למסלול חשמל
 * (אין לו מחיר חודשי שיעלה), ו-`null` כאן נקרא כ"הרשומה שתקה" — כלומר
 * בלי הענף הנפרד הטבלה הייתה מכריזה "לא דווח שינוי" על מסלול הנחה.
 */

export const MAX_COMPARE = 4;

/**
 * A sticky tray that fills as you tick packages, then opens a side-by-side
 * sheet. Comparison only becomes useful at two items, so the button stays
 * disabled until then rather than opening an empty table.
 */
export function CompareTray({
  items,
  onRemove,
  onClear,
  max,
}: {
  items: Package[];
  onRemove: (pkg: Package) => void;
  onClear: () => void;
  max: number;
}) {
  const [open, setOpen] = useState(false);

  /*
   * ⚠️ `role="dialog" aria-modal="true"` הצהיר על חלון מודאלי שלא
   * התנהג כמודאלי: הפוקוס נשאר על כפתור "השוו" מאחורי הכיסוי, Tab
   * טייל בקטלוג שמתחת לאוברליי, ו-Escape לא עשה כלום — הסגירה היחידה
   * הייתה לחיצת עכבר. ההצהרה בלי ההתנהגות גרועה מכלום: קורא מסך
   * הבטיח למשתמש שהוא נמצא בחלון סגור.
   *
   * הפוקוס גם **חוזר** לכפתור שפתח: סגירה שמשאירה את הפוקוס על
   * `<body>` מחזירה את משתמש המקלדת לראש הדף, אחרי כל הקטלוג.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  /*
   * ⚠️ אותו חוזה בדיוק גם על הסרת שבב, ולא רק על סגירת החלון.
   *
   * ה-✕ של שבב מוסר את השבב, כלומר **מפרק את הכפתור שנלחץ** — והפוקוס
   * נפל ל-`<body>`, מה שמחזיר את משתמש המקלדת לראש הדף אחרי כל
   * הקטלוג, בדיוק מה שההערה למעלה פוסלת. אחרי ההסרה הפוקוס עובר
   * לשבב שתפס את המקום (או לאחרון, אם הוסר האחרון), ואם לא נשאר שבב
   * אחד — לכפתור "נקה", הפקד הסמוך שנשאר במגש.
   *
   * ⚠️ הסרת השבב האחרון מפרקת את המגש כולו (`items.length === 0`
   * מחזיר `null`), ואז אין במגש פקד למקד — וההערה כאן קראה לזה
   * "בלתי נמנע מכאן". זה לא נכון: הרכיב עצמו נשאר מורכב (ההורה
   * מרנדר אותו תמיד), ה-effect כן רץ, ותיבת הסימון שמחזיקה את אותה
   * בחירה עדיין בדף — `PackageCard` נותן לה `id` שנגזר מה-`id` של
   * החבילה בדיוק בשביל זה. אחרת משתמש מקלדת שהסיר את הבחירה
   * האחרונה הוחזר לראש הדף, אחרי כל הקטלוג.
   */
  const listRef = useRef<HTMLUListElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const focusAfterRemove = useRef<number | null>(null);
  const removedId = useRef<string | null>(null);

  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index == null) return;
    focusAfterRemove.current = null;
    const id = removedId.current;
    removedId.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>("[data-lp-chip-remove]");
    const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : undefined;
    const inTray =
      clearRef.current ?? (id != null ? document.getElementById(`lp-compare-${id}`) : null);
    (next ?? inTray)?.focus();
  }, [items]);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      // מלכודת הפוקוס: רק מה שבאמת ניתן למיקוד ונראה על המסך.
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  /*
   * ⚠️ מפנה מקום למגש בתחתית **המסמך כולו**, לא רק בעמודת התוצאות.
   * הכלל עצמו ב-`lp.css`; כאן רק הסימון, כי זה הרכיב היחיד שיודע
   * מתי המגש באמת על המסך.
   *
   * ⚠️ הניקוי ב-cleanup חובה: הרכיב מחזיר `null` כשאין פריטים, אבל
   * ה-class יושב על `document.body` ולא על ה-DOM שלו — בלי זה הוא
   * היה שורד את ניקוי ההשוואה ומשאיר חור בתחתית הדף.
   */
  useEffect(() => {
    if (items.length === 0) return;
    document.body.classList.add("lp-tray-open");
    return () => document.body.classList.remove("lp-tray-open");
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-lp-line bg-lp-surface/95 backdrop-blur">
        {/*
          ⚠️ בנייד השבבים יורדים לשורה משלהם (`order-last w-full`)
          ונגללים אופקית במקום להישבר לשורות. עם עטיפה וארבע
          חבילות הסרגל הגיע ל-249px — שליש ממסך של אייפון, על סרגל
          שמרחף מעל הקטלוג. מ-`sm` ומעלה ההתנהגות המקורית חוזרת.
        */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-sm font-medium text-lp-ink sm:flex-none">
            להשוואה ({items.length}/{max})
          </span>
          <ul
            ref={listRef}
            className="order-last flex w-full flex-nowrap gap-2 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible"
          >
            {items.map((p, i) => (
              <li key={p.id} className="flex shrink-0 items-center gap-1 rounded-full bg-lp-surface-2 px-3 py-1 text-xs">
                <span className="max-w-[10rem] truncate text-lp-ink">{p.name}</span>
                <button
                  type="button"
                  data-lp-chip-remove
                  onClick={() => {
                    focusAfterRemove.current = i;
                    removedId.current = p.id;
                    onRemove(p);
                  }}
                  aria-label={`הסר את ${p.name} מההשוואה`}
                  className="-my-1 inline-flex min-h-9 min-w-9 items-center justify-center text-lp-ink-3 hover:text-lp-rise"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            ref={clearRef}
            type="button"
            onClick={onClear}
            className="-mx-2 inline-flex min-h-11 items-center px-2 text-xs text-lp-ink-3 hover:underline"
          >
            נקה
          </button>
          {/*
            ⚠️ `aria-disabled` ולא `disabled`, בדיוק כמו ב-CTA של המחשבון
            ומאותו טעם — ורק שכאן זה חמור יותר: הכיתוב **עצמו** הוא
            ההסבר. כפתור `disabled` יוצא מסדר ה-Tab, ולכן משתמש מקלדת
            שסימן חבילה אחת עבר מ-"נקה" ישר אל הקטלוג ולא פגש אף פעם את
            המילים "בחרו עוד חבילה" — המגש נפתח, הכריז "להשוואה (1/4)",
            ושום דבר במסלול המקלדת לא אמר למה אי אפשר להשוות. הכפתור
            נשאר בר-מיקוד, מכריז על עצמו כמושבת, והלחיצה אינה פותחת
            טבלה של פריט אחד.
          */}
          <button
            type="button"
            onClick={(e) => {
              if (items.length < 2) return;
              openerRef.current = e.currentTarget;
              setOpen(true);
            }}
            aria-disabled={items.length < 2}
            className={`inline-flex min-h-11 items-center rounded-lg bg-lp-brand px-4 py-2 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright ${
              items.length < 2 ? "opacity-40" : ""
            }`}
          >
            {items.length < 2 ? "בחרו עוד חבילה" : "השוו"}
          </button>
        </div>
      </div>

      {open && <CompareSheet items={items} panelRef={panelRef} onClose={close} />}
    </>
  );
}

/**
 * חלון ההשוואה עצמו.
 *
 * ⚠️ רכיב מיוצא ולא JSX בתוך `CompareTray`, מאותו טעם ש-`compareRows`
 * עברה ל-`format.ts`: כל מה שהטבלה מדפיסה — תווית השורה, ההסתייגות על
 * המחיר, `scope` על הכותרות, הריפוד של הגזרה הבטוחה — היה בלתי נגיש
 * לבדיקה, כי הוא נתלה במצב `open` הפנימי. עכשיו הוא מרונדר ישירות.
 * ה-`ref` מגיע כפרופ ולא כ-`ref` מפני שמלכודת הפוקוס שמעל קוראת אותו.
 */
export function CompareSheet({
  items,
  panelRef,
  onClose,
}: {
  items: Package[];
  panelRef?: React.Ref<HTMLDivElement>;
  onClose: () => void;
}) {
  /* כל פריטי ההשוואה הם מקטגוריה אחת — ראה ההערה על שורת המחיר. */
  const allElectric = items.every((p) => p.category === "electricity");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-lp-navy/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="השוואת חבילות"
      /*
       * ⚠️ `onClick` על האוברליי סגר את החלון גם כשהלחיצה התחילה
       * *בתוך* הפאנל: אירוע `click` נורה על האב המשותף של ה-mousedown
       * וה-mouseup, ולכן סימון טקסט בטבלה (היא `overflow-x-auto`)
       * ששוחרר מעט מחוץ לפאנל נחת על האוברליי — ו-`stopPropagation`
       * של הפאנל כלל לא עמד בדרך. הבדיקה על `currentTarget` סוגרת
       * רק כשהלחיצה עצמה הייתה על הרקע.
       */
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/*
        ⚠️ ריפוד תחתון לגזרה הבטוחה בנייד. בנייד החלון הוא גיליון
        שנצמד לתחתית המסך (`items-end` + `p-0` על האוברליי), ולכן
        השורה האחרונה של הטבלה נחה מתחת לפס הבית של האייפון —
        אותו פגם בדיוק שתוקן ב-`lp.css` לשורש הדף וב-`CompareTray`
        לסרגל עצמו, ונשאר פתוח דווקא בחלון שמעל שניהם. מ-`sm`
        ומעלה החלון מרוכז עם שוליים משלו, ולכן התוספת מוגבלת לנייד.
      */}
      <div
        ref={panelRef}
        /* יעד הפוקוס בפתיחה — הכותרת נקראת, ומכאן Tab מתחיל בתוך החלון. */
        tabIndex={-1}
        className="animate-lp-rise max-h-[90dvh] w-full max-w-4xl overflow-auto rounded-t-lp-card bg-lp-surface p-5 shadow-lp-pop max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-lp-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-lp-ink">השוואת חבילות</h2>
          <button
            type="button"
            onClick={onClose}
            /* בלי זה קורא מסך הכריז "לחצן, ✕". */
            aria-label="סגירת ההשוואה"
            className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center text-2xl leading-none text-lp-ink-3"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm sm:min-w-[32rem]">
            <thead>
              <tr>
                {/*
                  ⚠️ `scope` על כותרות העמודה. שורות הגוף כבר מוצהרות
                  כ-`<th scope="row">`, כלומר הטבלה דו-צירית במפורש,
                  והעמודות נשארו בלי הצהרה — ולכן הקישור בין תא לספק
                  נשען על ההיוריסטיקה של כל קורא מסך בנפרד, בטבלה
                  שכל תפקידה הוא "איזה מספר שייך לאיזה ספק".
                */}
                <th scope="col" className="w-20 sm:w-28" />
                {items.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className="border-b border-lp-line p-2 text-start align-bottom"
                  >
                    <ProviderLogo logo={p.provider.logo} name={p.provider.name} size={26} />
                    <div className="mt-1 text-xs font-semibold text-lp-ink">{p.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/*
                ⚠️ התווית נגזרת מהקטגוריה. מסלול חשמל אינו נמכר במחיר
                חודשי אלא באחוז הנחה, והשורה הכריזה "מחיר לחודש: 20%
                הנחה" — תווית שסותרת את הערך שמתחתיה בדיוק בשורה
                הראשונה של הטבלה. כל פריטי ההשוואה הם מקטגוריה אחת
                (`CatalogBrowser` מרונדר מחדש עם `key={category}`),
                ולכן התווית אחת לכל הטבלה.
              */}
              <Row label={allElectric ? "הנחה בחשבון" : "מחיר לחודש"}>
                {items.map((p) => (
                  <Cell key={p.id}>
                    {/*
                      ⚠️ "עד" גם כאן. השער הזה נוסף לכרטיס בלבד, והטבלה
                      — שכל תפקידה להשוות — מחקה בדיוק את ההסתייגות
                      שהכרטיס שמעליה הוסיף: מסלול מדורג (ids 135, 142)
                      הודפס "10% הנחה" מול "עד 10% הנחה" בכרטיס, כלומר
                      הבטחה של כפול מהשיעור הממשי בצריכה בינונית.
                    */}
                    {headlineCell(p)}
                  </Cell>
                ))}
              </Row>
              {/*
                ⚠️ אחת עשרה חבילות מצהירות על העלייה ב-`priceAfterPromoNote` בלבד,
                בלי מספר ב-`priceAfterPromo`. קריאה של השדה המספרי לבדו הכריזה
                עליהן "לא דווח שינוי" — בעוד שכרטיס אותה חבילה הציג "בתום ההטבה:
                אחרי שנתיים 69.9". הטבלה שכל תפקידה להשוות הכחישה נתון שהדף עצמו
                מציג, ודווקא בעמודה שהיא הבטחת המותג.
              */}
              {/*
                ⚠️ ובלשונית החשמל השורה כולה יורדת. אין ולו מסלול חשמל
                אחד בקטלוג שנושא `priceAfterPromo` או הערה — התא עצמו
                כבר מחזיר "—" לחשמל, כלומר הטבלה הוסיפה שורה שלמה של
                מקפים מתחת לכותרת שמבטיחה את הנתון המרכזי של הדף.
              */}
              {!allElectric && (
                <Row label="אחרי ההטבה">
                  {items.map((p) => (
                    <AfterPromoCell key={p.id} pkg={p} />
                  ))}
                </Row>
              )}
              {compareRows(items).map((row) => (
                <Row key={`fact-${row.label}`} label={row.label}>
                  {row.values.map((v, i) => (
                    <Cell key={items[i].id}>{v}</Cell>
                  ))}
                </Row>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * התא בשורת "אחרי ההטבה" — **אותה** תשובה שהכרטיס ופס ההירו מדפיסים.
 *
 * ⚠️ `promoRise` מכריעה בין שלוש התשובות (מספר / נוסח מילולי / כלום),
 * ולכן התא אינו בונה את השרשרת בעצמו. זה היה העותק השלישי של אותו
 * שער — ראה ההערה על `promoRise` ב-`format.ts`.
 *
 * ⚠️ "לא דווח שינוי" רק כשהרשומה באמת **שתקה**, ולא כששדה
 * המחיר-אחרי-הטבה שלה פגום. `promoRise` מחזירה `null` לשני המצבים
 * האלה גם יחד, ו-`hasKnownAfterPrice` ב-`catalog.ts` היא זו שמבדילה:
 * `priceAfterPromo: 0` (הצורה שהמחלץ מייצר כשלא קרא מספר; `price: 0`
 * ב-ids 18/22 הוא אותו פגם באותו קובץ) נקרא שם כ"לא יודעים" ומוריד את
 * החבילה לסוף המיון "מחיר אחרי ההטבה" — ולכן התא אינו יכול להכריז
 * עליו "המחיר נשאר". "—" הוא אותו דרדור של `headlineValue` ושל
 * `shekels`.
 *
 * ⚠️ חשמל נעצר לפני הכול: `promoRise` מחזירה לו `null` ו-
 * `hasKnownAfterPrice` מחזירה `true` (אין מספר ואין הערה), כלומר בלי
 * הענף הזה הטבלה הייתה מכריזה "לא דווח שינוי" על מסלול הנחה שאין לו
 * מחיר חודשי בכלל. השורה כולה ממילא יורדת בלשונית החשמל; זה השער
 * לצירוף מעורב.
 */
function AfterPromoCell({ pkg }: { pkg: Package }) {
  if (pkg.category === "electricity") return <Cell>—</Cell>;
  const rise = promoRise(pkg);
  return (
    <Cell tone={rise ? "rise" : undefined}>
      {rise
        ? rise.kind === "amount"
          ? shekels(rise.amount)
          : rise.note
        : hasKnownAfterPrice(pkg)
          ? "לא דווח שינוי"
          : "—"}
    </Cell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="even:bg-lp-surface-2">
      <th scope="row" className="p-2 text-start align-top text-xs font-medium text-lp-ink-3">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children, tone }: { children: React.ReactNode; tone?: "rise" }) {
  return (
    <td className={`nums p-2 align-top text-sm ${tone === "rise" ? "text-lp-rise" : "text-lp-ink"}`}>{children}</td>
  );
}
