import { notFound } from "next/navigation";
import { MissedLeadsClient } from "@/components/leads/missed/MissedLeadsClient";
import {
  CLOSED_MISSED_STATUSES,
  emptyClosedTotals,
  mayBeStuck,
  safeTime,
  type MissedLeadRow,
} from "@/components/leads/missed/groups";
import { db } from "@/server/repositories";
import type { LeadFilter } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import { teamScopeIds } from "@/server/auth/team";
import { isSupplier } from "@/lib/domain/permissions";
import type { Lead, LeadStatusEvent } from "@/lib/domain/types";
import { LEAD_CATEGORY_CONFIG, isLeadCategory } from "@/lib/domain/types";

/**
 * כמה סגירות נשלפות לכל סטטוס.
 *
 * ⚠️ "נסגרו בלי עסקה" רק גדל עם הזמן — כל ייבוא דאטה מוסיף מאות "לא
 * רלוונטי" — ומסך שהיה שולף את כולן היה כבד מ-`/leads` עצמו, שחתוך
 * לחודש כברירת מחדל. החיתוך נעשה **במסד** (`page.limit`) ולא אחרי
 * שליפה מלאה, והספירה המלאה מגיעה מ-`total` של אותה שאילתה — המסך אומר
 * במפורש כשהרשימה חתוכה.
 */
const CLOSED_ROWS_PER_STATUS = 250;

/** אורך מרבי לפירוט של הנציג — הכרטיס מציג שתי שורות ממילא. */
const DETAIL_MAX = 280;

/**
 * "לידים שפוספסו" — רכיב שרת. קריאה בלבד: שולף, מצמצם, ומעביר שורות
 * רזות. אין כאן שום כתיבה; "החזר לתור" עובר דרך `changeStatusAction`
 * הקיים, שאוכף את ההרשאה על הליד בעצמו.
 *
 * ⚠️ **ההרשאה נאכפת כאן, בשליפה** — בדיוק כמו ב-`leads/page.tsx`: עובד
 * מקבל רק את הלידים שמשויכים אליו, בעל עסק גם את אלה של הצוות שלו
 * (`teamScopeIds`). סינון בלקוח היה משאיר לידים של אחרים ב-payload.
 */
export default async function MissedLeadsPage() {
  const user = await requireSessionUser();

  /*
   * ⚠️ לפני כל שליפה. ספק לידים חיצוני רואה רק את `/leads` (ראה
   * `SUPPLIER_HREFS` ב-permissions.ts), והתפריט שמסתיר ממנו את המסך הזה
   * אינו הרשאה — מי שמקליד את הכתובת מגיע לכאן.
   */
  if (isSupplier(user.role)) notFound();

  const scopeIds = await teamScopeIds(user);
  const scope: LeadFilter = scopeIds === null ? {} : { assigneeId: scopeIds };

  /*
   * שם המטפל רק למי שרואה יותר מהלידים של עצמו. לעובד כל ליד כאן הוא
   * שלו, ושמו על כל כרטיס היה רעש — ולכן גם רשימת המשתמשים לא נשלפת.
   *
   * ⚠️ `users.list()` ולא `listActive()`: ליד שתקוע אצל עובד שהושבת הוא
   * בדיוק מה שהמסך הזה צריך להראות, ובלי השם שלו הוא היה נראה "ללא
   * שיוך". מהמשתמש נלקחים שם וסטטוס פעיל בלבד.
   */
  const showsPeople = scopeIds === null || scopeIds.length > 1;

  /*
   * שאילתה לכל סטטוס סגירה, חתוכה במסד, ועוד שאילתה אחת לפתוחים.
   *
   * ⚠️ המיון `updatedAt desc` הוא מיון ברירת המחדל של ה-repository,
   * ולכן הוא מקדים לידים חמים לדאטה (ראה `buildOrderBy`) — כשסטטוס חתוך,
   * הלידים החמים הם שנכנסים ל-250 ולא מאות שורות דאטה מייבוא אחד.
   *
   * ⚠️ הפתוחים נשלפים כולם: `LeadFilter` לא יודע לסנן לפי `updatedAt`
   * או `followUpAt`, ו"תקוע" נגזר גם מאירוע הסטטוס האחרון בהיסטוריה.
   * הצמצום נעשה כאן (`mayBeStuck`), לפני שמשהו עוזב את השרת.
   */
  const [closedPages, { rows: openLeads }, users] = await Promise.all([
    Promise.all(
      CLOSED_MISSED_STATUSES.map((status) =>
        db.leads.list(
          { ...scope, status: [status] },
          { field: "updatedAt", direction: "desc" },
          { offset: 0, limit: CLOSED_ROWS_PER_STATUS },
        ),
      ),
    ),
    db.leads.list({ ...scope, openOnly: true }),
    showsPeople ? db.users.list() : Promise.resolve([]),
  ]);

  const people = showsPeople
    ? new Map(users.map((u) => [u.id, { name: u.name, active: u.active }]))
    : null;

  const closedTotals = emptyClosedTotals();
  const closedRows: MissedLeadRow[] = [];
  CLOSED_MISSED_STATUSES.forEach((status, i) => {
    const page = closedPages[i];
    closedTotals[status] = page.total;
    for (const lead of page.rows) closedRows.push(toRow(lead, people));
  });

  const now = serverClock();
  const stuckCandidates: MissedLeadRow[] = [];
  for (const lead of openLeads) {
    const row = toRow(lead, people);
    // ראה `mayBeStuck`: על-קבוצה גסה, וההחלטה המדויקת בלקוח
    if (mayBeStuck(row, now)) stuckCandidates.push(row);
  }

  return (
    <MissedLeadsClient
      rows={[...newestFirst(closedRows), ...newestFirst(stuckCandidates)]}
      closedTotals={closedTotals}
    />
  );
}

