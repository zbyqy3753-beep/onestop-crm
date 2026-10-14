import type { LeadKind, LeadStatus } from "@/lib/domain/types";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { date, number } from "@/lib/format";
import { dayKey } from "@/lib/tz";

/**
 * "לידים שפוספסו" — מה נחשב פספוס, ולאיזו קבוצה הוא שייך.
 *
 * ⚠️ בלי `"use client"`, בכוונה. `leads/missed/page.tsx` (רכיב שרת) מייבא
 * מכאן קבועים ופונקציות, וייצוא שאינו קומפוננטה מקובץ `"use client"` מגיע
 * לרכיב שרת כ"הפניית לקוח" ולא כערך.
 *
 * כאן יושבים רק הכללים, בלי JSX: השרת מחליט לפיהם מה נשלח לדפדפן,
 * והלקוח מחליט לפיהם מה מוצג. שני מקומות שמגדירים "תקוע" כל אחד לעצמו
 * היו נפרדים תוך חודש.
 *
 * ⚠️ עזרי התאריך (`safeTime`, `safeDate`, `leadAge`) מקומיים כאן ולא
 * מיובאים מ-`leads/cells.tsx`: הקובץ ההוא נמצא בעבודה, והמסך הזה לא אמור
 * להישבר כשמשהו שם זז.
 */

export type MissedGroup = "competitor" | "noDeal" | "stuck";

/** "עברו למתחרה" */
export const COMPETITOR_STATUS = "soldByCompetitor" satisfies LeadStatus;

/** "נסגרו בלי עסקה" — כל סגירה שאינה הצלחה ואינה מתחרה. */
export const NO_DEAL_STATUSES = [
  "notInterested",
  "notRelevant",
  "existingCustomer",
  "denies",
  "lost",
] as const satisfies readonly LeadStatus[];

export type NoDealStatus = (typeof NO_DEAL_STATUSES)[number];
export type ClosedMissedStatus = typeof COMPETITOR_STATUS | NoDealStatus;

export const CLOSED_MISSED_STATUSES: readonly ClosedMissedStatus[] = [
  COMPETITOR_STATUS,
  ...NO_DEAL_STATUSES,
];

const NO_DEAL_SET: ReadonlySet<LeadStatus> = new Set<LeadStatus>(NO_DEAL_STATUSES);
const CLOSED_SET: ReadonlySet<LeadStatus> = new Set<LeadStatus>(
  CLOSED_MISSED_STATUSES,
);

export function isNoDeal(status: LeadStatus): status is NoDealStatus {
  return NO_DEAL_SET.has(status);
}

export function isClosedMissed(status: LeadStatus): status is ClosedMissedStatus {
  return CLOSED_SET.has(status);
}

/**
 * כמה לידים בכל סטטוס סגירה, **בלי** חיתוך.
 *
 * ⚠️ קיים בנפרד מהשורות כי השורות נחתכות בשרת (ראה `page.tsx`) — מונה
 * שנספר מהשורות שהגיעו היה מראה "250" במקום 1,400.
 */
export type ClosedTotals = Record<ClosedMissedStatus, number>;

export function emptyClosedTotals(): ClosedTotals {
  return Object.fromEntries(
    CLOSED_MISSED_STATUSES.map((s) => [s, 0]),
  ) as ClosedTotals;
}

/**
 * ליד כפי שהמסך הזה צריך אותו — ולא יותר.
 *
 * ⚠️ נבנה שדה-שדה בשרת ולא בפיזור של `Lead`: הליד המלא נושא הערות,
 * היסטוריה, פעילות, עלות ומזהי עובדים, ואף אחד מהם לא נדרש כאן. מה
 * שעובר לרכיב לקוח יושב ב-payload של הדף וקריא לכל מי שפותח DevTools.
 */
