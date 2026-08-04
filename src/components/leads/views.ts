import type { Filters } from "./FilterBar";
import { EMPTY_FILTERS } from "./FilterBar";
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
    patch: () => ({ ...EMPTY_FILTERS, status: ["new"] }),
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
  {
    key: "hot",
    label: "לידים חמים",
    patch: () => ({ ...EMPTY_FILTERS, kind: ["hot"] }),
  },
  {
    key: "data",
    label: "לידים מדאטה",
    patch: () => ({ ...EMPTY_FILTERS, kind: ["data"] }),
  },
];

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
