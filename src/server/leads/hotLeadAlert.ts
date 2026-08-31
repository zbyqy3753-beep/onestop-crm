import "server-only";

import { db } from "@/server/repositories";
import { hotLeadBody, hotLeadDedupeKey } from "@/lib/domain/alerts";
import { enqueueForUser } from "@/server/whatsapp/recipients";

/**
 * ── התראה על ליד חם שהגיע לעובד ───────────────────────────────────────
 *
 * העובד מקבל וואטסאפ ברגע שליד חם נוחת אצלו — מקליטה אוטומטית, משיוך
 * ידני של מנהל, או משינוי שיוך.
 *
 * ⚠️ **לא זורקת לעולם.** היא נקראת אחרי שהשיוך כבר נשמר, ומכשלון
 * בהתראה אסור שיבטל אותו או יחזיר שגיאה למי שביצע.
 */
export async function notifyHotLeadAssigned(input: {
  lead: { id: string; name: string; phone: string; kind: string };
  assigneeId: string | null | undefined;
  /**
   * מי ביצע את השיוך, כשיש כזה.
   *
   * ⚠️ עובד ששייך ליד לעצמו לא מקבל הודעה: הוא יושב מול המסך ובדיוק
   * לחץ על הכפתור. התראה על פעולה שהמשתמש עשה בעצמו היא הדרך
   * המהירה ביותר ללמד אותו להתעלם מההתראות.
   */
  actorId?: string;
}): Promise<void> {
  try {
    if (input.lead.kind !== "hot") return;
    if (!input.assigneeId) return;
    if (input.actorId && input.actorId === input.assigneeId) return;

    const user = await db.users.getById(input.assigneeId);
    if (!user?.active) return;

    await enqueueForUser({
      user: { id: user.id, phone: user.phone ?? null, extraPhones: user.extraPhones },
      dedupeKey: hotLeadDedupeKey(input.lead.id, user.id),
      body: hotLeadBody(input.lead.name, input.lead.phone),
      // חלון השליחה נאכף ב-`claim`; ליד שנכנס בלילה מחכה לבוקר.
      scheduledFor: new Date(),
      leadId: input.lead.id,
    });
  } catch (error) {
    console.error("[hot] התראת ליד חם נכשלה:", error);
  }
}
