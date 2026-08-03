/*
 * Service worker — קיים כדי שאפשר יהיה להתקין את האפליקציה.
 *
 * ⚠️ **הוא במכוון כמעט לא עושה כלום.** כרום לא מציע התקנה (ולא יורה
 * `beforeinstallprompt`) לאתר בלי service worker עם מטפל `fetch` —
 * וזו הסיבה היחידה שהקובץ הזה קיים.
 *
 * ⚠️⚠️ **אסור לו לשמור במטמון תוכן של האפליקציה.** זה CRM מאחורי
 * התחברות: כל מסך תלוי במי שמחובר, והנתונים משתנים כל הזמן. מטמון
 * של HTML או של תשובות API היה מציג לעובד אחד את המסך של אחר, או
 * לידים מלפני יומיים בלי שום סימן שהם ישנים. שני הכשלים האלה שקטים,
 * ולכן מסוכנים במיוחד.
 *
 * מה שכן נשמר: עמוד נפילה סטטי אחד, שאין בו שום נתון.
 */

const CACHE = "onestop-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
  // בלי זה גרסה חדשה ממתינה עד שכל הלשוניות ייסגרו — ובאפליקציה
  // מותקנת זה כמעט לא קורה, כך שתיקונים לא מגיעים
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // ניווטים בלבד מקבלים נפילה לעמוד הלא-מקוון. כל השאר — בקשות API,
  // נכסים, פעולות שרת — עוברות לרשת כמו שהן, בלי שכבה באמצע.
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        // ⚠️ רק כישלון רשת אמיתי מגיע לכאן. תשובות 401/404/500 הן
        // תשובות תקינות ועוברות למעלה כמו שהן — החלפתן ב"אין חיבור"
        // הייתה מסתירה שגיאות אמיתיות מאחורי הודעה שגויה.
        const cache = await caches.open(CACHE);
        const fallback = await cache.match(OFFLINE_URL);
        return (
          fallback ??
          new Response("אין חיבור לאינטרנט", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});
