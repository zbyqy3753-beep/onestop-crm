import { db } from "@/server/repositories";
import type { LeadFilter } from "@/server/repositories";
import { requireStaffUser } from "@/server/auth/session";
import { canSeeAllLeads } from "@/lib/domain/permissions";
import { OPEN_STATUSES, ROLE_CONFIG } from "@/lib/domain/types";
import { performanceByAgent } from "@/server/services/economics";
import { TZ, startOfDay, startOfMonth } from "@/lib/tz";
import { SummaryTiles } from "@/components/dashboard/SummaryTiles";
import { RecentLeadsList } from "@/components/dashboard/RecentLeadsList";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatusBreakdownStrip, type StatusSegment } from "@/components/ui/StatusBreakdownStrip";

// `timeZone` מפורש: זה רכיב שרת, והתהליך ב-Vercel רץ ב-UTC. בלעדיו
// בין 00:00 ל-03:00 שעון ישראל הכותרת הציגה את היום הקודם.
const WEEKDAY_FMT = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  weekday: "long",
});
const LONG_DATE_FMT = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * דשבורד הבית. רכיב שרת — שולף הכל דרך `db` ומעביר נתונים מוכנים
 * לילדים פרזנטציוניים. גבול הלקוח היחיד הוא `RecentLeadsList`, שצריך
 * זמן יחסי חי ("לפני 3 שע׳") — ראה שם.
 *
 * "עסקאות החודש/היום" ו"עמלות החודש" ב-`SummaryTiles` מרונדרות כ-0
 * קשיח בכוונה: גם המערכת האמיתית עוד לא חיברה את זה. לוח המובילים
 * למטה כן מציג מספרים אמיתיים (מ-`performanceByAgent`) — שני הדברים
 * לא סותרים, זה פשוט שני מקורות נתונים שונים שהמערכת המקורית נמצאת
 * באמצע חיווט שלהם.
 */
