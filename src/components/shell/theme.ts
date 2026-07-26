export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "onestop.theme";

/**
 * מורץ inline ב-<head>, לפני הציור הראשון.
 *
 * סדר העדיפויות: בחירה מפורשת של המשתמש → העדפת מערכת ההפעלה → בהיר.
 * מכווץ ידנית כי הוא נכנס ל-HTML כמחרוזת.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}",s=localStorage.getItem(k),t=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

/**
 * התמה נשמרת ב-DOM, לא ב-React — הסקריפט ה-inline כותב אותה לפני
 * שReact בכלל עולה. לכן היא נקראת כמקור חיצוני, ו-useState בתוך
 * useEffect היה יוצר מקור אמת שני שנוטה לצאת מסנכרון.
 */

const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** קורא את התמה הפעילה מה-DOM. */
export function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/** מה שהשרת "רואה" — חייב להתאים ל-data-theme הראשוני שב-layout. */
export function readServerTheme(): Theme {
  return "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // מצב פרטי / אחסון חסום — התמה עדיין תחול לסשן הנוכחי
  }
  for (const listener of listeners) listener();
}
