import type { Lead, LeadCostTable, User } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  LEAD_CATEGORY_CONFIG,
  PROVIDER_CONFIG,
  SOURCE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import { date, dateTime, phone } from "@/lib/format";
import { leadCost } from "@/server/services/economics";

/**
 * המרת לידים לשורות CSV.
 *
 * יושב בקובץ נפרד ולא בתוך `LeadsClient` — זה מה שמונע מהקומפוננטה
 * ההיא לגדול בכל פעם שמוסיפים עמודה.
 */

/**
 * העמודות כזוגות כותרת+ערך, ולא כשני מערכים מקבילים.
 *
 * ⚠️ זה מה שמאפשר להשמיט עמודה בלי להזיז נתונים לכותרת שכנה. עם שני
 * מערכים, כל השמטה מותנית חייבת לקרות פעמיים בדיוק באותו סדר, ושכחה
 * באחד מהם מייצרת קובץ שנראה תקין ומשקר בכל שורה.
 */
interface CsvColumn {
  header: string;
  value: (lead: Lead) => string;
  /** ניהולית בלבד — אותו כלל כמו העמודות במסך, ראה `columns.ts` */
  fullAccessOnly?: boolean;
}

export function leadsToCsvRows(
  leads: Lead[],
  userById: Map<string, User>,
  costs: LeadCostTable,
  canSeeAll: boolean,
): string[][] {
  const all: CsvColumn[] = [
    { header: "סוג", value: (l) => KIND_CONFIG[l.kind].short },
    { header: "שם", value: (l) => l.name },
    // מפורמט ולא ספרות גולמיות: אקסל מפרש "0501234567" כמספר ומאבד
    // את האפס המוביל. הייבוא מסיר תווים שאינם ספרות ממילא.
    { header: "טלפון", value: (l) => phone(l.phone) },
    { header: "אימייל", value: (l) => l.email ?? "" },
    { header: "עיר", value: (l) => l.city ?? "" },
    {
      header: "שיוך",
      fullAccessOnly: true,
      value: (l) =>
        l.assigneeId ? (userById.get(l.assigneeId)?.name ?? "") : "ללא שיוך",
    },
    {
      header: "קטגוריה",
      value: (l) => (l.category ? LEAD_CATEGORY_CONFIG[l.category].label : ""),
    },
    { header: "חבילה", value: (l) => l.packageName ?? "" },
    { header: "עלות", value: (l) => String(leadCost(l, costs)) },
    { header: "מקור", fullAccessOnly: true, value: (l) => l.sourceDetail ?? "" },
    {
      header: "אופן קליטה",
      fullAccessOnly: true,
      value: (l) => SOURCE_CONFIG[l.source].label,
    },
    {
      header: "ספק נוכחי",
      value: (l) => (l.currentProvider ? PROVIDER_CONFIG[l.currentProvider].label : ""),
    },
    { header: "סטטוס", value: (l) => STATUS_CONFIG[l.status].label },
    { header: "נוצר", value: (l) => date(l.createdAt) },
    { header: "עודכן", value: (l) => date(l.updatedAt) },
    // dateTime ולא date — לתאריך חזרה יש שעה, וזו השעה שהתזכורת יוצאת בה
    {
      header: "חזרה מתוכננת",
      value: (l) => (l.followUpAt ? dateTime(l.followUpAt) : ""),
    },
  ];

  // ⚠️ בלי הסינון כאן, ההסתרה במסך הייתה קישוט: לחיצה על "ייצוא"
  // הייתה מחזירה את אותן עמודות בדיוק לאותו עובד.
  const cols = canSeeAll ? all : all.filter((c) => !c.fullAccessOnly);

  return [
    cols.map((c) => c.header),
    ...leads.map((lead) => cols.map((c) => c.value(lead))),
  ];
}

/** `leads-2026-07-28.csv` */
export function leadsCsvFilename(): string {
  return `leads-${new Date().toISOString().slice(0, 10)}.csv`;
}