export interface MissedLeadRow {
  /** נדרש — זה המפתח של `changeStatusAction` */
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  kind: LeadKind;
  /** תווית הקטגוריה בעברית, כבר מפוענחת */
  category?: string;
  /**
   * מי מחזיק את הליד:
   *   `string`    — שם העובד
   *   `null`      — ללא שיוך
   *   `undefined` — לא מוצג, כי הצופה רואה ממילא רק את הלידים של עצמו
   */
  assigneeName?: string | null;
  /** העובד המשויך הושבת — הליד יושב אצל מי שכבר לא עונה לו */
  assigneeInactive?: true;
  createdAt: string;
  /**
   * מתי הסטטוס השתנה לאחרונה: אירוע הסטטוס האחרון, ובלעדיו `updatedAt`.
   * בליד סגור זה תאריך הסגירה.
   */
  lastChangeAt: string;
  /** מה הנציג כתב כשהעביר את הליד לסטטוס הנוכחי */
  lastDetail?: string;
  followUpAt?: string;
}

/* ── תאריכים בטוחים ────────────────────────────────────────────────────── */

/**
 * חותמת זמן, או `null` כשהתאריך פגום.
 *
 * ⚠️ `Date.parse` על ערך פגום מחזיר NaN, וכל השוואה איתו שקרית —
 * ו-`Intl.DateTimeFormat` **זורק** עליו. ליד אחד עם `followUpAt` פגום
 * הפיל פעם את כל מסך הלידים. כל תאריך במסך הזה עובר כאן קודם.
 */
export function safeTime(iso: string | undefined): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : at;
}

/** תאריך לתצוגה, או "—" כשהוא פגום — כרטיס אחד ולא המסך כולו. */
export function safeDate(iso: string | undefined): string {
  return safeTime(iso) === null ? "—" : date(iso!);
}

/* ── ימי לוח ───────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

/**
 * מספר היום הקלנדרי בשעון ישראל. הפרש בין שניים = הפרש בימי לוח —
 * אותה תשובה כמו `calendarDaysBetween` ב-`lib/tz.ts`.
 *
 * ⚠️ לא `calendarDaysBetween` עצמו: הוא מחשב היסט אזור זמן דרך
 * `toLocaleString` פעמיים לכל קריאה, ובמסך הזה הוא היה נקרא פעמיים לכל
 * ליד פתוח, בכל דקה. `dayKey` עובר דרך פורמט אחד שנבנה פעם אחת.
 */
