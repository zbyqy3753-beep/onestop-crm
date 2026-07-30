"use server";

import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import { LEAD_CATEGORY_ORDER, type LeadCostTable } from "@/lib/domain/types";
import type { ActionResult } from "@/app/(app)/leads/actions";
import { revalidatePath } from "next/cache";
import { revalidateLeadSurfaces } from "@/app/(app)/_revalidate";

/**
 * עדכון עלות רכישת ליד לפי קטגוריה.
 *
 * העלות משפיעה ישירות על חישוב הרווח בכל עסקה, ולכן היא נאמתת
 * בשרת — ערך שלילי או לא-מספרי היה מייצר רווחים שגויים בשקט.
 */
export async function saveLeadCostsAction(
  costs: Record<string, number>,
): Promise<ActionResult> {
  // הערך הזה מזיז כל מספר רווח במערכת — נקודת קצה שאפשר לקרוא לה
  // ישירות, ולכן היא מאמתת סשן בעצמה ולא נשענת על השער ב-proxy
  await requireSessionUser();

  const next = {} as LeadCostTable;

  for (const category of LEAD_CATEGORY_ORDER) {
    const value = costs[category];

    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: "עלות חייבת להיות מספר חיובי" };
    }
    next[category] = Math.round(value * 100) / 100;
  }

  await db.settings.setLeadCosts(next);

  // גם מסך הלידים, גם הדשבורד וגם מסך העסקאות מציגים רווח שנגזר
  // מהעלויות האלה — בלי הריענון הרחב הם ממשיכים להראות מספרים ישנים
  revalidatePath("/packages");
  revalidateLeadSurfaces();
  return { ok: true };
}
