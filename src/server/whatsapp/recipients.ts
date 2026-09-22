import "server-only";

import { prisma } from "@/server/db/client";
import { isIsraeliPhone, toE164 } from "@/lib/format";
import { shouldReviveRow } from "@/lib/domain/requeue";

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
 * מחזירה כמה שורות נוצרו או הוחייאו בפועל.
 *
 * ⚠️ הפרת ייחודיות אינה שגיאה: היא המצב הרגיל בכל תקתוק אחרי הראשון,
 * כשההתראה כבר בתור. אבל היא **גם** המצב שבו שורה מתה תופסת את
 * המפתח לנצח — ולכן היא מובילה ל-`revive` ולא לבליעה שקטה.
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
    const dedupeKey = `${input.dedupeKey}${target.keySuffix}`;
    try {
      await prisma.whatsAppMessage.create({
        data: {
          dedupeKey,
          toPhone: target.toPhone,
          body: input.body,
          scheduledFor: input.scheduledFor,
          leadId: input.leadId,
          recipientUserId: input.user.id,
        },
      });
      created++;
    } catch (error) {
      /*
       * ⚠️⚠️ **רק הפרת ייחודיות נבלעת.** קודם היה כאן `catch {}` ריק,
       * ולכן ניתוק מהמסד, גוף ארוך מדי או כל תקלה אחרת נראו בדיוק
       * כמו "כבר בתור" — והמונה שחוזר מכאן דיווח פחות בלי שאיש ידע.
       */
      if (!isUniqueViolation(error)) {
        console.error(`[wa] הכנסה לתור נכשלה (${dedupeKey}):`, error);
        continue;
      }
      if (await revive(dedupeKey, input)) created++;
    }
  }

  return created;
}

/** קוד הפרת הייחודיות של Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * מחייה שורה מתה שתופסת את המפתח, ומחזירה האם נעשה משהו.
 *
 * ⚠️⚠️ **בלי זה תזכורת נעלמת בשקט.** המפתח הוא `@unique` גלובלי ושורות
 * לא נמחקות, ולכן שורה שבוטלה או נכשלה חוסמת את מועד החזרה שלה
 * לתמיד. בייצור נמצאו 12 לידים במצב הזה. ראה `lib/domain/requeue.ts`
 * לשני המסלולים שמגיעים לשם ולמה הגבול של 48 שעות הכרחי.
 *
 * ⚠️ העדכון מותנה על אותו סטטוס שנקרא, כדי ששורה שהתעוררה בין
 * הקריאה לכתיבה לא תידרס. אותו אידיום כמו `claim`.
 */
async function revive(
  dedupeKey: string,
  input: { body: string; scheduledFor: Date; leadId?: string },
): Promise<boolean> {
  const row = await prisma.whatsAppMessage.findUnique({
    where: { dedupeKey },
    select: { id: true, status: true },
  });
  if (!row) return false;

  if (
    !shouldReviveRow({
      status: row.status,
      scheduledFor: input.scheduledFor.getTime(),
      now: Date.now(),
    })
  ) {
    return false;
  }

  const { count } = await prisma.whatsAppMessage.updateMany({
    where: { id: row.id, status: row.status },
    data: {
      status: "queued",
      body: input.body,
      scheduledFor: input.scheduledFor,
      attempts: 0,
      claimedAt: null,
      sentAt: null,
      lastError: null,
      leadId: input.leadId,
    },
  });
  return count > 0;
}
