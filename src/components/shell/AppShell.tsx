"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { ROLE_CONFIG } from "@/lib/domain/types";
import type { User } from "@/lib/domain/types";
import { useNow } from "@/lib/clock";
import { endSession } from "@/app/login/actions";
import { NAV, visibleFor } from "./nav";
import { BottomNav } from "./BottomNav";
import { MoreSheet } from "./MoreSheet";
import {
  applyTheme,
  readServerTheme,
  readTheme,
  subscribeTheme,
  type Theme,
} from "./theme";

/**
 * המעטפת של האפליקציה: סרגל צד קבוע + אזור תוכן.
 *
 * המשתמש מגיע כ-prop מה-layout, שמושך אותו מהסשן האמיתי. אל תחזיר
 * כאן ייבוא של `DEV_USER` — התפריט נגזר מ-`user.role`, ולכן ערך קבוע
 * כאן פירושו שכל משתמש רואה את הרשאות ה-owner.
 */
export function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = visibleFor(user.role);

  const [moreOpen, setMoreOpen] = useState(false);

  /*
   * סוגר את הגיליון בכל מעבר מסך. ה-`Link`-ים שבתוכו סוגרים אותו
   * בעצמם, אבל כפתור "אחורה" של הדפדפן לא עובר דרכם — ובאפליקציה
   * מותקנת "אחורה" הוא מחוות ההחלקה, כלומר הדרך הנפוצה לנווט.
   *
   * התאמה בזמן רינדור ולא `useEffect`: זה הדפוס שהתיעוד של React
   * מגדיר ל"אפס מצב כשמשהו חיצוני השתנה", והוא נמנע מרינדור כפול.
   */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMoreOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* הגרדיאנט הרשמי — הנוכחות היחידה שלו במלואו */}
      <div className="brand-rule h-[3px] shrink-0" />

      <div className="flex min-h-0 flex-1">
        <Sidebar groups={groups} pathname={pathname} user={user} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          {/*
            ריפוד תחתון בגובה סרגל הניווט — בלעדיו הפריט האחרון בכל
            מסך יושב מתחתיו. בשולחן אין סרגל ואין ריפוד.
          */}
          <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </main>
        </div>
      </div>

      <BottomNav
        role={user.role}
        pathname={pathname}
        onMore={() => setMoreOpen(true)}
        moreOpen={moreOpen}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        user={user}
        pathname={pathname}
      />
    </div>
  );
}

/* ── סרגל צד ──────────────────────────────────────────────────────────── */

/**
 * סרגל הצד — **שולחן בלבד**.
 *
 * ⚠️ כאן ישבה גם גרסת ה-drawer החוץ-קנבס לטלפון (`translate-x-full`,
 * scrim, כפתור סגירה, `onClick={onClose}` על כל קישור). היא הוחלפה
 * ב-`BottomNav` + `MoreSheet`, ולכן כל המנגנון הזה נמחק — הקומפוננטה
 * הזו כבר לא מקבלת מצב פתיחה בכלל.
 */
