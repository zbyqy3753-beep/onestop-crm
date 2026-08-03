import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
