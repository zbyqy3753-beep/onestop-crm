"use client";

import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { dismissInstall, runInstall, useInstallMode } from "./installStore";

/**
 * הצעת התקנה של האפליקציה, במסך מלא, בטלפון בלבד.
 *
 * ⚠️ **אנדרואיד ואייפון הם שני עולמות שונים ואין ביניהם מכנה משותף.**
 * באנדרואיד יש `beforeinstallprompt` — הדפדפן מודיע שההתקנה אפשרית,
 * ואפשר לפתוח את הדיאלוג האמיתי בלחיצה אחת. **בספארי אין דבר כזה**:
 * אפל לא מימשה את האירוע, וההתקנה היא פעולה ידנית בתפריט השיתוף.
 * לכן יש כאן שני מסלולים נפרדים — כפתור אמיתי מול רשימת הוראות —
 * ולא נוסח אחד שמתיימר לכסות את שניהם.
 *
 * ⚠️ הסיבה שעד עכשיו לא הופיע כלום היא שלישית ולא קשורה לשניהם: לא
 * היה service worker. כרום לא יורה `beforeinstallprompt` בלעדיו, גם
 * כשהמניפסט מושלם — וזה נכשל בשקט, בלי שום סימן במסך.
 */
export function InstallPrompt() {
  const mode = useInstallMode();
  if (mode === "hidden") return null;

  return (
    <div
      /*
       * `z-[100]` — מעל סרגל הניווט התחתון (z-40) ומעל המגירות.
       * ריפודי `safe-area` כדי שהכותרת לא תיחתך במגרעת ושהכפתור
       * התחתון לא ייפול מתחת למחוון הבית.
       */
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-surface px-6 py-8 text-center"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 32px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="התקנת האפליקציה"
    >
      <button
        onClick={dismissInstall}
        aria-label="סגירה"
        className="absolute end-3 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 active:bg-surface-3"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <Icon name="close" size={22} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={84}
        height={84}
        className="mb-5 rounded-[20px] shadow-lg"
      />

      <h2 className="font-display text-[26px] font-bold leading-tight text-ink-1">
        התקן את ONE STOP
      </h2>

      <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-ink-3">
        פתיחה מהירה ממסך הבית, במסך מלא בלי סרגל הכתובת — בדיוק כמו
        אפליקציה רגילה.
      </p>

      {mode === "android" ? (
        <div className="mt-7 flex w-full max-w-[300px] flex-col gap-2">
          <Button
            variant="primary"
            className="h-12 w-full text-base"
            onClick={() => void runInstall()}
          >
            התקנה
          </Button>
          <Button variant="ghost" className="w-full" onClick={dismissInstall}>
            לא עכשיו
          </Button>
        </div>
      ) : (
        <IosSteps />
      )}
    </div>
  );
}

/**
 * הוראות לאייפון.
 *
 * ⚠️ אין כאן כפתור התקנה כי אי אפשר — ספארי לא חושפת שום API שמפעיל
 * את "הוסף למסך הבית". כפתור שכל תפקידו לומר "עכשיו לחץ שיתוף" היה
 * מבטיח פעולה שלא תקרה, ולכן זו רשימת צעדים.
 */
function IosSteps() {
  return (
    <div className="mt-7 w-full max-w-[300px]">
      <ol className="flex flex-col gap-2.5 text-start">
        <Step n={1}>
          לחץ על כפתור <b>השיתוף</b>
          <ShareGlyph />
          בסרגל התחתון של ספארי
        </Step>
        <Step n={2}>
          גלול ובחר <b>הוסף למסך הבית</b>
        </Step>
        <Step n={3}>
          לחץ <b>הוסף</b> בפינה העליונה
        </Step>
      </ol>

      <Button variant="ghost" className="mt-4 w-full" onClick={dismissInstall}>
        הבנתי
      </Button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 rounded-card border border-line bg-surface-2 px-3 py-2.5">
      <span className="nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand">
        {n}
      </span>
      <span className="text-sm leading-relaxed text-ink-2">{children}</span>
    </li>
  );
}

/** אייקון השיתוף של iOS — ריבוע עם חץ למעלה. */
function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={17}
      height={17}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mx-1 inline-block align-text-bottom text-brand"
    >
      <path d="M12 15V3" />
      <path d="M8.5 6.5L12 3l3.5 3.5" />
      <path d="M6 12H4.5v8.5h15V12H18" />
    </svg>
  );
}
