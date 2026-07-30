import { AppShell } from "@/components/shell/AppShell";
import { requireSessionUser } from "@/server/auth/session";

/**
 * מעטפת ה-shell (סרגל צד + סרגל עליון) — חלה על כל מסך שדורש אותה.
 *
 * מסכים שצריכים לרנדר בלי chrome (למשל `/form/[token]`, טופס ציבורי)
 * חיים מחוץ ל-route group הזה, ישירות תחת `src/app/`.
 *
 * ⚠️ המשתמש נשלף כאן ומועבר למטה כ-prop. קודם `AppShell` פשוט ייבא את
 * `DEV_USER` וקיבע אותו — כלומר הסרגל הציג תמיד "משתמש פיתוח", ומה
 * שחמור יותר, `visibleFor(user.role)` בנה את התפריט מתפקיד `owner`
 * קבוע. עובד רגיל ראה את כל פריטי הניהול.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSessionUser();
  return <AppShell user={user}>{children}</AppShell>;
}
