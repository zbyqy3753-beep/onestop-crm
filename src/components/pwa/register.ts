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
 *
 * ⚠️ לא נרשם באתר של אלירן (`eliran.onestopil.co.il`): שם מוגש רק דף
 * הנחיתה, וה-worker של המערכת היה מציע ללקוח "להתקין" את ה-CRM ומגיש
 * לו את דף ה-offline שלה. `proxy.ts` גם מפנה שם את `/sw.js` לדף הבית.
 */
export const SW_REGISTER_SCRIPT = `
if ("serviceWorker" in navigator && location.hostname !== "eliran.onestopil.co.il") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
`.trim();
