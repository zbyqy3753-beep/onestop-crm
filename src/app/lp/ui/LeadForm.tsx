"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  PROVIDER_CONFIG,
  PROVIDER_ORDER,
  type LeadCategoryKey,
} from "@/lib/domain/types";
import { submitLandingLead, type LandingState } from "../actions";
import { crmCategory } from "../config";
import { btnPrimary } from "./button";
import { fieldClass, labelClass } from "./field";
import { packageLabel, packageTitle, providerName } from "../catalog/catalog";
import type { Package } from "../catalog/types";

/**
 * טופס ההשארת פרטים של כרטיס חבילה.
 *
 * ⚠️ **Server Action ולא `fetch("/api/leads")`,** בניגוד למקור באתר
 * הציבורי. שם הטופס מדבר עם ה-API של האתר, שמעביר את הליד ל-CRM עם
 * מפתח שיושב בשרת שלו. כאן אנחנו *בתוך* ה-CRM: קריאה ל-`/api/leads`
 * מהדפדפן הייתה מחייבת מפתח API בתוך ה-JS של הדף, כלומר לפרסם אותו.
 *
 * ⚠️ רשימת הספקים היא של ה-CRM (`PROVIDER_CONFIG`) ולא
 * `PROVIDER_CHOICES` של האתר: הערך נשמר בעמודה `currentProvider`
 * שהיא enum, ומחרוזת חופשית הייתה נדחית באימות ומאבדת את השדה בשקט.
 */

const INITIAL: LandingState = { status: "idle" };

function Submit({ label }: { label: string }) {
  // ⚠️ קומפוננטה נפרדת: `useFormStatus` קורא את ה-`<form>` שמעליו, ומחזיר
  // תמיד `false` אם הוא נקרא באותה קומפוננטה שמרנדרת את הטופס.
  const { pending } = useFormStatus();
  /*
   * ⚠️ `aria-disabled` ולא `disabled`, כמו ב-`CompareTray` וב-CTA של
   * המחשבון. הדפדפן מסיר את הפוקוס מאלמנט שהושבת: גולש מקלדת שלחץ
   * Enter על הכפתור הוחזר ל-`<body>` לכל אורך השליחה — כלומר לראש
   * הדף, אחרי 106 כרטיסים — בזמן שהחלפת הכיתוב ל-"שולח…" אינה באזור
   * חי ולכן לא מוכרזת, כך שלא היה שום אישור שהלחיצה נקלטה. חלון
   * ה-pending כאן הוא הארוך ביותר בדף (בדיקת כפילות, כתיבה למסד, ואז
   * שתי התראות). הלחיצה השנייה נחסמת בקוד, ו-`actions.ts` חוסם
   * כפילות אמיתית בחלון 24 שעות בכל מקרה.
   */
  return (
    <>
      <button
        type="submit"
        aria-disabled={pending}
        onClick={(e) => {
          if (pending) e.preventDefault();
        }}
        /*
         * ⚠️ מצב השליחה בטוקנים ולא ב-`opacity-40` — אותו תיקון בדיוק
         * שנעשה ל-CTA של המחשבון (ראה ההערה ב-`SavingsCalculator`).
         * העמעום מצייר רקע **וטקסט** ב-40%: הטקסט נשאר לבן, הרקע
         * מתבהר ל-#97c2d5, והתוצאה היא 1.85:1 על הכיתוב "שולח…" —
         * בדיוק בחלון ה-pending הארוך ביותר בדף (בדיקת כפילות, כתיבה
         * למסד, שתי התראות), כלומר בדיוק כשהגולש צריך לקרוא שהלחיצה
         * נקלטה. בלי מילה קריאה הוא מניח שכלום לא קרה ולוחץ שוב.
         * `lp-surface-3` עם `lp-ink-2` הוא 5.4:1 ונקרא כמושבת.
         * `hover:` נדרס במפורש — `btnPrimary` נושא אותו.
         */
        className={`${btnPrimary} w-full py-3 ${
          pending ? "cursor-not-allowed bg-lp-surface-3 text-lp-ink-2 hover:bg-lp-surface-3" : ""
        }`}
      >
        {pending ? "שולח…" : label}
      </button>
      <span role="status" className="sr-only">
        {pending ? "שולח את הפנייה" : ""}
      </span>
    </>
  );
}

