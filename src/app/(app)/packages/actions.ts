"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { LEAD_CATEGORY_ORDER, type LeadCostTable } from "@/lib/domain/types";
import type { ActionResult } from "@/app/(app)/leads/actions";

/**
 * עדכון עלות רכישת ליד לפי קטגוריה.
 *
 * העלות משפיעה ישירות על חישוב הרווח בכל עסקה, ולכן היא נאמתת
 * בשרת — ערך שלילי או לא-מספרי היה מייצר רווחים שגויים בשקט.
 */
export async function saveLeadCostsAction(
  costs: Record<string, number>,
): Promise<ActionResult> {
  const next = {} as LeadCostTable;

  for (const category of LEAD_CATEGORY_ORDER) {
    const value = costs[category];

    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: "עלות חייבת להיות מספר חיובי" };
    }
    next[category] = Math.round(value * 100) / 100;
  }

  await db.settings.setLeadCosts(next);

  // גם מסך הלידים מציג רווח שנגזר מהעלויות האלה — בלי הרענון הזה
  // הפאנל הפיננסי שם היה ממשיך להראות את המספרים הישנים
  revalidatePath("/packages");
  revalidatePath("/leads");
  return { ok: true };
}