/**
 * ליד מלא → שורה רזה, שדה-שדה.
 *
 * ⚠️ בלי פיזור (`...lead`): שדה שיתווסף ל-`Lead` בעתיד לא ייסע לדפדפן
 * בשקט. הערות, היסטוריה, פעילות, עלות ומזהי עובדים נשארים כאן.
 */
function toRow(
  lead: Lead,
  people: Map<string, { name: string; active: boolean }> | null,
): MissedLeadRow {
  /*
   * ⚠️ האירוע האחרון נחשב רק אם **הוא** שהכניס את הליד לסטטוס הנוכחי.
   * ליד שהסטטוס שלו נקבע בלי אירוע (ייבוא, הסבה מהמערכת הישנה) היה
   * מקבל אחרת את הפירוט של שיחה ישנה כאילו זו סיבת הסגירה.
   */
  const latest = latestStatusEvent(lead.history ?? []);
  const current = latest?.to === lead.status ? latest : undefined;

  const row: MissedLeadRow = {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    kind: lead.kind,
    createdAt: lead.createdAt,
    lastChangeAt:
      firstValidDate(current?.createdAt, lead.updatedAt, lead.createdAt) ??
      lead.createdAt,
  };

  // קטגוריה פגומה במסד לא מפילה את הדף — היא פשוט לא מוצגת
  if (lead.category && isLeadCategory(lead.category)) {
    row.category = LEAD_CATEGORY_CONFIG[lead.category].label;
  }

  const detail = current?.detail?.trim();
  if (detail) {
    row.lastDetail =
      detail.length > DETAIL_MAX
        ? `${detail.slice(0, DETAIL_MAX - 1).trimEnd()}…`
        : detail;
  }

  if (firstValidDate(lead.followUpAt)) row.followUpAt = lead.followUpAt;

  if (people) {
    const person = lead.assigneeId ? people.get(lead.assigneeId) : undefined;
    row.assigneeName = person?.name ?? null;
    if (person && !person.active) row.assigneeInactive = true;
  }

  return row;
}

/**
 * אירוע הסטטוס האחרון לפי הזמן — לא לפי המיקום במערך. Prisma ממיין
 * עולה, אבל מימוש הזיכרון רק מוסיף בסוף, ושום חוזה לא מבטיח את זה.
 */
function latestStatusEvent(
  history: LeadStatusEvent[],
): LeadStatusEvent | undefined {
  let latest: LeadStatusEvent | undefined;
  let latestAt = Number.NEGATIVE_INFINITY;
  for (const event of history) {
    const at = safeTime(event.createdAt);
    // `<` ולא `<=`: בשוויון מנצח המאוחר במערך
    if (at === null || at < latestAt) continue;
    latest = event;
    latestAt = at;
  }
  return latest;
}

/** התאריך התקין הראשון. תאריך פגום מגיע כ-NaN, וכל השוואה איתו שקרית. */
function firstValidDate(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => safeTime(v) !== null);
}

function newestFirst(rows: MissedLeadRow[]): MissedLeadRow[] {
  return rows
    .map((row) => ({ row, at: safeTime(row.lastChangeAt) ?? 0 }))
    .sort((a, b) => b.at - a.at)
    .map(({ row }) => row);
}

/**
 * "עכשיו" של השרת — **רק** לסינון הגס של המועמדים ל"תקועים".
 *
 * שום דבר שמוצג לא מחושב ממנו: מה שתלוי בשעון מוצג רק אחרי ההרכבה,
 * מ-`useNow`, כדי שהשרת והלקוח לא יציירו שני מסכים שונים.
 */
function serverClock(): number {
  return Date.now();
}
