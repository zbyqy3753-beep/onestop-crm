/**
 * שני סקריפטים מוטבעים שרצים לפני ש-React עולה.
 *
 * מוטבעים ולא רכיב `useEffect` מסיבה אחת לכל אחד — ראה למטה.
 */

/**
 * תפיסת `beforeinstallprompt`.
 *
 * ⚠️ **חייב להיות מוטבע ב-`<head>`.** כרום יורה את האירוע ברגע שהוא
 * מחליט שהאתר בר-התקנה, וזה קורה מוקדם — לרוב **לפני** ש-React
 * הידרט והספיק לרשום מאזין. אירוע שאיש לא תפס אבוד, ואז אין מה
 * להציע: הכפתור פשוט לא יופיע לעולם, בלי שום שגיאה שתסביר למה.
 *
 * `preventDefault` מונע מכרום להציג את הבאנר המיני שלו, כדי שהמסך
 * שלנו יהיה ההצעה היחידה ולא השנייה.
 */
export const INSTALL_CAPTURE_SCRIPT = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__installEvent = e;
});
`.trim();

/**
 * רישום ה-service worker.
 *
 * ⚠️ אחרי `load` ולא מיד: רישום מתחרה על רוחב הפס עם הטעינה הראשונה,
 * ובטלפון בשטח זה מורגש בדיוק במסך הראשון שרואים.
 *
 * הרישום נכשל בשקט אם אין `serviceWorker` (ספארי בגלישה פרטית),
 * וזה תקין — האפליקציה עובדת גם בלעדיו; רק ההתקנה באנדרואיד לא
 * תוצע.
 */
export const SW_REGISTER_SCRIPT = `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
`.trim();