export function israelDay(instant: number): number {
  const [y, m, d] = dayKey(instant).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/**
 * גיל הליד בעברית של אנשים — "היום", "אתמול", "לפני 3 ימים".
 *
 * `today` הוא `israelDay(now)` של הלקוח. ⚠️ רק אחרי ההרכבה (`useNow`):
 * שרת ולקוח לא תמיד מסכימים על "היום". תאריך פגום → מחרוזת ריקה.
 */
export function leadAge(createdAt: string, today: number): string {
  const at = safeTime(createdAt);
  if (at === null) return "";
  const days = Math.max(0, today - israelDay(at));
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  if (days === 2) return "לפני יומיים";
  if (days < 30) return `לפני ${number(days)} ימים`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "לפני חודש" : `לפני ${number(months)} חודשים`;
  return safeDate(createdAt);
}

/* ── "תקועים בתור" ─────────────────────────────────────────────────────── */

/** מועד חזרה שעבר ביותר מזה (בימי לוח) — הליד תקוע */
export const STUCK_OVERDUE_DAYS = 2;
/** סטטוס שלא השתנה לפחות כך הרבה ימי לוח — הליד תקוע */
export const STUCK_IDLE_DAYS = 30;

/** למה הליד תקוע. כשכמה סיבות חלות — הראשונה בסדר הזה. */
export type StuckReason = "overdue" | "noAnswer" | "idle";

export interface StuckInfo {
  reason: StuckReason;
  /** ימי לוח מאז שינוי הסטטוס האחרון */
  days: number;
  /** בכמה ימי לוח מועד החזרה עבר — רק כשהוא עדיין פתוח */
  overdueDays?: number;
}

/**
 * מועד חזרה ש"עדיין פתוח": נקבע, ואיש לא שינה את הסטטוס מאז שהגיע.
 *
 * ⚠️ בלי התנאי השני, "החזר לתור" על ליד שהחזרה שלו פוספסה לא היה מוציא
 * אותו מהרשימה: מעבר ל"ליד חוזר" לא מנקה את `followUpAt` (רק סטטוס סופי
 * מנקה), ולכן הליד היה נשאר "באיחור" עם סטטוס חדש וטוסט הצלחה מעליו.
 * שינוי סטטוס אחרי מועד החזרה הוא טיפול בליד; מה שתקוע הוא חזרה שאיש
 * לא נגע בליד מאז שעברה.
 */
function isPendingFollowUp(followUp: number | null, changedAt: number | null): boolean {
  return followUp !== null && (changedAt === null || followUp > changedAt);
}

/**
 * האם הליד תקוע, ולמה. `null` = לא תקוע.
 *
 * `today` הוא `israelDay(now)` של הלקוח — מחושב פעם אחת לכל הרשימה.
 *
 * ⚠️ רק בלקוח, אחרי ההרכבה (`useNow`). התשובה תלויה בשעון, ושרת שמחשב
 * אותה ברינדור ולקוח שמחשב אותה בהידרציה לא תמיד מסכימים.
 */
export function stuckInfo(row: MissedLeadRow, today: number): StuckInfo | null {
  if (STATUS_CONFIG[row.status].terminal) return null;

  const changedAt = safeTime(row.lastChangeAt);
  const days = changedAt === null ? 0 : Math.max(0, today - israelDay(changedAt));

  const followUp = safeTime(row.followUpAt);
  const overdueDays =
    followUp !== null && isPendingFollowUp(followUp, changedAt)
      ? today - israelDay(followUp)
      : undefined;

  if (overdueDays !== undefined && overdueDays > STUCK_OVERDUE_DAYS) {
    return { reason: "overdue", days, overdueDays };
  }
  // "חזרה באיחור" נשארת על הכרטיס גם כשהסיבה העיקרית אחרת
  const late = overdueDays !== undefined && overdueDays > 0 ? { overdueDays } : {};
  if (row.status === "noAnswer2") return { reason: "noAnswer", days, ...late };
  if (days >= STUCK_IDLE_DAYS) return { reason: "idle", days, ...late };
  return null;
}

/**
 * מרווח הביטחון של הסינון בשרת.
 *
 * השעון של הלקוח מתקדם מאז שהדף נשלח, ויום לוח שונה מ-24 שעות בשעה
 * אחת בליל מעבר שעון. יום שלם מכסה דף שנשאר פתוח עד ~23 שעות.
 */
const SLACK_MS = DAY_MS;

/**
 * סינון גס בשרת: **על-קבוצה** של מה ש-`stuckInfo` יחזיר בלקוח.
 *
 * ⚠️ קיים כדי שלא כל ליד פתוח בארגון ייסע לדפדפן בשביל לשונית שמציגה
 * רק את התקועים שבהם. הוא מקל בכוונה (`SLACK_MS`) — ליד מיותר שנשלח
 * פשוט לא יוצג, אבל ליד תקוע שלא נשלח היה נעלם מהספירה בלי שום סימן.
 * כל שינוי ב-`stuckInfo` חייב להיכנס גם לכאן.
 */
export function mayBeStuck(row: MissedLeadRow, now: number): boolean {
  if (STATUS_CONFIG[row.status].terminal) return false;
  if (row.status === "noAnswer2") return true;

  const changedAt = safeTime(row.lastChangeAt);
  if (changedAt === null) return true;
  if (changedAt < now - (STUCK_IDLE_DAYS - 1) * DAY_MS + SLACK_MS) return true;

  const followUp = safeTime(row.followUpAt);
  return (
    followUp !== null &&
    isPendingFollowUp(followUp, changedAt) &&
    followUp < now - STUCK_OVERDUE_DAYS * DAY_MS + SLACK_MS
  );
}

/** כמה זמן הליד לא זז — בעברית של אנשים, לא "תקוע 1 ימים". */
export function stuckFor(days: number): string {
  if (days <= 0) return "נתקע היום";
  if (days === 1) return "תקוע מאתמול";
  if (days === 2) return "תקוע יומיים";
  return `תקוע ${number(days)} ימים`;
}

/** "חזרה באיחור של 3 ימים" — `days` חיובי בלבד. */
export function overdueFor(days: number): string {
  if (days === 1) return "חזרה באיחור של יום";
  if (days === 2) return "חזרה באיחור של יומיים";
  return `חזרה באיחור של ${number(days)} ימים`;
}
