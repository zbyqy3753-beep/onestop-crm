import { AppShell } from "@/components/shell/AppShell";

/**
 * מעטפת ה-shell (סרגל צד + סרגל עליון) — חלה על כל מסך שדורש אותה.
 *
 * מסכים שצריכים לרנדר בלי chrome (למשל `/form/[token]`, טופס ציבורי)
 * חיים מחוץ ל-route group הזה, ישירות תחת `src/app/`.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
