import type { MetadataRoute } from "next";

/**
 * מניפסט האפליקציה — מה שהופך את האתר למשהו שאפשר להתקין למסך הבית.
 *
 * מוגש בכתובת `/manifest.webmanifest`, ו-Next פולט אוטומטית את
 * `<link rel="manifest">` ב-`<head>`.
 *
 * ⚠️ הנתיב הזה חייב להיות ב-`GATE_EXEMPT` שב-`proxy.ts`: הדפדפן מושך
 * את המניפסט בלי לצרף עוגיות (אין `crossorigin` על התגית ש-Next פולט),
 * ובלי הפטור הוא היה חוזר 404 וההתקנה פשוט לא הייתה מוצעת.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ONE STOP CRM",
    // עד 12 תווים — מעבר לזה מסך הבית חותך את השם
    short_name: "ONE STOP",
    description: "ניהול לידים, חבילות ועסקאות",
    lang: "he",
    dir: "rtl",

    /*
     * `/leads` ולא `/` בכוונה: הדשבורד הוא מסך של שולחן — סיכומים,
     * לוח מובילים, נתונים פיננסיים. בטלפון פותחים את האפליקציה כדי
     * לעבוד את התור, ולכן זה מה שצריך להיות המסך הראשון.
     *
     * מי שלא מחובר יופנה מכאן ל-`/login` ע"י ה-proxy — וזה תקין, זה
     * בדיוק המסלול שמאפשר להתחבר מתוך אפליקציה מותקנת באייפון, שמקבלת
     * צנצנת עוגיות נפרדת מספארי.
     */
    start_url: "/leads",
    scope: "/",
    display: "standalone",
    orientation: "portrait",

    background_color: "#081421", // --c-bg בתמה הכהה, כדי שמסך הפתיחה לא יהבהב בלבן
    theme_color: "#0d1f37", // Dark Navy — זהה לרקע האייקון

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // אנדרואיד חותך אייקונים לצורה של המערכת. הגרסה הזו מצוירת עם
        // הסימן קטן יותר, כך שהחיתוך לא אוכל לו את הקצוות.
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
