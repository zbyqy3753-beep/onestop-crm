import "server-only";

import { renderMail } from "@/lib/domain/mailTemplate";
import { signUnsubscribe } from "@/lib/unsubscribeToken";
import { prisma } from "@/server/db/client";
import { mailerConfigured, sendMail } from "./provider";
import { claimMail, readMailerSettings, reportMail } from "./outbox";

/**
 * ניקוז תור הדיוור.
 *
 * ⚠️ **קישור ההסרה נחתם כאן ולא בהכנסה לתור.** הוא נגזר מהכתובת
 * ומהסוד בלבד ולכן יוצא זהה בכל מקרה — אבל שמירתו בשורה הייתה
 * מקפיאה גם את שם המארח, ודיוור שנשלח לפני מעבר דומיין היה מפנה
 * לכתובת שכבר לא עונה.
 */

export interface MailDrainResult {
  sent: number;
  failed: number;
  skipped: "notConfigured" | "paused" | null;
}

function unsubscribeLinks(
  origin: string,
  email: string,
  secret: string,
): { page: string; oneClick: string } {
  const token = signUnsubscribe(email, secret);
  return {
    page: `${origin}/unsubscribe/${token}`,
    /*
     * ⚠️ הטוקן ב-query ולא בנתיב: `List-Unsubscribe-Post` מחייב
     * כתובת שמקבלת POST, ונתיב דינמי היה מייצר גם דף GET באותה
     * כתובת — שני דברים שונים תחת URL אחד.
     */
    oneClick: `${origin}/api/email/unsubscribe?t=${encodeURIComponent(token)}`,
  };
}

export async function drainMailOutbox(
  origin: string,
): Promise<MailDrainResult> {
  if (!mailerConfigured()) {
    return { sent: 0, failed: 0, skipped: "notConfigured" };
  }

  const secret = process.env.MAILER_SECRET?.trim();
  if (!secret) {
    // ⚠️ בלי הסוד אין קישור הסרה, ובלי קישור הסרה אסור לשלוח —
    // זו חובה חוקית ולא תוספת. עצירה שקטה עדיפה על דיוור אסור.
    return { sent: 0, failed: 0, skipped: "notConfigured" };
  }

  const settings = await readMailerSettings();
  if (settings.paused) return { sent: 0, failed: 0, skipped: "paused" };

  const claimed = await claimMail(settings);

  let sent = 0;
  let failed = 0;

  for (const msg of claimed) {
    /*
     * ⚠️ **בדיקת ההסרה שוב, ברגע השליחה.** היא כבר נעשתה בהעלאה,
     * אבל בין ההעלאה לשליחה עוברות שעות: מי שלחץ "הסר" אחרי המייל
     * הראשון של הדיוור לא אמור לקבל את השאר.
     */
    const optedOut = await prisma.emailOptOut.findUnique({
      where: { email: msg.toEmail },
      select: { email: true },
    });
    if (optedOut) {
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: { status: "cancelled", claimedAt: null },
      });
      continue;
    }

    try {
      const links = unsubscribeLinks(origin, msg.toEmail, secret);

      const { html, text } = renderMail({
        subject: msg.subject,
        body: msg.body,
        unsubscribeUrl: links.page,
      });

      await sendMail({
        to: msg.toEmail,
        subject: msg.subject,
        html,
        text,
        unsubscribeUrl: links.oneClick,
      });

      await reportMail(msg.id, null);
      sent++;
    } catch (error) {
      await reportMail(
        msg.id,
        error instanceof Error ? error.message : String(error),
      );
      failed++;
    }
  }

  return { sent, failed, skipped: null };
}
