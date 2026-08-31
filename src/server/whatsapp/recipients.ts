import "server-only";

import { prisma } from "@/server/db/client";
import { isIsraeliPhone, toE164 } from "@/lib/format";

/**
 * ── נמען אחד, כמה מכשירים ─────────────────────────────────────────────
 *
 * לעובד יכולים להיות כמה מספרים (`User.extraPhones`), וכל התראה יוצאת
 * לכולם. בתור זה אומר שורה נפרדת לכל מספר — הבוט שולח לנמען אחד בכל
 * שורה, ואין שום ייצוג אחר.
 */

export interface PhoneOwner {
  phone: string | null;
  extraPhones?: string[];
}

/**
 * כל המספרים של המשתמש, כשלכל אחד מפתח דדופ משלו.
 *
 * ⚠️ **המספר הראשי שומר על המפתח המקורי, בלי סיומת.** הוספת סיומת גם
 * לו הייתה משנה את המפתח של כל התראה קיימת, וכל מה שכבר נשלח פעם אחת
 * היה נשלח שוב — הצפה חד-פעמית של הצוות ברגע העלייה לאוויר.
 *
 * ⚠️ מספר לא תקין מושמט ולא מפיל את השאר. שורה עם מספר פסול נדחית
 * ממילא אצל מטא, ובדרך היא בולעת את הניסיון של האחרים.
 */
export function phoneTargets(
  user: PhoneOwner,
): { toPhone: string; keySuffix: string }[] {
  const targets: { toPhone: string; keySuffix: string }[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined, keySuffix: string) => {
    if (!raw || !isIsraeliPhone(raw)) return;
    const toPhone = toE164(raw);
    if (seen.has(toPhone)) return;
    seen.add(toPhone);
    targets.push({ toPhone, keySuffix });
  };

  add(user.phone, "");
  for (const extra of user.extraPhones ?? []) add(extra, `:${extra}`);

  return targets;
}

/**
 * מכניסה לתור הודעה אחת לכל מספר של הנמען.
 *
 * מחזירה כמה שורות נוצרו בפועל. ⚠️ הפרת ייחודיות נבלעת בכוונה: היא
 * המצב הרגיל בכל סקר אחרי הראשון — ההתראה כבר בתור — ולא שגיאה.
 */
export async function enqueueForUser(input: {
  user: PhoneOwner & { id: string };
  dedupeKey: string;
  body: string;
  scheduledFor: Date;
  leadId?: string;
}): Promise<number> {
  let created = 0;

  for (const target of phoneTargets(input.user)) {
    try {
      await prisma.whatsAppMessage.create({
        data: {
          dedupeKey: `${input.dedupeKey}${target.keySuffix}`,
          toPhone: target.toPhone,
          body: input.body,
          scheduledFor: input.scheduledFor,
          leadId: input.leadId,
          recipientUserId: input.user.id,
        },
      });
      created++;
    } catch {
      // כבר בתור עבור המספר הזה.
    }
  }

  return created;
}
