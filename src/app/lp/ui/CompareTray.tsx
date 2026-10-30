"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderLogo } from "./ProviderLogo";
import {
  compareRows,
  discountIsCapped,
  headlineValue,
  PROMO_NOTE_QUOTE_LABEL,
  PROMO_PERIOD_TEXT,
  promoNoteRises,
  promoNoteText,
  promoRise,
  shekels,
} from "../catalog/format";
import {
  hasKnownAfterPrice,
  packageTitle,
  providerLogo,
  providerName,
} from "../catalog/catalog";
import type { Package } from "../catalog/types";

/**
 * כותרת שמבדילה בין שתי רשומות שונות שנראות זהות במגש ובטבלה.
 *
 * ⚠️ המגש והטבלה מזהים עמודה לפי `providerLogo` + `packageTitle` בלבד,
 * ושלושה זוגות בקטלוג מתנגשים בשניהם: ids 50/51 (גולן, "Valentine's",
 * שניהם ₪60), ids 28/29 ("4 ב 130", ₪34 מול ₪32) ו-ids 23/24 ("כשר",
 * ₪25 מול ₪27.9). הזוג הראשון הוא החמור: אותו לוגו, אותה כותרת, אותו
 * מחיר — ואז הטבלה מצהירה על "אותה חבילה" גם `4,000` הודעות SMS וגם
 * `—`, וגם "המחיר מותנה בכמות המנויים" וגם `—`. לגולש לא הייתה שום
 * דרך לדעת איזו עמודה היא איזה כרטיס, ושני כפתורי ה-✕ הכריזו את אותו
 * שם נגיש בדיוק ("הסר את Valentine's מההשוואה").
 *
 * ⚠️ והרשומה **כן** מסרה את ההבדל: `rawName` של id 51 הוא
 * `"Valentine's *2*"` ושל id 29 `"4 ב 130 *2*"`. `displayName` מנקה את
 * `*2*` לתצוגה (ראה ההערה שם — סימון פנימי של גרסה שנייה), ו-`rawName`
 * נשמר בדיוק כדי שהגזירות יוכלו לקרוא אותו. כלומר הסימן נמחק דווקא
 * במשטח שכל תפקידו להבדיל.
 *
 * ⚠️ רק כשיש התנגשות בפועל בתוך הבחירה: "גרסה 2" על עמודה בודדת היא
 * רעש שאינו אומר לגולש דבר. ids 23/24 אינם נושאים `*2*` כלל (אותו שם
 * גולמי בדיוק) — זה פגם נתונים שאינו בר-תיקון כאן, ולכן הם נופלים
 * למחיר, שהוא ההבדל היחיד שהרשומה מסרה עליהם.
 */
