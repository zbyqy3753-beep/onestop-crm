import type { CategoryKey, DealStage, ProviderKey, UserId } from "@/lib/domain/types";

/**
 * מסנני מסך "מעקב עסקאות".
 *
 * טווח התאריכים הוא בררת ברירת מחדל שונה מלידים: מנהל שפותח את
 * המסך רוצה לדעת "מה נסגר החודש", לא את כל ההיסטוריה — לכן ברירת
 * המחדל היא "החודש" ולא "הכל".
 */
export type DateRangeKey = "all" | "today" | "week" | "month";

export interface DealFilters {
  query: string;
  agent: UserId[];
  provider: ProviderKey[];
  category: CategoryKey[];
  stage: DealStage[];
  range: DateRangeKey;
}

export const DEFAULT_DEAL_FILTERS: DealFilters = {
  query: "",
  agent: [],
  provider: [],
  category: [],
  stage: [],
  range: "month",
};

export const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "היום" },
  { key: "week", label: "השבוע" },
  { key: "month", label: "החודש" },
  { key: "all", label: "הכל" },
];

/** תחילת הטווח הנבחר, ביחס ל-`now`. `null` = ללא הגבלה. */
export function rangeStart(range: DateRangeKey, now: number): number | null {
  if (range === "all") return null;

  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  if (range === "today") return d.getTime();
  if (range === "week") {
    d.setDate(d.getDate() - d.getDay()); // יום ראשון כתחילת שבוע
    return d.getTime();
  }
  d.setDate(1); // "month"
  return d.getTime();
}
