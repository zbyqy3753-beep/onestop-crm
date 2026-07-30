import type {
  Deal,
  LeadCategoryKey,
  LeadCostTable,
  Package,
  PackageId,
} from "@/lib/domain/types";
import { COMMISSION_MULTIPLIER } from "@/lib/domain/types";

/**
 * כללי החישוב הכספי של המערכת.
 *
 * הפונקציות כאן טהורות — הן לא נוגעות ב-DB ולא ב-React. זה מכוון:
 * החישוב חייב להיות זהה בין אם הנתונים הגיעו מהזיכרון או מ-Postgres,
 * והוא היחיד שאסור שישתנה כשמחליפים מקור נתונים.
 */

/** עמלת בסיס של עסקה — סכום העמלות של החבילות שנסגרו. */
export function baseCommission(
  packageIds: PackageId[],
  catalog: Map<PackageId, Package>,
): number {
  return packageIds.reduce(
    (sum, id) => sum + (catalog.get(id)?.commission ?? 0),
    0,
  );
}

/**
 * העמלה בפועל, אחרי המכפיל.
 *
 * המכפיל (×3.5) הוא כלל התמחור של ONE STOP — הוא ממיר את עמלת
 * הבסיס של הספק לעמלה שהמשווק מקבל בפועל.
 */
export function payableCommission(
  packageIds: PackageId[],
  catalog: Map<PackageId, Package>,
  multiplier: number = COMMISSION_MULTIPLIER,
): number {
  return round2(baseCommission(packageIds, catalog) * multiplier);
}

/**
 * רווח נטו על עסקה: עמלה בפועל פחות עלות רכישת הליד.
 *
 * העלות נגזרת מ-`deal.category` (קטגוריית הליד המקורי, מועתקת בזמן
 * יצירת העסקה) — לא מקטגוריית החבילה. שני ה-enum-ים שונים (ראה
 * types.ts), ו-`LeadCostTable` תמיד ממופתח לפי קטגוריית ליד.
 */
export function netProfit(
  deal: Deal,
  catalog: Map<PackageId, Package>,
  costs: LeadCostTable,
): number {
  const commission = payableCommission(deal.packageIds, catalog);
  const cost = costs[deal.category] ?? 0;
  return round2(commission - cost);
}

export interface AgentPerformance {
  agentId: string;
  deals: number;
  revenue: number;
  commission: number;
  profit: number;
}

/** סיכום ביצועים לכל סוכן. */
export function performanceByAgent(
  deals: Deal[],
  catalog: Map<PackageId, Package>,
  costs: LeadCostTable,
): AgentPerformance[] {
  const acc = new Map<string, AgentPerformance>();

  for (const deal of deals) {
    const row = acc.get(deal.agentId) ?? {
      agentId: deal.agentId,
      deals: 0,
      revenue: 0,
      commission: 0,
      profit: 0,
    };

    row.deals += 1;
    row.revenue += deal.revenue;
    row.commission += payableCommission(deal.packageIds, catalog);
    row.profit += netProfit(deal, catalog, costs);

    acc.set(deal.agentId, row);
  }

  return [...acc.values()]
    .map((r) => ({
      ...r,
      revenue: round2(r.revenue),
      commission: round2(r.commission),
      profit: round2(r.profit),
    }))
    .sort((a, b) => b.profit - a.profit);
}

/**
 * העלות האפקטיבית של ליד בודד.
 *
 * עלות ברמת הליד גוברת על עלות הקטגוריה. השדה אופציונלי בכוונה:
 * `undefined` = "לא הוגדר, קח את ברירת המחדל של הקטגוריה", ואילו
 * `0` = "הליד הזה היה חינם". בלי ההבחנה הזו אי אפשר לייצג ליד חינמי.
 */
export function leadCost(
  lead: { cost?: number; category?: LeadCategoryKey },
  costs: LeadCostTable,
): number {
  if (lead.cost !== undefined) return lead.cost;
  return lead.category ? (costs[lead.category] ?? 0) : 0;
}

/** סך העלות של קבוצת לידים, בהתחשב בעלות פרטנית לכל ליד. */
export function totalLeadCostForLeads(
  leads: { cost?: number; category?: LeadCategoryKey }[],
  costs: LeadCostTable,
): number {
  return round2(leads.reduce((sum, l) => sum + leadCost(l, costs), 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
