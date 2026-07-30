"use client";

import { useSyncExternalStore } from "react";

/**
 * רוחב המסך כמקור חיצוני.
 *
 * אותו דפוס כמו `clock.ts`: `useSyncExternalStore` עם
 * `getServerSnapshot` שמחזיר את ערך השולחן, כך שהשרת והרינדור הראשון
 * בלקוח מסכימים ואין אי-התאמת הידרציה. הרוחב האמיתי נכנס רק אחרי
 * שהלקוח נרשם.
 *
 * ⚠️ למה JS ולא CSS (`lg:hidden` + `hidden lg:block`)?
 *
 * כי במסך הלידים החלופה היא לרנדר את *שתי* התצוגות ולהסתיר אחת. זה
 * 50 שורות × 11 תאים פעמיים, וכל `InlinePicker` הופך לשני `<select>`
 * עם 15 `<option>` — כאלף וחצי צמתי DOM מיותרים, דווקא על המכשיר החלש
 * ביותר. בנוסף קורא מסך היה מקריא את הטבלה המוסתרת.
 *
 * המחיר: בטלפון נצבעת הטבלה למסגרת אחת לפני ההחלפה. זה מקובל — היא
 * יושבת מתחת לכותרת גבוהה וממילא מחוץ למסך בציור הראשון.
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

/** השרת תמיד מרנדר את תצוגת השולחן. */
function getServerSnapshot(): boolean {
  return false;
}

/** `true` כשהמסך צר מ-1024px. `false` בשרת ובציור הראשון. */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