interface Props {
  /** החבילה שהכרטיס מציג. בטופס הכללי שבתחתית הדף אין כזו. */
  pkg?: Package;
  compact?: boolean;
  /**
   * קטגוריה כשאין חבילה — המחשבון יודע על מה נשאל, גם בלי שנבחרה
   * חבילה מסוימת. עם `pkg` הקטגוריה נגזרת ממנו וזה נדרס.
   */
  category?: LeadCategoryKey;
  /**
   * הקשר שייכתב כהערה הראשונה של הליד (למשל "משלם היום 220 ₪, 3
   * קווים"). כשהוא מסופק, תיבת הטקסט החופשית לא מוצגת: הנציג מקבל
   * את הנתון שהמבקר כבר הזין, ולא מבקשים ממנו לכתוב אותו שוב.
   */
  note?: string;
  /**
   * שם החבילה שהליד נוגע בה כשאין `pkg` — המחשבון בוחר חבילה אמיתית
   * אבל לא מרנדר את הכרטיס שלה.
   *
   * ⚠️ העמודה `packageName` היא שדה ייעודי ב-CRM. בלי הפרופ הזה ליד
   * מהמחשבון הגיע בלי שם חבילה בעמודה — והנציג שמסנן לפי חבילה לא
   * ראה אותו.
   */
  packageName?: string;
  /**
   * השורה השנייה בפאנל האישור כשאין `pkg` — מה הפנייה נוגעת בו.
   *
   * ⚠️ קיים כי הנפילה הקבועה ("לגבי החבילה המשתלמת עבורך") הבטיחה
   * חבילה משתלמת גם כשהמסך עצמו אמר את ההפך. המחשבון אינו מעביר
   * `pkg` אף פעם (הוא בוחר חבילה אבל לא מרנדר את הכרטיס שלה), ולכן
   * כל פנייה ממנו קיבלה את המשפט הזה — כולל אחרי "לפי הסכום שהזנתם
   * **לא נוכל להבטיח חיסכון**". אומת בקלט רגיל לגמרי: סלולר, קו
   * אחד, ₪30 → id 121 ב-₪34, `monthly: -4`, `worthwhile: false`;
   * וגם ב-₪34 / ביתי ב-₪149 / 5 קווים ב-₪150 (`monthly: 0`).
   * ההערה לנציג כבר אמרה במפורש "המחשבון לא מצא חיסכון" — כלומר
   * המסך היה פחות כנה מההערה שנשלחה עליו.
   *
   * `LeadForm` אינו רואה את `worthwhile`, ולכן המשפט בא מהקורא.
   */
  sentSubject?: string;
  /**
   * נקרא פעם אחת כשהפנייה נקלטה.
   *
   * ⚠️ מצב "נשלח" חי בתוך `useActionState`, כלומר בתוך הרכיב הזה
   * בלבד. קורא שמרנדר אותו מאחורי מתג פתיחה מוחק אותו כשהוא סוגר
   * את הפאנל, ובפתיחה הבאה הטופס חוזר ריק ובלי שום סימן שכבר
   * נשלחה פנייה — הזמנה לכפילות. הקולבאק מאפשר לקורא להחזיק את
   * העובדה בעצמו.
   */
  onSent?: () => void;
}

