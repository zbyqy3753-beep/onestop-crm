import type { Lead, LeadCostTable, UserRef } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  LEAD_CATEGORY_CONFIG,
  PROVIDER_CONFIG,
  SOURCE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import type { SheetCell, SheetSpec } from "@/lib/xlsxWrite";
import { leadCost } from "@/server/services/economics";

/**
 * המרת לידים לגיליון אקסל.
 *
 * יושב בקובץ נפרד ולא בתוך `LeadsClient` — זה מה שמונע מהקומפוננטה
 * ההיא לגדול בכל פעם שמוסיפים עמודה.
 */

/**
 * העמודות כרשומות שלמות (כותרת + רוחב + ערך), ולא כמערכים מקבילים.
 *
 * ⚠️ זה מה שמאפשר להשמיט עמודה בלי להזיז נתונים לכותרת שכנה. עם שני
 * מערכים, כל השמטה מותנית חייבת לקרות פעמיים בדיוק באותו סדר, ושכחה
 * באחד מהם מייצרת קובץ שנראה תקין ומשקר בכל שורה.
 */
interface SheetColumnSpec {
  header: string;
  /** רוחב בתווים — נגזר מהתוכן הצפוי, לא מאורך הכותרת */
  width: number;
  cell: (lead: Lead) => SheetCell;
  /** ניהולית בלבד — אותו כלל כמו העמודות במסך, ראה `columns.ts` */
  fullAccessOnly?: boolean;
}

/** תא טקסט, כולל המקרה של ערך חסר. */
function text(value: string | null | undefined): SheetCell {
  return value ? { kind: "text", value } : { kind: "blank" };
}

export function leadsSheet(
  leads: Lead[],
  userById: Map<string, UserRef>,
  costs: LeadCostTable,
  canSeeAll: boolean,
): SheetSpec {
  const all: SheetColumnSpec[] = [
    { header: "סוג", width: 10, cell: (l) => text(KIND_CONFIG[l.kind].short) },
    { header: "שם", width: 22, cell: (l) => text(l.name) },
    // ספרות גולמיות ולא מפורמט: התא מסומן כטקסט ולכן האפס המוביל נשמר,
    // והמספר ניתן להעתקה ישירה לחייגן או לוואטסאפ.
    { header: "טלפון", width: 14, cell: (l) => text(l.phone) },
    { header: "אימייל", width: 26, cell: (l) => text(l.email) },
    { header: "עיר", width: 14, cell: (l) => text(l.city) },
    {
      header: "שיוך",
      width: 16,
      fullAccessOnly: true,
      cell: (l) =>
        text(l.assigneeId ? (userById.get(l.assigneeId)?.name ?? "") : "ללא שיוך"),
    },
    {
      header: "קטגוריה",
      width: 16,
      cell: (l) => text(l.category ? LEAD_CATEGORY_CONFIG[l.category].label : ""),
    },
    { header: "חבילה", width: 22, cell: (l) => text(l.packageName) },
    // מספר ולא טקסט — כך שורת "סכום" בתחתית העמודה עובדת מאליה
    {
      header: "עלות",
      width: 12,
      cell: (l) => ({ kind: "money", value: leadCost(l, costs) }),
    },
    {
      header: "מקור",
      width: 18,
      fullAccessOnly: true,
      cell: (l) => text(l.sourceDetail),
    },
    {
      header: "אופן קליטה",
      width: 14,
      fullAccessOnly: true,
      cell: (l) => text(SOURCE_CONFIG[l.source].label),
    },
    {
      header: "ספק נוכחי",
      width: 14,
      cell: (l) => text(l.currentProvider ? PROVIDER_CONFIG[l.currentProvider].label : ""),
    },
    { header: "סטטוס", width: 16, cell: (l) => text(STATUS_CONFIG[l.status].label) },
    // תאריך אמיתי ולא מחרוזת: מיון כרונולוגי, סינון לפי טווח ו-PivotTable
    { header: "נוצר", width: 12, cell: (l) => ({ kind: "date", value: l.createdAt }) },
    { header: "עודכן", width: 12, cell: (l) => ({ kind: "date", value: l.updatedAt }) },
    // dateTime ולא date — לתאריך חזרה יש שעה, וזו השעה שהתזכורת יוצאת בה
    {
      header: "חזרה מתוכננת",
      width: 18,
      cell: (l) =>
        l.followUpAt ? { kind: "dateTime", value: l.followUpAt } : { kind: "blank" },
    },
  ];

  // ⚠️ בלי הסינון כאן, ההסתרה במסך הייתה קישוט: לחיצה על "ייצוא"
  // הייתה מחזירה את אותן עמודות בדיוק לאותו עובד.
  const cols = canSeeAll ? all : all.filter((c) => !c.fullAccessOnly);

  return {
    name: "לידים",
    columns: cols.map((c) => ({ header: c.header, width: c.width })),
    rows: leads.map((lead) => cols.map((c) => c.cell(lead))),
  };
}

/** `leads-2026-07-28.xlsx` */
export function leadsSheetFilename(): string {
  return `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