export function compareLabel(p: Package, items: Package[]): string {
  /*
   * ⚠️ נפילה לשם הספק, בדיוק כמו `packageLabel` — ולא `packageTitle`
   * חשוף. רשומה שה-`name` שלה אינו מחרוזת מחזירה `""` מ-`packageTitle`
   * (`basePackages` משאירה שם כזה כמות שהוא במכוון), ואז השבב וה-✕
   * הכריזו פעולה בלי לומר על מה — השם הנגיש הריק שמתועד ב-
   * `tools/lpText.test.mjs`. בלי ההתנגשות הזו הפונקציה מחזירה בדיוק
   * את מה ש-`packageLabel` החזירה.
   */
  const title = packageTitle(p) || providerName(p);
  const sameTitle = items.filter((o) => (packageTitle(o) || providerName(o)) === title);
  if (sameTitle.length < 2) return title;
  const twins = sameTitle.filter((o) => providerName(o) === providerName(p));
  /*
   * ⚠️ התנגשות בין **ספקים שונים** נפרדת בשם הספק, ולא נופלת
   * לכותרת חשופה. התנאי דרש `providerName(o) === providerName(p)`,
   * כלומר כל מנגנון ההבדלה למטה פעל רק בתוך אותו ספק — ושתי
   * רשומות של ספקים שונים שחולקות כותרת חזרו שתיהן כ-title חשוף.
   * זה קורה בפועל: ids 147 (`HOT אנרגי`) ו-150 (`בזק אנרג'י`)
   * חולקות את הכותרת "חוסכים בלילה 20%". במגש אין לוגו — השבב
   * מדפיס את `compareLabel` לבדה — ולכן שני השבבים היו זהים ושני
   * כפתורי ה-✕ הכריזו את אותו שם נגיש בדיוק
   * ("הסר את חוסכים בלילה 20% מההשוואה"), בלי שום דרך לדעת איזה
   * הוא איזה. זו אותה מחלקת כשל שההערה למעלה מתארת על 50/51,
   * רק שהציר שנשכח הוא הספק ולא הגרסה.
   *
   * ⚠️ ובקטגוריית החשמל נפילת-המחיר למטה מושתקת לחלוטין (`price`
   * הוא `null` בכל 19 הרשומות), ולכן בלי השורה הזו לא היה **שום**
   * מבדיל לזוג הזה.
   *
   * ⚠️ ולא כשהכותרת היא כבר שם הספק (הנפילה למעלה) — שם זו הייתה
   * הכפלה של אותה מילה.
   */
  if (twins.length < 2) {
    const provider = providerName(p);
    return provider && provider !== title ? `${title} · ${provider}` : title;
  }
  const variant = (p.rawName ?? "").match(/\*(\d+)\*/);
  if (variant) return `${title} · גרסה ${variant[1]}`;
  return typeof p.price === "number" && Number.isFinite(p.price) ? `${title} · ${shekels(p.price)}` : title;
}

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
 * ה-`id` של תיבת ההשוואה שעל הכרטיס.
 *
 * ⚠️ יושב כאן ולא ב-`PackageCard` כי הצרכן השני הוא הקוד שמחזיר את
 * הפוקוס מהמגש אל הדף (`document.getElementById`), והוא זה שנשבר
 * כשהתבנית מתפצלת: `getElementById` מחזיר `null` בשקט, ולכן תבנית
 * שלא תואמת אינה שגיאה אלא פוקוס שנופל ל-`<body>` — כלומר בדיוק
 * הפגם שהחזרת הפוקוס נכתבה למנוע. `PackageCard` מייבא מכאן ממילא
 * (`MAX_COMPARE`), וייבוא בכיוון ההפוך היה מעגלי.
 */
export function compareCheckboxId(pkg: Package): string {
  return `lp-compare-${pkg.id}`;
}

/**
 * כמה מגשים נראים כרגע בדף — ראה ההערה על `lp-tray-open` מתחת.
 *
 * ⚠️ מצב משותף בין מופעים, ולכן ברמת המודול. אין לו צרכן אחר.
 */
