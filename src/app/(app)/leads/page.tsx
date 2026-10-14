import { LeadsClient } from "@/components/leads/LeadsClient";
import {
  SupplierLeadsList,
  type SupplierLeadRow,
} from "@/components/leads/SupplierLeadsList";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import {
  canLeadTeam,
  canManageSettings,
  canSeeAllLeads,
  canUseCrm,
  isSupplier,
} from "@/lib/domain/permissions";
import { teamScopeIds } from "@/server/auth/team";
import type { Lead, LeadStatus, UserRef } from "@/lib/domain/types";
import { STATUS_ORDER } from "@/lib/domain/types";
import type { LeadFilter } from "@/server/repositories";
import {
  FROM_PARAM,
  PERIOD_LABEL,
  PERIOD_PARAM,
  TO_PARAM,
  periodFromParams,
  toDateInput,
  type Period,
} from "@/lib/domain/period";
import { dayKey } from "@/lib/tz";
import type { MonthTab, PeriodNav } from "@/components/leads/PeriodPicker";

/**
 * מה הצוות כתב על הליד, בערוץ אחד ולפי סדר הזמן.
 *
 * ⚠️ **שני מקורות ולא אחד.** `lead.notes` הן הערות חופשיות מהמגירה,
 * אבל רוב מה שעובד כותב בפועל נכנס לתיבת הפירוט של שינוי הסטטוס
 * (`LeadStatusEvent.detail`) — ובלעדיה מסך הספק נראה ריק גם כשהצוות
 * מתעד כל שיחה.
 *
 * ⚠️ אירוע סטטוס **בלי** `detail` נשמט: "עבר ל׳אין מענה׳" בלי מילה
 * הוא סטטוס ולא הערה, והוא כבר מוצג בתגית של השורה עצמה.
 *
 * ⚠️ ההערות עוברות שדה-שדה ולא כ-`lead.notes`. `LeadNote` נושא `id`,
 * `leadId` ו-`authorId`, ושלושתם מזהים פנימיים שאין לספק מה לעשות
 * איתם — ופיזור (`...note`) היה מצרף גם כל שדה שיתווסף לטיפוס
 * בעתיד, בלי שאיש ישים לב. אותו שיקול ב-`actorId` של אירוע סטטוס.
 *
 * המיון מפורש: ה-`include` של `list` מביא את ההערות בלי `orderBy`,
 * כלומר Postgres מחזיר אותן בסדר בלתי מוגדר — ובלי מיון משותף שני
 * המקורות היו מופיעים כשני בלוקים נפרדים במקום כשיחה אחת.
 */
function teamNotes(lead: Lead): SupplierLeadRow["notes"] {
  return [
    ...lead.notes.map((note) => ({
      body: note.body,
      createdAt: note.createdAt,
    })),
    ...lead.history.flatMap((event) => {
      const body = event.detail?.trim();
      return body ? [{ body, createdAt: event.createdAt, status: event.to }] : [];
    }),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* ── תיקיית החודשים ──────────────────────────────────────────────────── */

/**
 * שמות החודשים. רשימה קבועה ולא `Intl` — אותה מחרוזת בכל סביבה, בלי
 * תלות בנתוני ה-ICU של השרת.
 */
const MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/**
 * כמה חודשים מוצגים כלשוניות, כולל הנוכחי.
 *
 * שישה ולא יותר: כל לשונית היא שאילתת ספירה, והמסך מתרענן כל דקה.
 * חודש ישן יותר — דרך שדות התאריך או "תקופה אחרת".
 */
const MONTH_TABS = 6;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** היום האחרון בחודש (`month` מ-1): יום 0 של החודש הבא הוא האחרון של זה. */
function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

interface MonthSpan {
  year: number;
  month: number;
  /** `YYYY-MM-DD` — הערכים שהלשונית כותבת לכתובת */
  from: string;
  to: string;
  /** אותם גבולות כרגעים — בדיוק מה ש-`periodFromParams` יחזיר בלחיצה */
  isoFrom: string;
  isoTo: string;
}

/**
 * החודש הנוכחי ו-`n - 1` שלפניו, בשעון ישראל, מהחדש לישן.
 *
 * ⚠️ הגבולות נגזרים מ-`periodFromParams` עצמו, עם אותם פרמטרים שהלשונית
 * כותבת לכתובת — ולא מחישוב מקביל כאן. כך המספר על הלשונית נספר בדיוק
 * על הטווח שהלחיצה עליה תשלוף, ו"הלשונית הנבחרת" היא השוואת מחרוזות.
 * (`thisMonth` ו-`lastMonth` נותנים בדיוק את אותם רגעים — ראה
 * `monthBounds` ב-period.ts — ולכן גם הם מסמנים את הלשונית הנכונה.)
 *
 * ⚠️ `dayKey` ולא `new Date().getMonth()`: השרת רץ ב-UTC, ובחצות של ה-1
 * לחודש בישראל הוא עדיין בחודש הקודם.
 */
function recentMonths(now: number, n: number): MonthSpan[] {
  const [year, month] = dayKey(now).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const index = year * 12 + (month - 1) - i;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    const from = `${y}-${pad2(m)}-01`;
    const to = `${y}-${pad2(m)}-${pad2(lastDayOf(y, m))}`;
    const bounds = periodFromParams(
      { [PERIOD_PARAM]: "custom", [FROM_PARAM]: from, [TO_PARAM]: to },
      now,
    );
    return {
      year: y,
      month: m,
      from,
      to,
      isoFrom: bounds.from ?? "",
      isoTo: bounds.to ?? "",
    };
  });
}

