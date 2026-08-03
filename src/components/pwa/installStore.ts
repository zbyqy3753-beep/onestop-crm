import { useSyncExternalStore } from "react";

/**
 * האם ואיך להציע התקנה — כחנות חיצונית.
 *
 * ⚠️ `useSyncExternalStore` ולא `useState` + `useEffect`, באותו דפוס
 * של `useVisibleColumns` ו-`useNow`: השרת מחזיר "אל תציג" והלקוח
 * מחזיר את התשובה האמיתית, בלי אי-התאמת הידרציה ובלי רינדור נוסף.
 * זיהוי פלטפורמה הוא בדיוק המקרה שהדפוס הזה קיים בשבילו.
 */

export type InstallMode = "hidden" | "android" | "ios";

/** האירוע לא בתקן — קיים בכרום בלבד ולכן לא ב-lib.dom. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** נתפס ע"י הסקריפט המוטבע ב-layout, לפני ש-React עולה */
    __installEvent?: BeforeInstallPromptEvent;
  }
}

/**
 * כמה זמן לא להציע שוב אחרי סגירה.
 *
 * ההצעה תופסת מסך מלא, ולכן היא **חייבת** לזכור: מסך חוסם שחוזר בכל
 * כניסה הוא לא תזכורת אלא מכשול, והתגובה אליו היא להפסיק לפתוח את
 * המערכת בטלפון — לא להתקין.
 */
const SNOOZE_MS = 14 * 24 * 3_600_000;
const SNOOZE_KEY = "os_install_snoozed_at";

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    // גלישה פרטית — עדיף להציע מאשר ליפול
    return false;
  }
}

function markSnoozed(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* אחסון חסום — ההצעה פשוט תחזור בכניסה הבאה */
  }
}

/** האם בכלל שייך להציע כאן — בלי קשר לפלטפורמה. */
function worthOffering(): boolean {
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    // ⚠️ ספארי בלבד, ולא מוגדר ב-TS
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed) return false;

  // רק טלפון. הצעה להתקין אפליקציה על מחשב שולחני היא רעש.
  if (!window.matchMedia("(max-width: 1023px)").matches) return false;

  return !snoozed();
}

function detect(): InstallMode {
  if (typeof window === "undefined") return "hidden";
  if (!worthOffering()) return "hidden";

  const ua = navigator.userAgent;

  /*
   * ⚠️ iPadOS מדווח על עצמו כ-Macintosh. בלי בדיקת נקודות המגע אייפד
   * היה נחשב שולחני ולא מקבל שום הצעה.
   */
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // ספארי בלבד: בכרום/פיירפוקס על iOS אין "הוסף למסך הבית" באותו
    // מקום, והוראות שגויות גרועות מכלום
    return /crios|fxios|edgios/i.test(ua) ? "hidden" : "ios";
  }

  // אנדרואיד: אפשר להציע רק אם הדפדפן כבר אמר שההתקנה זמינה
  return window.__installEvent ? "android" : "hidden";
}

let snapshot: InstallMode | null = null;
const listeners = new Set<() => void>();

function emit(next: InstallMode): void {
  snapshot = next;
  for (const l of listeners) l();
}

function getSnapshot(): InstallMode {
  // `useSyncExternalStore` דורש הפניה יציבה — מחשבים פעם אחת
  if (snapshot === null) snapshot = detect();
  return snapshot;
}

function getServerSnapshot(): InstallMode {
  return "hidden";
}

let wired = false;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // המאזינים נרשמים פעם אחת לכל חיי העמוד, לא לכל מנוי
  if (!wired) {
    wired = true;

    // האירוע עשוי להגיע גם **אחרי** הרינדור הראשון — כרום מחליט
    // מתי האתר בר-התקנה, וזה לא בהכרח בטעינה
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      window.__installEvent = e as BeforeInstallPromptEvent;
      if (worthOffering()) emit("android");
    });

    window.addEventListener("appinstalled", () => {
      window.__installEvent = undefined;
      emit("hidden");
    });
  }

  return () => listeners.delete(onChange);
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** סגירה ידנית — לא להציע שוב לזמן מה. */
export function dismissInstall(): void {
  markSnoozed();
  emit("hidden");
}

/**
 * פותח את דיאלוג ההתקנה של אנדרואיד.
 *
 * ⚠️ האירוע חד-פעמי: אחרי `prompt()` אי אפשר להשתמש בו שוב, ולכן הוא
 * מנוקה כאן. סירוב נרשם כדחייה — מי שאמר "לא" לדיאלוג המערכת לא צריך
 * לראות את המסך שלנו שוב מחר.
 */
export async function runInstall(): Promise<void> {
  const evt = window.__installEvent;
  if (!evt) return dismissInstall();

  window.__installEvent = undefined;

  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "dismissed") markSnoozed();
  } catch {
    /* הדיאלוג נדחה או כבר נצרך — בכל מקרה סוגרים */
  }

  emit("hidden");
}
