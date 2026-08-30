import "server-only";

import { prisma } from "@/server/db/client";
import { db } from "@/server/repositories";
import { isIsraeliPhone, toE164 } from "@/lib/format";
import { isYesLead, type YesLeadFacts } from "@/lib/domain/yes";
import { yesLeadBody, yesLeadDedupeKey } from "@/lib/domain/alerts";

/**
 * ── ניתוב לידים של יאס ────────────────────────────────────────────────
 *
 * שני דברים קורים לליד של יאס ברגע שהוא נכנס: הוא משויך לעובד קבוע,
 * ושני הבעלים מקבלים על כך הודעת וואטסאפ.
 *
 * ⚠️ **חל על קליטה אוטומטית בלבד** — `POST /api/leads` ודף הנחיתה.
 * לא על יצירה ידנית במסך (שם אדם כבר בוחר משויך בעצמו) ולא על ייבוא
 * CSV: ייבוא של 300 שורות היסטוריות היה מייצר 600 הודעות וואטסאפ
 * לבעלים ושורף את התקרה היומית, על לידים שאינם חדשים כלל.
 */

/**
 * העובד שמקבל את לידי יאס, לפי `YES_LEAD_ASSIGNEE_EMAIL`.
 *
 * ⚠️ ב-env ולא בקוד, בדיוק כמו `LEADS_API_PARTNER_ASSIGNEE`
 * ו-`LANDING_ASSIGNEE_EMAIL`: מי מטפל בלידים של איזה ספק היא החלטה
 * עסקית שמשתנה, ואסור שתדרוש פריסה.
 *
 * ⚠️ עובד מושבת מחזיר `undefined` ולא את המזהה שלו. ליד ששויך לחשבון
 * לא פעיל אינו גלוי לאיש — לא לו, כי אינו נכנס, ולא להנהלה שמסתכלת
 * על המאגר הלא-משויך. עדיף ליד בלי שיוך על ליד שנעלם.
 */
export async function yesAssigneeId(): Promise<string | undefined> {
  const email = process.env.YES_LEAD_ASSIGNEE_EMAIL?.trim();
  if (!email) return undefined;

  const user = await db.users.getByEmail(email);
  return user?.active ? user.id : undefined;
}

/**
 * המשויך של ליד נכנס, כשהכלל של יאס גובר.
 *
 * מחזירה את `fallback` כשהליד אינו של יאס או כשאין יעד מוגדר — כך
 * הקורא יכול לכתוב שורה אחת במקום שלוש.
 */
export async function assigneeForIncoming(
  facts: YesLeadFacts,
  fallback: string | undefined,
): Promise<string | undefined> {
  if (!isYesLead(facts)) return fallback;
  return (await yesAssigneeId()) ?? fallback;
}

/**
 * מודיעה לבעלים על ליד יאס שנכנס.
 *
 * ⚠️ **לא זורקת לעולם.** היא נקראת אחרי שהליד כבר נשמר, ומכשלון
 * בהתראה אסור שיחזיר שגיאה לשותף ששלח אותו — הוא ינסה שוב וייצור
 * ליד כפול. כישלון נרשם ללוג והליד נשאר.
 *
 * ⚠️ `scheduledFor` הוא עכשיו ולא "הרגע הפנוי הבא": חלון השליחה נאכף
 * ממילא ב-`claim`, שאינו תובע שורות מחוץ לחלון. ליד שנכנס בלילה
 * מחכה לבוקר בלי שנחשב את השעה כאן פעמיים.
 */
export async function notifyOwnersOfYesLead(lead: {
  id: string;
  name: string;
  phone: string;
  assigneeId?: string;
}): Promise<void> {
  try {
    const owners = await prisma.user.findMany({
      where: { role: "owner", active: true, phone: { not: null } },
      select: { id: true, name: true, phone: true },
    });
    if (owners.length === 0) return;

    const assignee = lead.assigneeId
      ? await db.users.getById(lead.assigneeId)
      : null;
    // "טרם שויך" ולא מחרוזת ריקה: פרמטר ריק בתבנית נדחה על ידי מטא,
    // וזה גם המידע שהמנהל צריך — שהליד נכנס בלי שהכלל תפס.
    const assigneeName = assignee?.name ?? "טרם שויך";

    for (const owner of owners) {
      const to = toE164(owner.phone ?? "");
      if (!to || !isIsraeliPhone(owner.phone ?? "")) continue;

      try {
        await prisma.whatsAppMessage.create({
          data: {
            dedupeKey: yesLeadDedupeKey(lead.id, owner.id),
            toPhone: to,
            body: yesLeadBody(lead.name, lead.phone, assigneeName),
            scheduledFor: new Date(),
            leadId: lead.id,
            recipientUserId: owner.id,
          },
        });
      } catch {
        // מפתח כפול = כבר הותרענו לבעלים הזה על הליד הזה. רצוי.
      }
    }
  } catch (error) {
    console.error("[yes] התראת ליד יאס נכשלה:", error);
  }
}