/** אם הטווח הוא חודש קלנדרי שלם (החודש, החודש שעבר, לשונית) — איזה. */
function wholeMonth(p: Period): { year: number; month: number } | null {
  if (!p.from || !p.to) return null;
  const [fy, fm, fd] = toDateInput(p.from).split("-").map(Number);
  const [ty, tm, td] = toDateInput(p.to, true).split("-").map(Number);
  if (fd !== 1 || fy !== ty || fm !== tm || td !== lastDayOf(fy, fm)) return null;
  return { year: fy, month: fm };
}

/** `YYYY-MM-DD` → `13.10.2026` */
function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d}.${m}.${y}`;
}

/** "אוקטובר", ובשנה אחרת "דצמבר 2025" */
function monthLabel(year: number, month: number, currentYear: number): string {
  const name = MONTH_NAMES[month - 1];
  return year === currentYear ? name : `${name} ${year}`;
}

/**
 * הטווח ולשוניות החודשים, מ"עכשיו" **אחד** לכל הבקשה.
 *
 * הטווח, הלשוניות והשאלה אם הטווח מגיע עד היום נשענים כולם על השעון.
 * קריאות נפרדות היו יכולות להתפצל על חצות של ה-1 בחודש — טווח של חודש
 * אחד ולשוניות של אחר, ואף לשונית לא מסומנת.
 *
 * פונקציה ולא שורה בגוף הרכיב: `react-hooks/purity` אוסר `Date.now()`
 * ישירות ברינדור, גם ברכיב שרת.
 */
function periodContext(params: Record<string, string | string[] | undefined>) {
  const now = Date.now();
  return {
    now,
    period: periodFromParams(params, now),
    months: recentMonths(now, MONTH_TABS),
  };
}

/** השם שעל "תקופה אחרת" כשהטווח אינו אחת הלשוניות. */
function otherPeriodLabel(p: Period, currentYear: number): string {
  const month = wholeMonth(p);
  if (month) return monthLabel(month.year, month.month, currentYear);
  if (p.key !== "custom") return PERIOD_LABEL[p.key];
  const from = p.from ? shortDate(toDateInput(p.from)) : null;
  const to = p.to ? shortDate(toDateInput(p.to, true)) : null;
  if (from && to) return `${from}–${to}`;
  return from ? `מ-${from}` : `עד ${to}`;
}

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * ⚠️ **הגבלת הצפייה נעשית כאן, בשליפה עצמה — לא בסינון בצד הלקוח.**
 * עובד שאינו מנהל מקבל מהשרת רק את הלידים שמשויכים אליו, כך שלידים
 * של אחרים לא מגיעים לדפדפן שלו בכלל. סינון בלקוח היה משאיר אותם
 * ב-payload של הדף וניתנים לקריאה לכל מי שפותח כלי פיתוח.
 *
 * אותו מסנן מוזרק גם ל-`countByStatus`, אחרת הקוביות היו מונות את
 * כל הארגון בזמן שהטבלה מציגה חתך אישי — שני מספרים סותרים במסך אחד.
 */

export default async function LeadsPage({
  searchParams,
}: {
  // ⚠️ Promise — ב-Next 16 `searchParams` א-סינכרוני. ראה
  // node_modules/next/dist/docs (מדריך הגרסה) לפני שינוי החתימה.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requireSessionUser();

  /*
   * ── ספק לידים חיצוני ──────────────────────────────────────────────
   *
   * מסלול נפרד לגמרי, ולא `LeadsClient` עם props מוגבלים. `LeadsClient`
   * הוא רכיב לקוח שמקבל את הלידים המלאים ואיתם משתמשים, עלויות רכישה,
   * עסקאות וחבילות — כלומר גם אם היינו מסתירים כל פקד, כל אלה היו
   * יושבים ב-payload של הדף וקריאים לכל מי שפותח DevTools. prop אחד
   * שנשכח בעוד שנה מחזיר את הדליפה בשקט.
   *
   * כאן במקום זה נשלפים רק הלידים שלו, וממופים **בשרת** לשם, טלפון,
   * סטטוס, הערות ותאריך — ותו לא — לפני שמשהו עוזב אותו.
   */
  if (isSupplier(currentUser.role)) {
    /*
     * בלי `leadSourceName` אין שום דרך לדעת אילו לידים שלו — ורשימה
     * ריקה היא התשובה הנכונה. ההיפך (סינון ריק = "החזר הכול") היה
     * מציג לספק את כל מאגר הלידים של הארגון.
     */
    const sourceName = currentUser.leadSourceName?.trim();

    /*
     * ── סינון לפי סטטוס ───────────────────────────────────────────────
     *
     * ⚠️ **דרך ה-URL ולא במצב React, בכוונה.** `SupplierLeadsList` הוא
     * רכיב שרת (ראה ההערה בראשו), וזו הסיבה היחידה שאין בדפדפן שלו
     * payload של לידים מלאים. סרגל סינון עם `useState` היה הופך אותו
     * לרכיב לקוח ומחזיר בדיוק את הדליפה שהמסלול הזה קיים כדי למנוע.
     *
     * ⚠️ הערך מאומת מול `STATUS_ORDER` ולא מועבר כמו שהוא — הוא נכנס
     * ל-`LeadFilter.status`, וקלט מה-URL אינו נאמן.
     */
    const askedStatus = (await searchParams).status;
    const asked = Array.isArray(askedStatus) ? askedStatus[0] : askedStatus;
    const status = STATUS_ORDER.find((s) => s === asked) ?? null;

    /*
     * מיון מפורש לפי `createdAt` ולא ברירת המחדל (`updatedAt`): המסך
     * מציג את תאריך **הקליטה**, ומיון לפי עדכון אחרון היה מקפיץ לראש
     * ליד בן חודש רק משום שעובד נגע בו הבוקר — רשימה שנראית מעורבבת
     * למי שרואה רק את התאריך השני.
     */
    /*
     * ⚠️ `sourceDetail` נשאר בשתי השאילתות **תמיד**. הוא לא נוחות אלא
     * מסנן ההרשאה היחיד כאן (ראה server/repositories/types.ts), וכל
     * תנאי שמתווסף עליו מוסיף — לא מחליף.
     *
     * ⚠️ הספירות **בלי** `status`: עם הסטטוס בתוכן כל שאר הקוביות היו
     * מתאפסות ברגע שמסננים, כלומר הסרגל היה מוחק את הדרך חזרה.
     */
    const [rows, statusCounts] = sourceName
      ? await Promise.all([
          db.leads
            .list(
              {
                sourceDetail: sourceName,
                ...(status ? { status: [status] } : {}),
              },
              { field: "createdAt", direction: "desc" },
            )
            .then((r) => r.rows),
          db.leads.countByStatus({ sourceDetail: sourceName }),
        ])
      : [[], {} as Record<LeadStatus, number>];

    return (
      <SupplierLeadsList
        supplierName={currentUser.name}
        counts={statusCounts}
        active={status}
        rows={rows.map((lead, i) => ({
          // מזהה הליד עצמו לא נשלח: הוא המפתח לכל Server Action על
          // הליד, ולספק אין שום פעולה לבצע. הרשימה מרונדרת בשרת ולא
          // ממוינת מחדש בלקוח, ולכן אינדקס הוא מפתח תקף — ובניגוד
          // לשם+תאריך, הוא ייחודי גם לשני לידים זהים באותו יום.
          key: String(i),
          name: lead.name,
          phone: lead.phone,
          status: lead.status,
          createdAt: lead.createdAt,
          notes: teamNotes(lead),
        }))}
      />
    );
  }

  /*
   * עובד רואה **אך ורק** לידים שמשויכים אליו — גם לא לידים ללא שיוך.
   *
   * המשמעות התפעולית: חלוקת הלידים היא באחריות ההנהלה בלבד. ליד
   * שנכנס מה-API ולא שויך אוטומטית יושב במאגר וגלוי רק למנהלים, עד
   * שמישהו מהם משייך אותו. עובד לא לוקח לעצמו לידים.
   */
  /*
   * בעל עסק (`canLeadTeam`) רואה גם את הלידים של העובדים המשויכים
   * אליו — ראה `teamScopeIds`. עדיין לא לידים ללא שיוך.
   */
  const scopeIds = await teamScopeIds(currentUser);
  const scope: LeadFilter = scopeIds === null ? {} : { assigneeId: scopeIds };
  const isTeamLead = canLeadTeam(currentUser.role);

  /*
   * ── חתך התקופה ────────────────────────────────────────────────────
   *
   * ⚠️ מוחל על `scoped` שעובר גם ל-`list` וגם ל-`countByStatus`, ולכן
   * הריבועים והטבלה חתוכים זהה. ראה lib/domain/period.ts
   */
  const { now, period, months } = periodContext(await searchParams);
  const scoped: LeadFilter = {
    ...scope,
    ...(period.from ? { createdFrom: period.from } : {}),
    ...(period.to ? { createdTo: period.to } : {}),
  };

  const [
    [{ rows: leads }, allUsers, openInRange, openAllTime, leadCosts, allDeals, packages],
    [openHotInRange, openHotAllTime, allTimeHot],
    monthCounts,
  ] = await Promise.all([
    Promise.all([
      db.leads.list(scoped),
      db.users.listActive(),

      /*
       * ⚠️⚠️ שתי ספירות של לידים **פתוחים** — בתוך הטווח ומחוץ לזמן.
       * ההפרש ביניהן הוא כמה עבודה פתוחה החתך מסתיר, וזו האזהרה
       * היחידה שמונעת מברירת המחדל החודשית לבלוע לידים ב-1 בחודש.
       * ראה PeriodPicker › openOutsideRange.
       */
      db.leads.countByStatus({ ...scoped, openOnly: true }),
      db.leads.countByStatus({ ...scope, openOnly: true }),

      db.settings.getLeadCosts(),
      db.deals.list(),
      db.packages.list(),
    ]),

    /*
     * ⚠️ אותן שתי ספירות, **לחמים בלבד** — ועוד סך החמים מכל הזמן
     * (המספר על "הכל").
     *
     * הפיצול קיים כדי שהמספר על האזהרה יהיה בדיוק מה שהלחיצה עליה
     * מראה. התור מסתיר דאטה קרה עד שמבקשים אותה (`KindToggle`), כך
     * שייבוא ישן של 358 שורות דאטה היה מחזיק אזהרה קבועה של "358
     * פתוחים" מעל רשימה שמוסיפה 7 — אזהרה שלומדים להתעלם ממנה בדיוק
     * ביום שהיא אמיתית. `LeadsClient` בוחר את החלק לפי בורר הסוג.
     */
    Promise.all([
      db.leads.countByStatus({ ...scoped, kind: ["hot"], openOnly: true }),
      db.leads.countByStatus({ ...scope, kind: ["hot"], openOnly: true }),
      db.leads.countByStatus({ ...scope, kind: ["hot"] }),
    ]),

    /*
     * המספר על כל לשונית חודש: לידים **חמים** שנכנסו בחודש — אותו מונה
     * כמו "N לידים" בסיכום (`hotLeads` ב-`LeadsClient`), כדי שהלשונית
     * הנבחרת והסיכום יגידו את אותו מספר.
     *
     * ⚠️ קריאה בלבד, ו-`scope` תמיד בפנים — עובד רואה על הלשונית רק את
     * הלידים שלו, בדיוק כמו ברשימה. מונה של כל הארגון היה מדליף כמה
     * לידים נכנסו לאחרים, וגם סותר את הרשימה שמתחתיו.
     */
    Promise.all(
      months.map((m) =>
        db.leads.countByStatus({
          ...scope,
          kind: ["hot"],
          createdFrom: m.isoFrom,
          createdTo: m.isoTo,
        }),
      ),
    ),
  ]);

  const sum = (c: Record<string, number>) =>
    Object.values(c).reduce((a, b) => a + b, 0);
  const openOutsideRange = Math.max(0, sum(openAllTime) - sum(openInRange));
  const openOutsideHot = Math.min(
    openOutsideRange,
    Math.max(0, sum(openHotAllTime) - sum(openHotInRange)),
  );

  /*
   * כל מה ששורת החודשים צריכה — מחושב כאן, בשרת, ועובר כנתונים.
   * "החודש הנוכחי" בלקוח היה מסכים עם השרת בכל רגע חוץ מחצות של ה-1
   * בחודש, ואז הלשוניות היו זזות אחת הצידה בהידרציה.
   */
  const currentYear = months[0].year;
  const monthTabs: MonthTab[] = months.map((m, i) => ({
    from: m.from,
    to: m.to,
    label: monthLabel(m.year, m.month, currentYear),
    count: sum(monthCounts[i]),
    current: i === 0,
    active: period.from === m.isoFrom && period.to === m.isoTo,
  }));
  const onTab = period.key === "all" || monthTabs.some((t) => t.active);
  const periodNav: PeriodNav = {
    period,
    months: monthTabs,
    allCount: sum(allTimeHot),
    otherLabel: onTab ? null : otherPeriodLabel(period, currentYear),
    reachesNow: period.to === null || Date.parse(period.to) > now,
    openOutside: { hot: openOutsideHot, data: openOutsideRange - openOutsideHot },
  };

  /*
   * ⚠️ המסך שולח יותר מהלידים עצמם, וגם הנלווה חייב להיחתך.
   *
   * `users` — הרכיבים למטה קוראים מהמשתמש רק `id`, `name` ו-`role`
   * (מפת המשויכים, בורר השיוך, תווית התפקיד בפאנל הביצועים). המייל,
   * הטלפון והחנות של כל עובד בארגון נסעו לדפדפן בלי שאיש יקרא אותם.
   */
  /*
   * ⚠️ מי שאינו נכנס ל-CRM לא מוצע כמטפל. `siteManager` הוא אחראי תוכן
   * האתר — הוא יושב באותה טבלת משתמשים ולכן חוזר מ-`listActive`, אבל
   * ליד שישויך אליו נופל לתיבה שאיש לא פותח: הוא לא יכול להתחבר לכאן
   * בכלל.
   */
  /*
   * ⚠️ לבעל עסק — רק הוא והצוות שלו. זו גם רשימת היעדים בבורר השיוך,
   * ובעל עסק לא משייך ליד למי שמחוץ לצוות (נאכף גם ב-`assignAction`).
   */
  const teamIds = isTeamLead && scopeIds ? new Set(scopeIds) : null;
  const users = allUsers
    .filter((u) => canUseCrm(u.role))
    .filter((u) => !teamIds || teamIds.has(u.id))
    .map(({ id, name, role, teamOwnerId }): UserRef => ({
      id,
      name,
      role,
      ...(teamOwnerId ? { teamOwnerId } : {}),
    }));

  /*
   * `deals` — רק עסקאות של הלידים שנשלחים למסך.
   *
   * ⚠️ הלקוח כבר מצמצם לזה בעצמו (`dealsForLeads` ב-`LeadsClient`),
   * אבל צמצום בלקוח משאיר את **כל** עסקאות הארגון ב-payload — הכנסה,
   * עמלה ומזהה סוכן לכל עסקה — אצל כל עובד שפותח את מסך הלידים.
   * `canSeeAll` הסתיר את פאנל הפיננסים, לא את הנתונים שמאחוריו. זו
   * בדיוק הטעות שההערה בראש הקובץ מזהירה ממנה לגבי הלידים עצמם.
   *
   * מוחל תמיד ולא רק כשאין הרשאה: למנהל `leads` הוא ממילא כל הטבלה,
   * כך שזה כמעט no-op, ומסלול קוד אחד שווה יותר משניים.
   */
  const leadIds = new Set(leads.map((l) => l.id));
  const deals = allDeals.filter((d) => leadIds.has(d.leadId));

  /*
   * `leadCosts` נשאר במלואו, וזו החלטה ולא השמטה: אלה שישה מספרי
   * תצורה ברמת קטגוריה, לא נתונים של אף אדם, והתצוגה שלהם ממילא
   * מגודרת ב-`canSeeAll`. הסרתם הייתה שאלה של מוצר — מה מסך הלידים
   * מציג לעובד — ולא של אבטחה.
   */

  return (
    <LeadsClient
      leads={leads}
      users={users}
      leadCosts={leadCosts}
      deals={deals}
      packages={packages}
      currentUserId={currentUser.id}
      canSeeAll={canSeeAllLeads(currentUser.role)}
      canSeeTeam={isTeamLead}
      canEditCosts={canManageSettings(currentUser.role)}
      periodNav={periodNav}
    />
  );
}
