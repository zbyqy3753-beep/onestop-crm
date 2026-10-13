import "server-only";

import { prisma } from "@/server/db/client";

/**
 * ── חלון השירות של 24 שעות ────────────────────────────────────────────
 *
 * מי שכתב למספר העסקי ב-24 השעות האחרונות פתח "חלון שירות": בתוכו
 * מותר לשלוח לו טקסט חופשי בלי תבנית. הודעה כזו **חינם** ו**לא
 * כפופה למגבלת ההודעות השיווקיות לנמען** — שהיא מה שמפיל כשליש
 * מהתראות הלידים החמים (`lead_hot_batch_he` מסווגת MARKETING).
 *
 * ⚠️ 23 שעות ולא 24: ההודעה עוד עשויה לחכות בתור, ושליחת טקסט חופשי
 * אחרי שהחלון נסגר נדחית ב-131047 — כלומר ההתראה הולכת לאיבוד במקום
 * לצאת כתבנית. שעה של מרווח עדיפה על ההימור.
 */
const WINDOW_MS = 23 * 60 * 60 * 1000;

/** האם הנמען כתב לנו מספיק לאחרונה כדי שמותר לשלוח לו טקסט חופשי. */
export async function hasOpenServiceWindow(toPhone: string): Promise<boolean> {
  // `WhatsAppInbound.fromPhone` נשמר כספרות בלבד (972…), כמו שמטא שולחת
  const digits = toPhone.replace(/\D/g, "");
  if (!digits) return false;

  const recent = await prisma.whatsAppInbound.findFirst({
    where: {
      fromPhone: digits,
      receivedAt: { gt: new Date(Date.now() - WINDOW_MS) },
    },
    select: { id: true },
  });
  return recent !== null;
}
