import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ImpersonationBanner } from "@/components/shell/ImpersonationBanner";
import { db } from "@/server/repositories";
import { getImpersonatorId, getSessionUser } from "@/server/auth/session";

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
  // `getSessionUser` ולא `requireSessionUser`: עוגייה שמצביעה על משתמש
  // שכבר לא קיים היא מצב צפוי — משתמש שנמחק, או סשן ששרד אותו — והיא
  // צריכה להחזיר למסך התחברות, לא לזרוק 500. ה-proxy בודק רק שהעוגייה
  // *קיימת*, ולכן זו הנקודה הראשונה שיודעת שהיא חסרת תוקף.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // בזמן התחזות — באנר קבוע בראש כל מסך, עם שתי הזהויות ודרך חזרה.
  // `getSessionUser` כבר מחזיר את המתוחזה, כך שכל השאר מתנהג רגיל.
  const realId = await getImpersonatorId();
  const realUser = realId ? await db.users.getById(realId) : null;

  return (
    <>
      {realUser && (
        <ImpersonationBanner
          impersonatedName={user.name}
          realName={realUser.name}
        />
      )}
      <AppShell user={user}>{children}</AppShell>
    </>
  );
}
