import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
