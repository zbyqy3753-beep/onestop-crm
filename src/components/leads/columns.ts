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
  { key: "assignee", label: "משויך ל", defaultOn: true },
  { key: "activity", label: "פעילות", defaultOn: true },
  // כבויות כברירת מחדל — זמינות דרך הבורר, כדי לא להחזיר את הצפיפות
  { key: "source", label: "מקור", defaultOn: false },
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
}

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

    for (const c of COLUMNS) {
      if (visible.includes(c.key)) continue;
      const isNewToUser = !seen.has(c.key);
      if (c.alwaysOn || (isNewToUser && c.defaultOn)) visible.push(c.key);
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