let openTrays = 0;

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
  /*
   * ⚠️ ו**גם** על "נקה", שהוא המסלול היחיד שנשאר בלי זה.
   *
   * ההערה שמעל מצהירה על החוזה ("סגירה שמשאירה את הפוקוס על `<body>`
   * מחזירה את משתמש המקלדת לראש הדף"), והוא יושם לסגירת החלון ול-✕
   * של שבב בודד — אבל "נקה" מרוקן את הבחירה כולה, ולכן `items.length`
   * הופך ל-0, הרכיב מחזיר `null`, ו**הכפתור שנלחץ עליו עצמו** יוצא
   * מה-DOM. `focusAfterRemove` נשאר `null` ולכן ה-effect יצא מיד:
   * הפוקוס נפל ל-`<body>`, כלומר לראש הדף אחרי כל הקטלוג — אותה
   * תוצאה בדיוק שהסרת שבב כבר מטופלת נגדה, רק דרך הפקד השכן.
   *
   * אין במגש פקד לחזור אליו (הוא נפרק כולו), ולכן היעד הוא אותה
   * נקודת אחיזה שהסרת השבב האחרון משתמשת בה: תיבת ההשוואה של אחת
   * מהחבילות שהיו בבחירה, שעדיין על המסך ועכשיו אינה מסומנת. נסיון
   * לפי הסדר, כי חבילה שהמסנן הוציא מהתוצאות אינה מרונדרת כלל —
   * וזה בדיוק המצב שבו הבחירה שורדת סינון (ראה `hiddenCompare`
   * ב-`CatalogBrowser`).
   */
  const listRef = useRef<HTMLUListElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const focusAfterRemove = useRef<number | null>(null);
  const removedBoxId = useRef<string | null>(null);
  const clearedIds = useRef<string[] | null>(null);

  useEffect(() => {
    const cleared = clearedIds.current;
    clearedIds.current = null;
    const index = focusAfterRemove.current;
    if (index == null) {
      for (const domId of cleared ?? []) {
        const box = document.getElementById(domId);
        if (box) {
          box.focus();
          return;
        }
      }
      return;
    }
    focusAfterRemove.current = null;
    const id = removedBoxId.current;
    removedBoxId.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>("[data-lp-chip-remove]");
    const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : undefined;
    const inTray = clearRef.current ?? (id != null ? document.getElementById(id) : null);
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
   *
   * ⚠️ ומונה־התייחסויות ולא דגל, כי הרכיב הזה **אינו** יחיד בדף.
   * `CatalogTabs` מרנדר אותו פעם אחת (`key={category}`), אבל
   * `provider/[slug]/page.tsx` מרנדר `CatalogBrowser` אחד לכל
   * קטגוריה בתוך `sections.map` — כלומר שלושה מגשים ב-
   * `/lp/provider/cellcom` ושניים ב-`/lp/provider/partner`.
   * `classList.remove` של מגש אחד הפיל את ה-class בזמן שמגש אחר
   * עוד על המסך: ההרווחה ב-`lp.css` חדלה לחול, והמגש שנשאר כיסה
   * את ~8rem התחתונים של הדף — בדיוק החור שההערה מעל נכתבה
   * למנוע, מהכיוון ההפוך. ה-class יורד רק כשהמגש ה**אחרון** נסגר.
   *
   * ⚠️ מונה ברמת המודול ולא `useRef`: הוא נספר **בין** מופעים,
   * וזו כל הנקודה.
   */
  useEffect(() => {
    if (items.length === 0) return;
    openTrays += 1;
    document.body.classList.add("lp-tray-open");
    return () => {
      openTrays -= 1;
      if (openTrays <= 0) {
        openTrays = 0;
        document.body.classList.remove("lp-tray-open");
      }
    };
  }, [items.length]);

  return (
    <>
      {/*
        ⚠️ המונה מוכרז, ולא רק נראה.

        הכיתוב "להשוואה (n/4)" הוא המקום **היחיד** שמאשר שסימון תיבה
        בכרטיס נקלט בכלל: הפוקוס נשאר על התיבה, הרשת שמתחתיה אינה
        משתנה, והמגש עולה בתחתית המסך — מחוץ לשדה הראייה של מי שמנווט
        בקורא מסך. שורת התוצאות ב-`CatalogBrowser` כבר `aria-live`
        מאותו נימוק בדיוק; המונה של ההשוואה נשאר מאחור.

        ⚠️ והאזור החי יושב **מחוץ** לתנאי, ולכן הרכיב אינו מחזיר יותר
        `null` כשאין פריטים. אזור חי שנכנס ל-DOM יחד עם התוכן שלו אינו
        מוכרז (ה-AT רושם אותו רק מהשינוי הבא), כלומר דווקא ההוספה
        הראשונה — זו שבונה את המגש כולו — הייתה נשארת שקטה. פסקה ריקה
        אינה הכרזה, ולכן המגש הריק עדיין אינו אומר דבר.

        ⚠️ הכיתוב הנראה מסומן `aria-hidden`: שני הניסוחים אומרים את
        אותו נתון, וקורא מסך שהגיע למגש ב-Tab היה שומע את המונה פעמיים
        ברצף.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {items.length > 0 ? `להשוואה: ${items.length} מתוך ${max}` : ""}
      </p>
      {items.length > 0 && (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-lp-line bg-lp-surface/95 backdrop-blur">
        {/*
          ⚠️ בנייד השבבים יורדים לשורה משלהם (`order-last w-full`)
          ונגללים אופקית במקום להישבר לשורות. עם עטיפה וארבע
          חבילות הסרגל הגיע ל-249px — שליש ממסך של אייפון, על סרגל
          שמרחף מעל הקטלוג. מ-`sm` ומעלה ההתנהגות המקורית חוזרת.
        */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* ⚠️ `aria-hidden` — האזור החי שמעל אומר את אותו נתון, ראה שם. */}
          <span aria-hidden="true" className="flex-1 text-sm font-medium text-lp-ink sm:flex-none">
            להשוואה ({items.length}/{max})
          </span>
          <ul
            ref={listRef}
            className="order-last flex w-full flex-nowrap gap-2 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible"
          >
            {items.map((p, i) => (
              /*
                ⚠️ שם החבילה דרך `packageTitle`/`packageLabel` ולא `p.name`
                חשוף — ראה `text.ts`. `name: {}` זרק כאן `Objects are not
                valid as a React child` (אומת), כלומר רשומה אחת פגומה
                בבחירה הפילה את רינדור הדף כולו; והשם הנגיש נופל חזרה לשם
                הספק, כי "הסר את  מההשוואה" הוא פקד שאינו אומר על מה.
              */
              <li key={p.id} className="flex shrink-0 items-center gap-1 rounded-full bg-lp-surface-2 px-3 py-1 text-xs">
                {/*
                  ⚠️ `dir="auto"` על השבב. `truncate` תולה את ה-"…" בקצה
                  ה**סוף** של כיוון האלמנט, והשבב ירש RTL מהדף — ולכן שם
                  לטיני נחתך ב**פתיח** שלו: `5G ULTRA 3000GB…` הוצג
                  `…TRA 3000GB Plus FLY 10GB 2025`, שלושה שבבים זה לצד זה
                  שנפתחים ב-"TRA" בזמן שהמותג הוא מה שנעלם. `auto` נותן
                  לשם הלטיני LTR ולשם העברי RTL, וכל אחד נחתך בסופו.
                */}
                {/* ⚠️ `compareLabel` ולא `packageTitle` — ראה ההערה שם. */}
                <span dir="auto" className="max-w-[10rem] truncate text-lp-ink">
                  {compareLabel(p, items)}
                </span>
                <button
                  type="button"
                  data-lp-chip-remove
                  onClick={() => {
                    focusAfterRemove.current = i;
                    removedBoxId.current = compareCheckboxId(p);
                    onRemove(p);
                  }}
                  /* ⚠️ גם השם הנגיש מבדיל: שני ✕ שמכריזים אותו שם הם שני
                     כפתורים שגולש קורא-מסך אינו יכול לבחור ביניהם.
                     `compareLabel` נופלת לשם הספק בדיוק כמו `packageLabel`
                     שהייתה כאן, ולכן השם הנגיש אינו מתרוקן על שם פגום. */
                  aria-label={`הסר את ${compareLabel(p, items)} מההשוואה`}
                  /* ⚠️ 44×44 ולא 36×36: ארבעה ✕ ו-"נקה" צמודים בשורה אחת שנגללת. */
                  className="-my-1 inline-flex min-h-11 min-w-11 items-center justify-center text-lp-ink-2 hover:text-lp-rise"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            ref={clearRef}
            type="button"
            onClick={() => {
              clearedIds.current = items.map(compareCheckboxId);
              onClear();
            }}
            /* ⚠️ הגובה היה 44 אבל הרוחב 34 — יעד מגע נמדד בשני הצירים. */
            className="-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-xs text-lp-ink-2 hover:underline"
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
            /*
              ⚠️ מצב מושבת בטוקנים ולא ב-`opacity-40`. העמעום מצייר את
              הכפתור כולו — רקע **וטקסט** — ב-40% מעל הדף הלבן: הטקסט
              נשאר לבן בדיוק, הרקע מתבהר ל-#9dc6d8, והתוצאה היא 1.7:1
              על הכיתוב שהוא **עצמו** ההסבר ("בחרו עוד חבילה"). ההערה
              שמעל מתעדת למה הכיתוב הזה הוא כל מה שאומר למשתמש מקלדת
              למה אי אפשר להשוות — ואז הוא הודפס בצבע שאי אפשר לקרוא.
              `lp-surface-3` עם `lp-ink-2` הוא 5.4:1, אפור שנקרא
              כמושבת, ובלי שום צבע חדש.
            */
            className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
              items.length < 2
                ? "cursor-not-allowed bg-lp-surface-3 text-lp-ink-2"
                : "bg-lp-brand text-lp-ink-invert hover:bg-lp-brand-bright"
            }`}
          >
            {items.length < 2 ? "בחרו עוד חבילה" : "השוו"}
          </button>
        </div>
      </div>
      )}

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
          {/*
            ⚠️ `min-w-[32rem]` גם בטלפון. כאן היה `min-w-[20rem]` (320px)
            ו-`sm:min-w-[32rem]`, כלומר הרוחב הגדול נדלק רק מ-640px —
            דווקא במסך שיש בו מקום. ב-375px רוחב המכולה הוא 335px, גדול
            מ-320, ולכן ה-`overflow-x-auto` **לא** נכנס לפעולה והדפדפן
            דחס ארבע עמודות ל-~60px כל אחת: כותרת הטבלה לבדה תפסה 159px,
            שמות נשברו לחמש ושבע שורות, ו-"עד 2,500GB" נחתך לשתיים.
            עמודה צרה מהמסך גוללת; עמודה רחבה מהמסך נקראת.
          */}
          <table className="w-full min-w-[32rem] border-collapse text-sm">
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
                    /*
                     * ⚠️ `align-top` ולא `align-bottom`: השם מתחת ללוגו
                     * נשבר למספר שורות שונה בכל עמודה, ולכן יישור לתחתית
                     * דחף כל לוגו לגובה אחר — פער של 48px בין ארבעה
                     * לוגואים באותה שורה, שנקרא כשבירה ולא כטבלה.
                     */
                    className="border-b border-lp-line p-2 text-start align-top"
                  >
                    <ProviderLogo logo={providerLogo(p)} name={providerName(p)} size={26} />
                    {/* ⚠️ `packageTitle` ולא `p.name` — אותו שער כמו בשבב ובכרטיס.
                        ⚠️ ודרך `compareLabel`, כדי ששתי עמודות של רשומות
                        שונות לא תיקראנה כאותה חבילה — ראה ההערה שם. */}
                    <div className="mt-1 text-xs font-semibold text-lp-ink">
                      {compareLabel(p, items)}
                    </div>
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
              {/*
                ⚠️ "שיעור ההנחה" ולא "הנחה בחשבון": עשרה מתוך 19 מסלולי
                החשמל מצהירים במפורש שההנחה חלה על רכיב התשלום המשתנה
                בחשבון בלבד, והשורה `מה ההנחה כוללת` שמתחת נושאת את
                ההסתייגות. תווית שאינה נגזרת מאף רשומה הכריזה הנחה על
                החשבון כולו שורה אחת מעל ההסתייגות ששוללת אותה.
              */}
              <Row label={allElectric ? "שיעור ההנחה" : "מחיר לחודש"}>
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
 * ⚠️ הענף `period` נוסף כאן מפני שהתא הכריז "לא דווח שינוי" על 19
 * חבילות שכן דיווחו — בתיאור בלבד, בלי שהמחלץ העביר את המספר לשדה.
 * הנוסח אומר שיש תקופת מבצע ולא שהמחיר עולה, מהטעם שמתועד על
 * `PromoRise` ב-`format.ts`: בעשר מהן המחיר שבכרטיס הוא כבר מחיר הקבע.
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
/**
 * הנוסח כפי שהתא אומר אותו — **אותו** שער של הכרטיס ושל פס ההירו.
 *
 * ⚠️ זה היה המשטח השלישי שהדפיס את `rise.note` גולמי, ודווקא
 * מתחת לכותרת שורה שאומרת "אחרי ההטבה": על שמונה מ-11 הרשומות
 * הנוסח פותח במחיר **המבצע** (id 81: "39 ש\"ח למשך 3 חודשים"
 * בשורה של חבילה ב-₪99), כלומר הטבלה הודיעה שהמחיר יורד. התווית
 * נאמרת בתוך התא ולא נשענת על כותרת השורה, מפני שכותרת השורה היא
 * בדיוק הייחוס שאסור כאן.
 */
export function afterPromoNote(pkg: Package, note: string): string {
  if (promoNoteRises(pkg, note)) return note;
  return `${PROMO_NOTE_QUOTE_LABEL} ${promoNoteText(pkg, note)}`;
}

function AfterPromoCell({ pkg }: { pkg: Package }) {
  if (pkg.category === "electricity") return <Cell>—</Cell>;
  const rise = promoRise(pkg);
  /*
   * ⚠️ טון ה-"עלייה" רק ל-`amount`, בדיוק כמו בכרטיס. `PackageCard`
   * צובע `bg-lp-rise-soft text-lp-rise` על `amount` לבדו ומשאיר
   * `note` ו-`period` נייטרליים — כי `PromoRise` ב-`format.ts` קובע
   * ש-`period` **אינו** אומר שהמחיר עולה, ובעשר מ-19 הרשומות המחיר
   * שבכרטיס הוא כבר מחיר הקבע וההצהרה היא על מבצע זול בהתחלה.
   * הטון על שלושת הענפים אמר בצבע מה שהטיפוס אוסר לומר במילים.
   */
  return (
    <Cell
      /*
       * ⚠️ ול-`note` שמצהיר על עלייה. הנימוק שמעל נכון ל-`period`
       * (שאינו אומר דבר על כיוון) ולתשע מ-11 רשומות ה-`note` שבהן
       * המחיר שבכרטיס הוא כבר מחיר הקבע — אבל לא לשתיים שבהן הפרוזה
       * כן מצהירה על עלייה (ids 42, 61). `promoNoteRises` הוא השער
       * שמבדיל ביניהן, והוא זה שבוחר כאן את הטון: בשורה שכל תפקידה
       * הוא "למי מאלה המחיר עולה", id 42 הייתה העמודה הנקייה.
       */
      tone={
        rise?.kind === "amount" || (rise?.kind === "note" && promoNoteRises(pkg, rise.note))
          ? "rise"
          : undefined
      }
    >
      {rise
        ? rise.kind === "amount"
          ? shekels(rise.amount)
          : rise.kind === "note"
            ? afterPromoNote(pkg, rise.note)
            : PROMO_PERIOD_TEXT
        : hasKnownAfterPrice(pkg)
          ? "לא דווח שינוי"
          : "—"}
    </Cell>
  );
}

/*
 * ⚠️ תווית השורה היא `lp-ink-2` ולא `lp-ink-3`: 12px בצבע הזה הוא
 * 3.49:1, מתחת ל-AA — ראה את ההערה המלאה ב-`PackageCard`. דווקא כאן
 * זה המקום שבו ההצמדה "איזה מספר שייך לאיזו עובדה" נשענת על התווית.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="even:bg-lp-surface-2">
      <th scope="row" className="p-2 text-start align-top text-xs font-medium text-lp-ink-2">
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
