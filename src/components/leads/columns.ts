import { useSyncExternalStore } from "react";
import type { SortField } from "./LeadsClient";

/**
 * הגדרת העמודות של טבלת הלידים.
 *
 * מקור אמת יחיד: הכותרת, האפשרות למיין, וברירת המחדל של ההצגה מוגדרים
 * כאן פעם אחת, ו-`LeadsTable` / `LeadRow` נגזרים ממנו. כך אי אפשר
 * להוסיף כותרת בלי תא, או להפך.
 *
 * `alwaysOn` הוא לעמודות שבלעדיהן השורה חסרת משמעות — הן לא מופיעות
 * בבורר, כדי שאי אפשר יהיה להסתיר את השם או את הסטטוס בטעות.
 */

export type ColumnKey =
  | "name"
  | "status"
  | "priority"
  | "updatedAt"
  | "followUpAt"
  | "category"
  | "cost"
  | "assignee"
  | "activity"
  | "packageName"
  | "source"
  | "provider"
  | "city"
  | "email"
  | "createdAt"
  | "lastContactAt";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** שדה המיון, כשהעמודה ניתנת למיון */
  sort?: SortField;
  /** לא ניתן להסתרה */
  alwaysOn?: boolean;
  /** מוצגת כברירת מחדל */
  defaultOn: boolean;
  /**
   * מוצגת רק למי שרואה את כל הלידים (`canSeeAllLeads`).
   *
   * ⚠️ הסתרה בתצוגה, לא הרשאה. הליד עצמו נשלח ללקוח במלואו, וכל מה
   * שיש כאן הוא ממילא שדה של ליד שהעובד כבר מטפל בו — השליפה בשרת
   * כבר מגבילה אותו ללידים שלו. אם מישהו מהעובדים **אסור** לו לדעת
   * את הנתון, זו החלטה שצריכה לרדת לשליפה ב-`leads/page.tsx`.
   */
  fullAccessOnly?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: "name", label: "ליד", sort: "name", alwaysOn: true, defaultOn: true },
  { key: "status", label: "סטטוס", sort: "status", alwaysOn: true, defaultOn: true },
  { key: "priority", label: "עדיפות", sort: "priority", defaultOn: true },
  { key: "updatedAt", label: "עודכן", sort: "updatedAt", defaultOn: true },
  { key: "followUpAt", label: "חזרה", sort: "followUpAt", defaultOn: true },
  { key: "category", label: "קטגוריה", defaultOn: true },
  // דלוקה כברירת מחדל: זה מה שהסוכן צריך לדעת לפני שהוא מרים טלפון,
  // ובלידים שמגיעים מה-API זה השדה שנושא את פרטי ההתעניינות
  { key: "packageName", label: "חבילה", defaultOn: true },
  { key: "cost", label: "עלות", defaultOn: true },
  // מי מחזיק את הליד הוא נתון ניהולי: לעובד כל הלידים שהוא רואה הם
  // ממילא שלו, ולכן העמודה רק תופסת רוחב אצלו
  { key: "assignee", label: "משויך ל", defaultOn: true, fullAccessOnly: true },
  { key: "activity", label: "פעילות", defaultOn: true },
  // מאיפה הליד הגיע הוא חלק מהחלטת החיוג, לא מטא-דאטה: פנייה מטופס
  // ולקוח ממחזור הם שתי שיחות שונות לגמרי. הייתה כבויה כברירת מחדל
  // וכמעט אף אחד לא ידע שהיא קיימת בבורר — ראה `PROMOTED_TO_DEFAULT`.
  //
  // ⚠️ ניהולית: מאיפה מגיעים הלידים ומה עלה כל ערוץ הן שאלות של מי
  // שקונה את הלידים, לא של מי שמחייג אליהם.
  { key: "source", label: "מקור", defaultOn: true, fullAccessOnly: true },
  // כבויות כברירת מחדל — זמינות דרך הבורר, כדי לא להחזיר את הצפיפות
  { key: "provider", label: "ספק נוכחי", defaultOn: false },
  { key: "city", label: "עיר", defaultOn: false },
  { key: "email", label: "אימייל", defaultOn: false },
  { key: "createdAt", label: "נוצר", sort: "createdAt", defaultOn: false },
  { key: "lastContactAt", label: "קשר אחרון", defaultOn: false },
];

export const DEFAULT_VISIBLE: ColumnKey[] = COLUMNS.filter((c) => c.defaultOn).map(
  (c) => c.key,
);

/** עמודות שהמשתמש יכול לכבות — הבסיס לבורר. */
export const TOGGLEABLE = COLUMNS.filter((c) => !c.alwaysOn);

/**
 * סינון לפי תפקיד — נקודה אחת, גם לטבלה וגם לבורר.
 *
 * ⚠️ הסינון בזמן רינדור ולא בשמירה. מה שנשמר ב-localStorage נשאר
 * ניטרלי לתפקיד, ולכן עובד שיקודם למנהל יראה את העמודות מיד ובלי
 * שהבחירות האחרות שלו יידרסו.
 */
export function allowedColumns<T extends { fullAccessOnly?: boolean }>(
  cols: T[],
  canSeeAll: boolean,
): T[] {
  return canSeeAll ? cols : cols.filter((c) => !c.fullAccessOnly);
}

const STORAGE_KEY = "onestop.leads.columns";

