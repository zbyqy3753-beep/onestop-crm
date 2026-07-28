import type { Lead, LeadCostTable, User } from "@/lib/domain/types";
import {
  KIND_CONFIG,
  LEAD_CATEGORY_CONFIG,
  PROVIDER_CONFIG,
  SOURCE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import { date, phone } from "@/lib/format";
import { leadCost } from "@/server/services/economics";

/**
 * המרת לידים לשורות CSV.
 *
 * יושב בקובץ נפרד ולא בתוך `LeadsClient` — זה מה שמונע מהקומפוננטה
 * ההיא לגדול בכל פעם שמוסיפים עמודה.
 */

const HEADER = [
  "סוג",
  "שם",
  "טלפון",
  "אימייל",
  "עיר",
  "שיוך",
  "קטגוריה",
  "עלות",
  "מקור",
  "ספק נוכחי",
  "סטטוס",
  "נוצר",
  "עודכן",
  "חזרה מתוכננת",
];

export function leadsToCsvRows(
  leads: Lead[],
  userById: Map<string, User>,
  costs: LeadCostTable,
): string[][] {
  const rows = leads.map((lead) => [
    KIND_CONFIG[lead.kind].short,
    lead.name,
    // מפורמט ולא ספרות גולמיות: אקסל מפרש "0501234567" כמספר ומאבד
    // את האפס המוביל. הייבוא מסיר תווים שאינם ספרות ממילא.
    phone(lead.phone),
    lead.email ?? "",
    lead.city ?? "",
    lead.assigneeId ? (userById.get(lead.assigneeId)?.name ?? "") : "ללא שיוך",
    lead.category ? LEAD_CATEGORY_CONFIG[lead.category].label : "",
    String(leadCost(lead, costs)),
    SOURCE_CONFIG[lead.source].label,
    lead.currentProvider ? PROVIDER_CONFIG[lead.currentProvider].label : "",
    STATUS_CONFIG[lead.status].label,
    date(lead.createdAt),
    date(lead.updatedAt),
    lead.followUpAt ? date(lead.followUpAt) : "",
  ]);

  return [HEADER, ...rows];
}

/** `leads-2026-07-28.csv` */
export function leadsCsvFilename(): string {
  return `leads-${new Date().toISOString().slice(0, 10)}.csv`;
}