export default async function DashboardPage() {
  /*
   * מחוץ ל-`Promise.all` ולפניו, ולא כאחד מאיבריו: `redirect` זורק,
   * אבל שמונה השאילתות שלצידו כבר יצאו לדרך. ספק חיצוני היה מריץ את
   * כל שליפת הדשבורד הארגוני לפני שההפניה תופסת.
   */
  const currentUser = await requireStaffUser();

  /*
   * ⚠️ אותו חתך בדיוק כמו ב-`/leads`: עובד רואה רק לידים שמשויכים
   * אליו. שלוש שאילתות הלידים כאן רצו בלי שום מסנן, כלומר כל עובד
   * שפתח את מסך הבית קיבל את המספרים של כל הארגון ואת שמונת הלידים
   * החדשים שלו — בדיוק מה ש-`/leads` נבנה כדי למנוע.
   *
   * ‏`RecentLeadsList` הוא רכיב **לקוח**, ולכן כל ליד שמגיע אליו יושב
   * ב-payload של הדף וקריא בכלי הפיתוח — גם אם המסך מציג ממנו שם
   * ותאריך בלבד.
   *
   * גם `countByStatus` מקבל את החתך, ולא רק הרשימה: קוביות ארגוניות
   * מעל רשימה אישית הן שני מספרים סותרים במסך אחד, והן מדליפות את
   * נפח הלידים הכולל של הארגון גם בלי להראות ליד בודד.
   */
  const scope: LeadFilter = canSeeAllLeads(currentUser.role)
    ? {}
    : { assigneeId: [currentUser.id] };

  /*
   * ‏`users` ו-`deals` נשארים ארגוניים במכוון: מבין ילדי הדשבורד רק
   * `RecentLeadsList` נושא `"use client"`. `SummaryTiles` ו-`Leaderboard`
   * הם רכיבי שרת, וה-props שלהם לא עוזבים את השרת — מה שמגיע לדפדפן
   * הוא ה-HTML המרונדר, כלומר שם, תפקיד ומספר עסקאות.
   *
   * ⚠️ הסבת `Leaderboard` ל-`"use client"` תתחיל להדליף אובייקטי
   * `User` מלאים (מייל, טלפון, חנות) ותחייב היטל `UserRef` כאן —
   * ראה `lib/domain/types.ts`.
   */
  const [users, allLeads, recentLeads, counts, deals, packages, costs] =
    await Promise.all([
      db.users.list(),
      db.leads.list(scope),
      db.leads.list(scope, { field: "createdAt", direction: "desc" }, { offset: 0, limit: 8 }),
      db.leads.countByStatus(scope),
      db.deals.list(),
      db.packages.list(),
      db.settings.getLeadCosts(),
    ]);

  const now = new Date();
  const todayLabel = `${WEEKDAY_FMT.format(now)}, ${LONG_DATE_FMT.format(now)}`;

  /* ── סיכום ──────────────────────────────────────────────────────── */

  const activeUsers = users.filter((u) => u.active);
  const agentsActive = activeUsers.filter((u) => u.role === "agent").length;
  const employeesActive = activeUsers.filter((u) => u.role === "employee").length;
  const employeesTotal = users.filter((u) => u.role === "employee").length;
  const storesCount = new Set(
    activeUsers.filter((u) => u.store).map((u) => u.store),
  ).size;

  const totalLeads = allLeads.total;
  const pendingLeads = OPEN_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  /* ── חלוקת לידים ────────────────────────────────────────────────── */

  const hotCount = allLeads.rows.filter((l) => l.kind === "hot").length;
  const dataCount = allLeads.rows.filter((l) => l.kind === "data").length;

  const breakdownSegments: StatusSegment[] = [
    { key: "new", label: "חדשים", count: counts.new ?? 0, tone: "info" },
    { key: "inProgress", label: "בטיפול", count: counts.inProgress ?? 0, tone: "active" },
    { key: "won", label: "נסגרו", count: counts.won ?? 0, tone: "good" },
    { key: "hot", label: "חמים", count: hotCount, tone: "bad" },
    { key: "data", label: "מדאטה", count: dataCount, tone: "info" },
  ];

  /* ── לוח מובילים ────────────────────────────────────────────────── */

  const catalog = new Map(packages.map((p) => [p.id, p]));
  // גבולות היום והחודש בשעון ישראל. `new Date(y, m, d)` היה משתמש
  // באזור הזמן של התהליך — UTC בייצור — ולכן "היום" בלוח המובילים היה
  // מתחיל שעתיים-שלוש מאוחר מדי.
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const dealsToday = deals.filter((d) => Date.parse(d.closedAt) >= dayStart);
  const dealsMonth = deals.filter((d) => Date.parse(d.closedAt) >= monthStart);

  const perfToday = performanceByAgent(dealsToday, catalog, costs);
  const perfMonth = performanceByAgent(dealsMonth, catalog, costs);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
          {currentUser.name}
          <span className="mr-2 align-middle text-base font-normal text-ink-3">
            {ROLE_CONFIG[currentUser.role].label}
          </span>
        </h1>
        <p className="mt-2 text-sm text-ink-3">{todayLabel}</p>
      </header>

      <div className="mb-5">
        <SummaryTiles
          agentsActive={agentsActive}
          employeesActive={employeesActive}
          employeesTotal={employeesTotal}
          storesCount={storesCount}
          pendingLeads={pendingLeads}
          totalLeads={totalLeads}
        />
      </div>

      <div className="mb-5">
        <StatusBreakdownStrip
          segments={[
            { key: "all", label: "הכל", count: totalLeads, tone: "neutral" as const },
            ...breakdownSegments,
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-1 font-display text-lg font-bold">אחרונים</h2>
            <p className="mb-2 text-xs text-ink-4">הלידים האחרונים שנכנסו למערכת</p>
            <RecentLeadsList leads={recentLeads.rows} />
          </section>

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-3 font-display text-lg font-bold">לוח מובילים</h2>
            <Leaderboard users={activeUsers} perfToday={perfToday} perfMonth={perfMonth} />
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-3 font-display text-lg font-bold">פעולות מהירות</h2>
            <QuickActions />
          </section>
        </div>
      </div>
    </div>
  );
}
