"use client";

import { useSyncExternalStore } from "react";

/**
 * "עכשיו" כמקור חיצוני.
 *
 * זמן הוא מצב שחי מחוץ ל-React, ולכן הוא נקרא דרך useSyncExternalStore
 * ולא דרך useState בתוך useEffect. זה גם מה שפותר את בעיית ההידרציה:
 * `getServerSnapshot` מחזיר 0, כך שהשרת והרינדור הראשון בלקוח מסכימים,
 * והזמן האמיתי נכנס רק אחרי שהלקוח נרשם.
 */

let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
const TICK_MS = 60_000;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  if (timer === null) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return current;
}

/** 0 = "עדיין לא ידוע" — הערך שהשרת רואה. */
function getServerSnapshot(): number {
  return 0;
}

/**
 * מחזיר חותמת זמן, או `null` לפני שהלקוח נרשם.
 *
 * `null` הוא הסימן שאסור עדיין לרנדר זמן יחסי — ראה שימוש
 * ב-LeadsTable, שמשאיר מקום ריק במקום להציג "לפני 3 שע׳" שהשרת
 * לא יכול היה לחשב.
 */
export function useNow(): number | null {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return now === 0 ? null : now;
}
