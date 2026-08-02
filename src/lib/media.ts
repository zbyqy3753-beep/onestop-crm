"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { NARROW_VALUE, WIDE_VALUE, WIDTH_COOKIE } from "./widthCookie";

/**
 * רוחב המסך כמקור חיצוני.
 *
 * אותו דפוס כמו `clock.ts`: `useSyncExternalStore`, כך שהשרת והרינדור
 * הראשון בלקוח מסכימים ואין אי-התאמת הידרציה.
 *
 * ⚠️ למה JS ולא CSS (`lg:hidden` + `hidden lg:block`)?
 *
 * כי במסך הלידים החלופה היא לרנדר את *שתי* התצוגות ולהסתיר אחת. זה
 * 50 שורות × 11 תאים פעמיים, וכל `InlinePicker` הופך לשני `<select>`
 * עם 15 `<option>` — כאלף וחצי צמתי DOM מיותרים, דווקא על המכשיר החלש
 * ביותר. בנוסף קורא מסך היה מקריא את הטבלה המוסתרת.
 *
 * ⚠️ **המחיר הזה שולם, ועכשיו הוא מוחזר.** קודם `getServerSnapshot`
 * החזיר תמיד `false`, ולכן כל טעינה בטלפון ציירה קודם טבלה של 900px
 * והחליפה אותה בהידרציה. ההערה כאן טענה שזה מקובל כי הטבלה יושבת
 * מתחת לכותרת גבוהה וממילא מחוץ למסך — הכותרת הזו כווצה מ-396px
 * ל-250, והתירוץ נעלם איתה.
 *
 * הפתרון: הלקוח כותב את הרוחב לעוגייה, ה-layout קורא אותה ומזריק
 * אותה כערך ההתחלתי. ביקור ראשון עדיין מהבהב; כל ביקור אחריו לא.
 */

/** מתחת לזה עוברים לתצוגת כרטיסים. תואם ל-`lg` של Tailwind. */
const BREAKPOINT = 1024;

let query: MediaQueryList | null = null;

function getQuery(): MediaQueryList {
  query ??= window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
  return query;
}

function subscribe(onChange: () => void): () => void {
  const mq = getQuery();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return getQuery().matches;
}

/**
 * מה שהשרת ידע בזמן הרינדור — הרמז מהעוגייה של הביקור הקודם.
 *
 * ⚠️ Context ולא משתנה מודול: משתנה מודול משותף בין בקשות בשרת,
 * ושני משתמשים במקביל היו דורסים זה את הרוחב של זה.
 */
const InitialNarrow = createContext(false);

export const InitialNarrowProvider = InitialNarrow.Provider;

/** `true` כשהמסך צר מ-1024px. */
export function useIsNarrow(): boolean {
  const initial = useContext(InitialNarrow);
  return useSyncExternalStore(subscribe, getSnapshot, () => initial);
}

/**
 * מעדכן את העוגייה כשהיא לא תואמת למציאות.
 *
 * נקרא מ-`AppShell` בכל רינדור; כותב רק כשיש פער, כדי שהמקרה הרגיל
 * (ההערכה נכונה) לא יעשה כלום.
 */
export function syncWidthCookie(narrow: boolean): void {
  const want = narrow ? NARROW_VALUE : WIDE_VALUE;
  if (document.cookie.includes(`${WIDTH_COOKIE}=${want}`)) return;
  document.cookie = `${WIDTH_COOKIE}=${want}; path=/; max-age=31536000; samesite=lax`;
}
