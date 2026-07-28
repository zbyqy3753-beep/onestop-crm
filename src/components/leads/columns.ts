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
    if (!Array.isArray(parsed)) return null;

    const known = new Set(COLUMNS.map((c) => c.key));
    const valid = parsed.filter(
      (k): k is ColumnKey => typeof k === "string" && known.has(k as ColumnKey),
    );
    // העמודות הקבועות תמיד נכנסות, גם אם נשמרה בחירה ישנה בלעדיהן
    for (const c of COLUMNS) if (c.alwaysOn && !valid.includes(c.key)) valid.push(c.key);
    return valid;
  } catch {
    return null;
  }
}

function writeStoredColumns(keys: ColumnKey[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
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
