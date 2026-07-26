import type { Metadata } from "next";
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