function Sidebar({
  groups,
  pathname,
  user,
}: {
  groups: ReturnType<typeof visibleFor>;
  pathname: string;
  user: User;
}) {
  // המסכים שנבנו והמסכים שעדיין לא — מופרדים, כדי שהזמינים ינצחו
  const ready = groups.flatMap((g) => g.items.filter((i) => !i.planned));
  const planned = groups.flatMap((g) => g.items.filter((i) => i.planned));

  return (
    <aside className="hidden w-[244px] shrink-0 flex-col border-s border-line bg-surface lg:flex">
        <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-5">
          <Wordmark />
        </div>

        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {ready.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.hint}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors active:bg-surface-2 ${
                      active
                        ? "bg-brand-soft font-semibold text-brand"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink-1"
                    }`}
                  >
                    {/* סמן הפריט הפעיל — בקצה המוביל */}
                    {active && (
                      <span className="absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-brand" />
                    )}
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {planned.length > 0 && (
            <div className="mt-6">
              <h2 className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-ink-4">
                בפיתוח
              </h2>
              <ul>
                {planned.map((item) => (
                  <li key={item.href}>
                    <span
                      className="flex cursor-not-allowed items-center gap-2.5 px-3 py-1.5 text-[13px] text-ink-4"
                      title="המסך הזה עדיין לא נבנה"
                    >
                      <Icon name={item.icon} size={15} />
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
              {user.name.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-ink-3">
                {ROLE_CONFIG[user.role].label}
              </p>
            </div>

            <form action={endSession} className="ms-auto">
              <button
                type="submit"
                title="יציאה"
                aria-label="יציאה"
                className="relative rounded-md p-1.5 text-ink-3 transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95"
              >
                <Icon name="logout" size={17} />
              </button>
            </form>
          </div>
        </div>
    </aside>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-baseline gap-1.5">
      <span className="brand-word font-display text-[19px] font-bold leading-none tracking-tight">
        ONE STOP
      </span>
      <span className="text-[10px] font-medium tracking-wide text-ink-4">
        CRM
      </span>
    </Link>
  );
}

/* ── סרגל עליון ───────────────────────────────────────────────────────── */

/**
 * הכותרת שמופיעה בסרגל העליון בטלפון.
 *
 * מפה מפורשת ולא גזירה מ-`nav.ts`, כי הכותרות כאן תיאוריות יותר
 * מתוויות התפריט ("תור העבודה" מול "לידים") — בסרגל צד רוצים מילה
 * אחת, בכותרת מסך רוצים משפט.
 */
const PAGE_TITLES: Record<string, string> = {
  "/": "בית",
  "/leads": "תור העבודה",
  "/packages": "קטלוג החבילות",
  "/deals": "מעקב עסקאות",
  "/my-deals": "העסקאות שלי",
  "/deals-dashboard": "דשבורד עסקאות",
  "/registrations": "טפסי רישום",
  "/admin": "ניהול מערכת",
  "/feedback": "משוב",
};

/**
 * ⚠️ נופל חזרה לתווית מ-`nav.ts` לפי הקידומת הארוכה ביותר.
 *
 * בלי זה כל תת-נתיב (`/leads/123` וכל מסך עתידי) מחזיר מחרוזת ריקה,
 * וסרגל הניווט בטלפון — הכותרת היחידה שיש שם — פשוט ריק.
 */
function pageTitle(pathname: string): string {
  const exact = PAGE_TITLES[pathname];
  if (exact) return exact;

  return NAV.flatMap((g) => g.items)
    .filter((i) => i.href !== "/" && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "";
}

function TopBar({ user }: { user: User }) {
  const pathname = usePathname();
  const title = pageTitle(pathname);

  return (
    // הריפוד האופקי משתמש ב-`max()` ולא בערך קבוע: עם `viewportFit:
    // cover` (layout.tsx) המסך מגיע עד הפינות המעוגלות, ובמצב נוף
    // ה-inset הצדדי אינו אפס. `max` שומר על 1rem כשאין inset.
    // 52px בטלפון ו-60 בשולחן: ההמבורגר ירד (הניווט עבר לסרגל התחתון),
    // ולכן הסרגל הזה מחזיק רק כותרת ותמה ואין סיבה לגובה מלא.
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-surface ps-[max(1rem,env(safe-area-inset-right))] pe-[max(1rem,env(safe-area-inset-left))] sm:ps-6 sm:pe-6 lg:h-[60px]">
      <span className="font-display text-[15px] font-medium text-ink-2 lg:hidden">
        {title}
      </span>

      <SubscriptionNotice endsAt={user.subscriptionEndsAt} />

      <div className="ms-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}

/** מתריע כשהמנוי מתקרב לסיום. מוסתר כשנותרו יותר מ-30 יום. */
function SubscriptionNotice({ endsAt }: { endsAt?: string }) {
  // null עד שהלקוח נרשם — "היום" לא קיים בשרת
  const now = useNow();

  if (!endsAt || now === null) return null;

  const daysLeft = Math.ceil((Date.parse(endsAt) - now) / 86_400_000);
  if (daysLeft > 30) return null;

  return (
    <p className="hidden items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn sm:flex">
      <Icon name="clock" size={14} />
      המנוי מסתיים בעוד {daysLeft} ימים
    </p>
  );
}

function ThemeToggle() {
  // ה-DOM הוא מקור האמת — הסקריפט ה-inline כבר קבע את התמה
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    readTheme,
    readServerTheme,
  );

  function toggle() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      className="relative rounded-lg p-2 text-ink-2 transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95"
      aria-label={theme === "dark" ? "מעבר לתמה בהירה" : "מעבר לתמה כהה"}
      title={theme === "dark" ? "תמה בהירה" : "תמה כהה"}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
