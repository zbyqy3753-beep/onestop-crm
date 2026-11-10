import "server-only";

import { prisma } from "@/server/db/client";
import {
  HOT_BATCH_WINDOW_MS,
  hotBatchAppend,
  hotBatchBody,
  hotBatchDedupeKey,
  hotBatchKeyPrefix,
} from "@/lib/domain/hotLeadBatch";
import { phoneTargets } from "@/server/whatsapp/recipients";
import type { Branch } from "@/lib/domain/branches";

/**
 * ── התראה לסניף מוביסל על ליד מסריקת QR ───────────────────────────────
 *
 * סניף שיש לו `whatsapp` ב-`lib/domain/branches.ts` מקבל הודעה על כל
 * ליד שהגיע מה-QR שלו. סניף בלי מספר: כלום.
 *
 * ⚠️⚠️ **אותו מקבץ ואותה תבנית כמו בהתראת ליד חם לעובד**
 * (`hotLeadAlert.ts`), ולא תבנית חדשה. כל תבנית חדשה שהוגשה למטא סווגה
 * מחדש ל-MARKETING והמתינה לאישור; זו כבר מאושרת, וה-drain מזהה אותה
 * לפי התחילית `hotbatch:` (כולל שליחה כטקסט חופשי כשחלון השירות פתוח).
 *
 * המפתח הוא `hotbatch:branch-<code>:<ts>`. לסניף אין משתמש במערכת, ולכן
 * `recipientUserId` נשאר ריק — העמודה מאפשרת זאת.
 *
 * ⚠️ **לא זורקת לעולם.** הליד כבר נשמר, וכשלון בהתראה אסור שיחזיר
 * שגיאה לאתר ששלח אותו.
 */
export async function notifyBranchLead(input: {
  branch: Branch;
  lead: { id: string; name: string; phone: string };
}): Promise<void> {
  try {
    const { branch, lead } = input;
    if (!branch.whatsapp) return;

    const batchOwner = `branch-${branch.code}`;
    for (const target of phoneTargets({ phone: branch.whatsapp, extraPhones: [] })) {
      await addToBatch(batchOwner, target.toPhone, lead);
    }
  } catch (error) {
    console.error("[branch] התראת ליד לסניף נכשלה:", error);
  }
}

/**
 * ⚠️ העתק מכוון של `addToBatch` ב-`hotLeadAlert.ts`, בלי `recipientUserId`.
 * העדכון מותנה על `status = 'queued'` מאותה סיבה: ליד שנכנס בדיוק כשהמקבץ
 * נתבע לשליחה פותח מקבץ חדש ולא הולך לאיבוד.
 */
async function addToBatch(
  owner: string,
  toPhone: string,
  lead: { id: string; name: string; phone: string },
): Promise<void> {
  const open = await prisma.whatsAppMessage.findFirst({
    where: {
      dedupeKey: { startsWith: hotBatchKeyPrefix(owner) },
      toPhone,
      status: "queued",
    },
    orderBy: { scheduledFor: "desc" },
    select: { id: true, body: true },
  });

  if (open) {
    const { count } = await prisma.whatsAppMessage.updateMany({
      where: { id: open.id, status: "queued" },
      data: { body: hotBatchAppend(open.body, lead.name, lead.phone) },
    });
    if (count > 0) return;
  }

  const openedAt = Date.now();
  await prisma.whatsAppMessage.create({
    data: {
      dedupeKey: hotBatchDedupeKey(owner, openedAt),
      toPhone,
      body: hotBatchBody(lead.name, lead.phone),
      scheduledFor: new Date(openedAt + HOT_BATCH_WINDOW_MS),
    },
  });
}