export function LeadForm({
  pkg,
  compact = false,
  category,
  note,
  packageName,
  sentSubject,
  onSent,
}: Props) {
  const [state, action] = useActionState(submitLandingLead, INITIAL);
  /*
   * ⚠️ `useId` ולא הקבוע `"general"`. שני טפסים ללא `pkg` חיים על אותו
   * דף — זה של המחשבון וזה שבתחתית העמוד — ומרגע שהמחשבון מגיע לשלב 3
   * היו בדף שני `id="lp-name-general"`. לחיצה על התווית "שם מלא" בטופס
   * התחתון הקפיצה את הפוקוס לשדה של המחשבון, בסקשן אחר לגמרי.
   */
  const autoId = useId();

  /*
   * ⚠️ שם החבילה דרך `packageTitle`/`packageLabel` ולא `pkg.name` חשוף —
   * ראה `catalog.ts`. הטופס היה **המשטח הרביעי** שקורא את השדה הזה
   * גולמי, אחרי שהשער חובר לכרטיס, לשבב במגש ההשוואה ולכותרת העמודה
   * בטבלה — ודווקא הוא יושב *בתוך* הכרטיס שכבר מגודר. אומת בפועל על
   * `name: {}`:
   *
   * 1. הפסקה "נציג ONE STOP יחזור אליך לגבי …" (המסלול שאינו `compact`)
   *    זרקה `Objects are not valid as a React child`. לענף הזה אין
   *    קורא בדף היום — שני הקוראים מעבירים `compact` — ולכן זה שער
   *    לקורא הבא ולא פגם מוצג; אבל זו בדיוק מחלקת הכשל שמחזירה את
   *    `/lp` כולו ב-500 ברגע שהטופס יוצג מרכיב שרת.
   * 2. השדה המוסתר `packageName` נשלח כ-`[object Object] · גולן טלקום`
   *    (וב-`name: null` כ-`null · גולן טלקום`). זה גרוע מהראשון בצורה
   *    אחרת: אין שגיאה, הליד **נרשם** — והנציג מקבל בעמודה הייעודית
   *    מחרוזת שאינה שם של שום חבילה, בלי שום דרך לדעת על מה הפנייה.
   * 3. אותו דבר בפאנל האישור שהמבקר רואה אחרי השליחה.
   *
   * ⚠️ בעמודת ה-CRM מצרפים את הספק רק כשיש שם: `packageLabel` נופל
   * לשם הספק, ו-"גולן טלקום · גולן טלקום" הוא עמודה שאומרת את אותו
   * דבר פעמיים. בשני הטקסטים שהמבקר רואה דווקא כן נדרשת נפילה חזרה —
   * "לגבי " בלי מושא הוא משפט קטוע.
   */
  const provider = pkg ? providerName(pkg) : "";
  const title = pkg ? packageTitle(pkg) : "";

  /*
   * ⚠️ שתי נקודות שבהן הפוקוס נמחק: האחת בהצלחה (הטופס מוחלף
   * בפאנל אישור) והשנייה בשגיאה (ה-`key` מפרק ובונה מחדש את
   * אלמנט ה-`<form>`). בשתיהן הכפתור שנלחץ עליו יוצא מה-DOM,
   * וגולש מקלדת נזרק לראש הדף בדיוק ברגע שבו הוא צריך לקרוא
   * מה לתקן.
   */
  const sentRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  /*
   * ⚠️ ב-ref ולא בתלות: קוראים מעבירים פונקציה אנונימית חדשה בכל
   * רינדור, והכנסתה למערך התלויות הייתה מריצה את האפקט שוב ושוב
   * (ואיתו גם גניבת הפוקוס).
   */
  const onSentRef = useRef(onSent);
  useEffect(() => {
    onSentRef.current = onSent;
  });

  useEffect(() => {
    if (state.status !== "sent") return;
    sentRef.current?.focus();
    onSentRef.current?.();
  }, [state.status]);

  /*
   * תלוי ב-`state` עצמו ולא ב-`status` בלבד: שתי שגיאות רצופות נשאות
   * אותו `status: "error"`, והפוקוס צריך לחזור גם בשנייה.
   */
  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  if (state.status === "sent") {
    return (
      /*
       * ⚠️ `role="status"` ו-`tabIndex={-1}` עם פוקוס: הפאנל הזה מחליף את
       * ה-`<form>` כולו, ולכן כפתור השליחה שהיה בפוקוס נמחק מה-DOM
       * והפוקוס נפל ל-`<body>`. בלי אזור חי גולש קורא-מסך לא שמע
       * דבר — הוא לא יודע אם הפנייה נשלחה, וה-Tab הבא שלו מתחיל
       * מראש הדף — והטופס הזה יושב אחרי 106 כרטיסי חבילה.
       */
      <div
        ref={sentRef}
        tabIndex={-1}
        role="status"
        className="rounded-lp-card bg-lp-save/10 p-4 text-center"
      >
        <p className="font-semibold text-lp-save">קיבלנו! נציג ONE STOP יחזור אליך בהקדם.</p>
        <p className="mt-1 text-sm text-lp-ink-2">
          {/* ⚠️ `sentSubject` לפני הנפילה הקבועה — ראה ההערה על הפרופ. */}
          {pkg ? `לגבי ${packageLabel(pkg, provider)}` : (sentSubject ?? "לגבי החבילה המשתלמת עבורך")}
        </p>
      </div>
    );
  }

  /*
   * מזהה ייחודי לשדות: כל כרטיס מרנדר טופס משלו, ו-`id` כפול היה מקשר
   * את התווית של כרטיס אחד לשדה של אחר.
   *
   * ⚠️ `autoId` גם כשיש `pkg`, ולא `pkg.id` לבדו. אותה חבילה מרונדרת
   * **פעמיים** בדף: `highlights()` בוחרת שלוש לכל קטגוריה בסקשן
   * "חבילות נבחרות", ו-`CatalogTabs` מקבל את אותו מערך ומרנדר אותה
   * שוב. מי שפתח "שיחזרו אליי" על שני העותקים קיבל בדף שני
   * `id="lp-name-<pkgId>"`, ולחיצה על התווית בכרטיס שבקטלוג הקפיצה
   * את הפוקוס לשדה של הכרטיס שמאות פיקסלים למעלה. `pkg.id` נשאר
   * בתוך המזהה כדי שיישאר קריא ב-DOM בזמן דיבוג.
   */
  const uid = pkg ? `${pkg.id}-${autoId}` : autoId;

  /*
   * ⚠️ מה שהוקלד לפני שגיאת שרת. React 19 מאפס `<form action>` בסיום
   * הפעולה גם כשהיא נכשלה, ולכן השדות הם לא-מבוקרים עם `defaultValue`
   * מהתשובה — כך "טלפון לא תקין" מופיע מול הטלפון שהוקלד ולא מול שדה
   * ריק. ה-`key` על הטופס מרנדר אותו מחדש בכל שגיאה כדי שה-default
   * החדש ייקלט (לא-מבוקר קורא אותו רק במאונט).
   */
  /*
   * ⚠️ ה-`key` נגזר מ**כל** מה שהוחזר, ולא מההודעה והטלפון בלבד. עם
   * המפתח הצר, שגיאה שחוזרת עם אותה הודעה ואותו טלפון השאירה את ה-`key`
   * זהה — הטופס לא רונדר מחדש, והאיפוס של React 19 החזיר את השדות
   * ל-`defaultValue` ה**ישן**: גולש שהטלפון שלו פסול, תיקן בטעות רק את
   * השם ושלח שוב, ראה את השם המתוקן נעלם מול עיניו.
   */
  const echoed = state.status === "error" ? state.values : undefined;
  const formKey =
    state.status === "error" ? `${state.message}|${JSON.stringify(state.values ?? {})}` : "idle";

  return (
    <form key={formKey} action={action} className="space-y-3" noValidate>
      {pkg && !compact && (
        <p className="text-sm text-lp-ink-2">
          נציג ONE STOP יחזור אליך לגבי{" "}
          <span className="font-semibold text-lp-ink">{packageLabel(pkg, provider)}</span>
        </p>
      )}

      {state.status === "error" && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="rounded-lg bg-lp-rise-soft p-3 text-sm text-lp-rise"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        <div>
          <label className={labelClass} htmlFor={`lp-name-${uid}`}>
            שם מלא
          </label>
          <input
            id={`lp-name-${uid}`}
            name="name"
            className={fieldClass}
            autoComplete="name"
            maxLength={80}
            defaultValue={echoed?.name}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`lp-phone-${uid}`}>
            טלפון
          </label>
          {/*
            בלי `pattern`: האימות האמיתי בשרת מקבל מקפים, רווחים ו-+972,
            ו-`pattern` היה חוסם דווקא את מי שכותב את המספר כרגיל.
          */}
          <input
            id={`lp-phone-${uid}`}
            name="phone"
            type="tel"
            /*
             * ⚠️ `tel` ולא `numeric`. ההערה שמתחת מנמקת את `dir="ltr"`
             * דווקא ב-`+972` — "צורה שהאימות בשרת מקבל במפורש" — אבל
             * `inputMode="numeric"` מחליף באייפון את מקלדת הטלפון
             * במקלדת ספרות בלבד, שאין בה `+`. כלומר מי שמקליד בנייד
             * את המספר בצורה הבינלאומית אינו יכול להקליד את התו הראשון
             * של הצורה שהקוד כאן טורח לתמוך בה. `tel` נותנת את אותה
             * מקלדת ספרות-תחילה, עם `+` ועם המקף.
             */
            inputMode="tel"
            /*
             * ⚠️ `dir="ltr"` כמו בשדה הטלפון הציבורי השני (`/form/[token]`).
             * בלעדיו השדה יורש `rtl` מה-`<html>`, וה-`+` המוביל ב-`+972`
             * — צורה שהאימות בשרות מקבל במפורש — הוא `ON` ללא `EN`
             * לפניו, מקבל את כיוון הפסקה ונודד לקצה הימני:
             * `+972-50-1234567` מוצג כ-`972-50-1234567+`. המספר נשמר נכון,
             * אבל הגולש רואה מספר משובש ומוחק אותו.
             */
            dir="ltr"
            className={fieldClass}
            autoComplete="tel"
            placeholder="050-0000000"
            maxLength={20}
            defaultValue={echoed?.phone}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor={`lp-prov-${uid}`}>
          הספק הנוכחי שלך <span className="text-lp-ink-3">(עוזר להכין הצעה מדויקת)</span>
        </label>
        <select id={`lp-prov-${uid}`} name="provider" className={fieldClass} defaultValue={echoed?.provider ?? ""}>
          <option value="">לא רוצה לציין</option>
          {PROVIDER_ORDER.map((key) => (
            <option key={key} value={key}>
              {PROVIDER_CONFIG[key].label}
            </option>
          ))}
        </select>
      </div>

      {!pkg && !note && (
        <div>
          <label className={labelClass} htmlFor={`lp-msg-${uid}`}>
            משהו שנשמח לדעת מראש <span className="text-lp-ink-3">(לא חובה)</span>
          </label>
          <textarea
            id={`lp-msg-${uid}`}
            name="message"
            rows={3}
            maxLength={500}
            className={fieldClass}
            defaultValue={echoed?.message}
            placeholder="למשל: כמה קווים, מה אני משלם היום, מתי נוח לחזור אליי"
          />
        </div>
      )}
      {note && <input type="hidden" name="message" value={note} />}

      {/*
        הקשר החבילה. `category` נשלח כערך של ה-CRM ונבדק בשרת מול רשימה
        סגורה — ראה `crmCategory`.
      */}
      <input
        type="hidden"
        name="category"
        value={pkg ? crmCategory(pkg) : (category ?? "general")}
      />
      {pkg ? (
        <input
          type="hidden"
          name="packageName"
          value={title ? `${title} · ${provider}` : provider}
        />
      ) : packageName ? (
        <input type="hidden" name="packageName" value={packageName} />
      ) : null}

      {/* פיתיון — ראה `.lp-honey` ב-lp.css ואת הבדיקה ב-actions.ts */}
      <div className="lp-honey" aria-hidden="true">
        <label htmlFor={`lp-website-${uid}`}>אתר</label>
        <input id={`lp-website-${uid}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-lp-ink-2">
        {/*
          ⚠️ `name` — בלעדיו השדה כלל לא נשלח, והטופס הוא `noValidate`,
          כלומר ה-`required` אינו חוסם. ההסכמה נאכפת בשרת ונשמרת ככל
          שדה אחר; קודם לכן נוצרו לידים חמים בלי שום רישום שהיא ניתנה.
        */}
        <input
          type="checkbox"
          name="consent"
          value="1"
          required
          defaultChecked={echoed?.consent}
          className="mt-0.5 h-4 w-4 shrink-0 accent-lp-brand"
        />
        <span>
          אני מאשר/ת שנציג ONE STOP יצור איתי קשר בטלפון או בוואטסאפ בנוגע לפנייה זו, בהתאם
          למדיניות הפרטיות.
        </span>
      </label>

      <Submit label="שיחזרו אליי" />
    </form>
  );
}
