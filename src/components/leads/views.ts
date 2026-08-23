import type { Filters } from "./FilterBar";
import { EMPTY_FILTERS } from "./FilterBar";
import type { LeadStatus } from "@/lib/domain/types";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";

/**
 * תצוגות מהירות.
 *
 * סוכן לא חושב במונחי "סנן לפי סטטוס ואז לפי עובד" — הוא חושב
 * "מה אני צריך לעשות עכשיו". כל תצוגה כאן היא שאלה כזו, מתורגמת
 * לצירוף מסננים.
 */
export interface QuickView {
  key: string;
  label: string;
  /** מה התצוגה קובעת. השאר נשאר ריק. */
  patch: (userId: string) => Filters;
  /**
   * התצוגה מוצגת רק למי שרואה את כל הלידים.
   *
   * לעובד שרואה רק את הלידים שלו, "שלי" זהה ל"הכל" ו"ללא שיוך"
   * תמיד ריקה — שני צ׳יפים שתופסים מקום ולא עושים כלום.
   */
  fullAccessOnly?: boolean;
}

/**
 * מה שהמסך נפתח בו: **לידים חדשים בלבד.**
 *
 * המסך הראשי הוא "מה נכנס ולא טופל", ולא ארכיון של כל מה שאי פעם היה
 * במערכת. כל השאר לא נעלם — הוא נמצא באריחי הסטטוס, בתצוגות המהירות
 * ובחיפוש, במרחק לחיצה אחת.
 *
 * ⚠️ זה מצב פתיחה ולא `EMPTY_FILTERS`. הצ׳יפ "הכל" חייב להישאר באמת
 * הכל, אחרת אין דרך לצאת מהחתך הזה — ו"ניקוי מסננים" מחזיר גם הוא
 * ל-`EMPTY_FILTERS` ולא לכאן.
 *
 * ⚠️ תופעת לוואי מכוונת: בטעינה הצ׳יפ "חדשים" ואריח "חדש" נראים
 * דלוקים, ומונה המסננים מראה 1. זו האמת — המסך אכן מסונן — והיא גם
 * מה שמסביר למשתמש למה הוא לא רואה את שאר הלידים.
 */
export const INITIAL_FILTERS: Filters = { ...EMPTY_FILTERS, status: ["new"] };

export const QUICK_VIEWS: QuickView[] = [
  {
    key: "all",
    label: "הכל",
    patch: () => EMPTY_FILTERS,
  },
  {
    key: "mine",
    label: "שלי",
    patch: (userId) => ({ ...EMPTY_FILTERS, assignee: [userId], openOnly: true }),
    fullAccessOnly: true,
  },
  {
    key: "due",
    label: "לחזור היום",
    patch: () => ({ ...EMPTY_FILTERS, dueToday: true, openOnly: true }),
  },
  {
    key: "new",
    label: "חדשים",
    // אותו אובייקט כמו מצב הפתיחה — אחרת השניים היו יכולים להיפרד,
    // והצ׳יפ היה נראה כבוי במסך שהוא בדיוק מה שהוא מייצג
    patch: () => INITIAL_FILTERS,
  },
  {
    key: "urgent",
    label: "דחוף",
    patch: () => ({
      ...EMPTY_FILTERS,
      priority: ["urgent", "high"],
      openOnly: true,
    }),
  },
  {
    key: "unassigned",
    label: "ללא שיוך",
    patch: () => ({
      ...EMPTY_FILTERS,
      assignee: ["unassigned"],
      openOnly: true,
    }),
    fullAccessOnly: true,
  },
  {
    key: "starred",
    label: "מסומנים",
    patch: () => ({ ...EMPTY_FILTERS, starred: true }),
  },
  /**
   * הדרך המפורשת לראות מה שירד מהמסך הראשי.
   *
   * ⚠️ קיימת כי `EMPTY_FILTERS` מסתיר סטטוסים סופיים כברירת מחדל.
   * בלי צ׳יפ כזה "איפה הלידים שסגרתי?" הופך לשאלה בלי תשובה במסך,
   * וזה בדיוק המצב שהופך הסתרה למחיקה מבחינת המשתמש.
   */
  {
    key: "closed",
    label: "סגורים",
    patch: () => ({
      ...EMPTY_FILTERS,
      openOnly: false,
      status: STATUS_ORDER.filter((s) => STATUS_CONFIG[s].terminal),
    }),
  },
  /*
    ⚠️ "לידים חמים" ו"לידים מדאטה" **הוסרו מכאן** לטובת `KindToggle`.
    כתצוגות הן היו `patch: () => ({ ...EMPTY_FILTERS, kind })`, כלומר
    הדרך היחידה לראות דאטה קרה מחקה בדרך כל סטטוס, שיוך או עדיפות
    שהיו פעילים — "הדאטה הקרה שבאין מענה" לא היה ניתן לביטוי. סוג
    הליד הוא ממד שמצטלב עם השאר, לא תצוגה שמחליפה אותם.
  */
];

