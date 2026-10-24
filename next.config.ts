import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * שרת הפיתוח, כשנפתח מהטלפון ברשת הביתית (`http://10.0.0.26:3017`).
   *
   * ⚠️ בלי זה Next חוסם את קבצי הפיתוח לכל כתובת שאינה localhost: הדף
   * נטען, אבל ה-JavaScript לא עולה — כל הכפתורים נראים ולא עובדים.
   * חל על `next dev` בלבד; בייצור אין לזה שום השפעה.
   */
  allowedDevOrigins: ["10.0.0.26"],

  experimental: {
    /**
     * ⚠️ ברירת המחדל היא 1MB, וחשבונית PDF אחת חוצה אותה בקלות —
     * שלא לדבר על העלאה של כמה קבצים יחד במסך החידושים. בלי זה
     * ההעלאה נכשלת בשגיאת רשת גנרית שלא מסבירה כלום.
     *
     * 10MB תואם למגבלה שהוגדרה על דלי `renewals` עצמו, כך שאין גודל
     * שעובר כאן ונדחה שם.
     */
    serverActions: { bodySizeLimit: "10mb" },
  },

  /**
   * הפריסה פרטית — גרסת בדיקה שנגישה בקישור סודי בלבד.
   * הכותרת חלה על כל תשובה, גם היכן ש-robots.txt לא מספיק.
   *
   * ⚠️ חוץ מהאתר של אלירן (`eliran.onestopil.co.il`), שפתוח לאינדוקס
   * מ-24.10.2026 — יש לו פרופיל עסק בגוגל שמקשר אליו. הכתובת הזו מגישה
   * רק את דף הנחיתה (ראה `eliranSite` ב-`proxy.ts`), ולכן הפטור לא
   * חושף אף מסך של המערכת. ההחלטה בשלושה מקומות: כאן, `robots.ts`
   * ו-`metadata` ב-`lp/page.tsx`.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        missing: [{ type: "host", value: "eliran.onestopil.co.il" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
