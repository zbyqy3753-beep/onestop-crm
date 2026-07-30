import type { Metadata, Viewport } from "next";
import { Assistant, Frank_Ruhl_Libre } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

/** פונט התצוגה — משמש בצמצום, לכותרות מסך ולמספרים גדולים בלבד. */
const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  variable: "--font-frank",
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ONE STOP | ניהול לידים",
  description: "מערכת ניהול לידים, חבילות ועסקאות",
  robots: { index: false, follow: false },

  /**
   * מה שאייפון קורא כשמוסיפים למסך הבית: פותח במצב עצמאי בלי סרגל
   * הכתובת של ספארי, ושם התווית מתחת לאייקון.
   */
  appleWebApp: {
    capable: true,
    title: "ONE STOP",
    // הרקע מאחורי שעון המערכת. `default` ולא `black-translucent` —
    // האחרון מותח את התוכן מתחת לשעון, וסרגל הניווט שלנו היה נחתך.
    statusBarStyle: "default",
  },
};

/**
 * ⚠️ במפורש בלי `maximumScale` ו-`userScalable: false`.
 *
 * הם היו פותרים את זום הקלט של ספארי, אבל במחיר שבירת הזום לכולם —
 * וזו נסיגה בנגישות בעברית קטנה על מסך של 390px. הפתרון הנכון לזום
 * הקלט הוא גופן 16px בשדות (ראה `inputClass`), וזה מה שנעשה.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // צובע את שורת הסטטוס של הדפדפן. שתי רשומות כי לאפליקציה יש שתי
  // תמות, והערכים זהים ל-`--c-bg` ב-globals.css.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#081421" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      data-theme="light"
      suppressHydrationWarning
      className={`${assistant.variable} ${frank.variable}`}
    >
      <head>
        {/*
          רץ בזמן פענוח ה-HTML, לפני הציור הראשון. useEffect היה גורם
          להבהוב תמה בכל טעינה. suppressHydrationWarning על <html>
          הכרחי כאן — בלעדיו React יראה את התיקון כאי-התאמה ויצייר מחדש.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