/**
 * הצורה השמורה.
 *
 * ⚠️ `known` הוא הסיבה שזה אובייקט ולא מערך. קודם נשמר רק `visible`,
 * ואז **עמודה חדשה לא הופיעה אף פעם** אצל מי שכבר נגע בבורר: היא לא
 * ברשימה השמורה, ואי אפשר להבחין בין "המשתמש כיבה אותה" לבין "היא
 * נוספה אחרי שהוא שמר". זה מה שקרה עם עמודת "חבילה" — היא נולדה
 * `defaultOn`, וכל מי שהיה לו אחסון קיים לא ראה אותה מעולם.
 *
 * `known` הוא צילום של העמודות שהיו קיימות בזמן השמירה, ולכן עמודה
 * חדשה מזוהה כחדשה ונכנסת לפי ברירת המחדל שלה, בלי לדרוס בחירות.
 */
interface StoredColumns {
  visible: ColumnKey[];
  known: ColumnKey[];
  /** אילו קידומים כבר הוחלו אצל המשתמש. ראה `PROMOTED_TO_DEFAULT`. */
  promoted?: ColumnKey[];
}

/**
 * עמודות שהיו קיימות וכבויות, ו**קודמו** לברירת מחדל.
 *
 * ⚠️ `known` פותר רק עמודה **חדשה**. עמודה ותיקה שהופכת ל-`defaultOn`
 * לא תגיע לאף אחד שכבר נגע בבורר — היא נמצאת ב-`known` השמור, ולכן
 * היעדרותה מ-`visible` נקראת כ"המשתמש כיבה אותה". זה בדיוק מה שקרה
 * ל"מקור": היא הייתה זמינה בבורר, איש לא ידע שהיא שם, וההחלטה
 * להדליק אותה כברירת מחדל הייתה נשארת בלי השפעה.
 *
 * החלופה — לאפס את מפתח האחסון — הייתה מוחקת גם את כל שאר הבחירות.
 * כאן מקודמת עמודה אחת, פעם אחת, וכל השאר נשמר.
 */
const PROMOTED_TO_DEFAULT: ColumnKey[] = ["source"];

/**
 * קריאת הבחירה השמורה.
 *
 * מחזיר `null` בשרת ובריצה הראשונה — הקורא מתחיל מברירת המחדל ומעדכן
 * אחרי ההרכבה, כדי שלא תיווצר אי-התאמת הידרציה.
 */
export function readStoredColumns(): ColumnKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    const isLegacy = Array.isArray(parsed);
    const stored: unknown = isLegacy ? parsed : (parsed as StoredColumns)?.visible;
    if (!Array.isArray(stored)) return null;

    const catalog = new Set(COLUMNS.map((c) => c.key));
    const visible = stored.filter(
      (k): k is ColumnKey => typeof k === "string" && catalog.has(k as ColumnKey),
    );

    // בפורמט הישן אין רישום של מה היה קיים בזמן השמירה. ההנחה
    // השמרנית היא שכל מה שחסר הוא חדש — פעם אחת בלבד, כי הכתיבה
    // הבאה כבר תשמור `known`.
    const known: unknown = isLegacy ? null : (parsed as StoredColumns)?.known;
    const seen = new Set<string>(Array.isArray(known) ? (known as string[]) : []);

    const promoted: unknown = isLegacy ? null : (parsed as StoredColumns)?.promoted;
    const applied = new Set<string>(
      Array.isArray(promoted) ? (promoted as string[]) : [],
    );

    for (const c of COLUMNS) {
      if (visible.includes(c.key)) continue;
      const isNewToUser = !seen.has(c.key);
      // קידום שטרם הוחל נחשב כמו עמודה חדשה — פעם אחת, כי הכתיבה
      // הבאה תרשום אותו ב-`promoted` והמשתמש יוכל לכבות אותה סופית
      const isFreshPromotion =
        PROMOTED_TO_DEFAULT.includes(c.key) && !applied.has(c.key);
      if (c.alwaysOn || ((isNewToUser || isFreshPromotion) && c.defaultOn)) {
        visible.push(c.key);
      }
    }
    return visible;
  } catch {
    return null;
  }
}

function writeStoredColumns(keys: ColumnKey[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredColumns = {
      visible: keys,
      known: COLUMNS.map((c) => c.key),
      promoted: PROMOTED_TO_DEFAULT,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // מצב פרטי / אחסון מלא — הבחירה פשוט לא תישמר בין רענונים
  }
}

/* ── חנות חיצונית ─────────────────────────────────────────────────────── */

/**
 * הבחירה נקראת דרך `useSyncExternalStore` ולא דרך effect שמעדכן state.
 *
 * זה מה שמאפשר לשרת להחזיר את ברירת המחדל ולקוח להחזיר את השמור, בלי
 * אי-התאמת הידרציה ובלי רינדור נוסף. אותו דפוס כמו `useNow` ב-clock.ts.
 */
let current: ColumnKey[] | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ColumnKey[] {
  // נקרא פעם אחת ונשמר — `useSyncExternalStore` דורש הפניה יציבה
  if (current === null) current = readStoredColumns() ?? DEFAULT_VISIBLE;
  return current;
}

function getServerSnapshot(): ColumnKey[] {
  return DEFAULT_VISIBLE;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function setVisibleColumns(next: ColumnKey[]): void {
  current = next;
  writeStoredColumns(next);
  for (const l of listeners) l();
}

export function useVisibleColumns(): ColumnKey[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