/**
 * האם מסנן הסטטוס הוא **ברירת הפתיחה** ולא בחירה של המשתמש.
 *
 * ⚠️ קיים בשביל החיפוש. המסך נפתח מסונן ל"חדשים", ובלי ההבחנה הזו
 * חיפוש שם של עובד או של לקוח היה מחזיר אפס תוצאות כל עוד הליד אינו
 * חדש — כלומר כמעט תמיד. ברירת מחדל צריכה לזוז מהדרך ברגע שמחפשים;
 * בחירה מפורשת של סטטוס (לחיצה על אריח) לא.
 */
export function isOpeningStatus(status: readonly string[]): boolean {
  return sameSet([...status], [...INITIAL_FILTERS.status]);
}

/**
 * האם המסננים הנוכחיים זהים לתצוגה. משמש לסימון הצ׳יפ הפעיל.
 *
 * ⚠️ `query` **לא** נכלל בהשוואה: החיפוש חי לצד התצוגה ולא מבטל אותה.
 * כשהוא נכלל, הקלדת מילת חיפוש כיבתה את הצ׳יפ הפעיל, והמשתמש ראה
 * "אין תצוגה פעילה" בזמן שהסינון בהחלט פעיל.
 */
export function isViewActive(
  view: QuickView,
  filters: Filters,
  userId: string,
): boolean {
  const target = view.patch(userId);

  return (
    filters.starred === target.starred &&
    filters.openOnly === target.openOnly &&
    filters.dueToday === target.dueToday &&
    sameSet(filters.status, target.status) &&
    sameSet(filters.kind, target.kind) &&
    sameSet(filters.priority, target.priority) &&
    sameSet(filters.category, target.category) &&
    sameSet(filters.assignee, target.assignee)
  );
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

/**
 * לחיצה על אריח סטטוס — מה מסנן הסטטוס הופך להיות.
 *
 * ⚠️⚠️ **ברירת הפתיחה נדחקת הצידה בלחיצה הראשונה, ולא מצטרפת אליה.**
 *
 * המסך נפתח מסונן ל"חדשים" (`INITIAL_FILTERS`), ולכן צירוף נאיבי אמר
 * שלחיצה על "אין מענה 1" נותנת `["new","no_answer_1"]` — כלומר האריח
 * הבטיח 5 והטבלה הציגה 5 ועוד כל החדשים. זו בדיוק הסתירה שהמספר על
 * האריח אמור למנוע: **המספר הוא כמה שורות יתקבלו בלחיצה עליו** (ראה
 * `LeadsClient` › `tileCounts`), והוא נספר בלי מסנן הסטטוס.
 *
 * מהלחיצה השנייה ואילך זו כן בחירה מרובה אמיתית — מי שכבר בחר סטטוס
 * מפורש התכוון אליו, ואילו "חדשים" של מסך הפתיחה איש לא בחר.
 *
 * מקור אמת יחיד: גם רצועת האריחים בכותרת וגם גיליון "כל הסטטוסים"
 * בטלפון קוראים מכאן.
 */
export function toggleStatusFilter(
  current: readonly LeadStatus[],
  status: LeadStatus,
): LeadStatus[] {
  if (current.includes(status)) return current.filter((s) => s !== status);
  if (isOpeningStatus(current)) return [status];
  return [...current, status];
}
