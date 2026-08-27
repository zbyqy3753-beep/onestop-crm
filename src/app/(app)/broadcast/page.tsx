import { requireRouteAccess } from "@/server/auth/session";
import { cloudApiConfigured } from "@/server/whatsapp/cloudApi";
import { broadcastOverview } from "@/server/whatsapp/broadcast";
import { BroadcastClient } from "@/components/broadcast/BroadcastClient";

/**
 * מסך הדיוור בוואטסאפ.
 *
 * ⚠️ מצב ההגדרה נבדק בשרת ומועבר למטה, כמו במסך הדיוור במייל: בלי
 * זה המשתמש מדביק 300 מספרים, כותב הודעה, לוחץ שלח — ומגלה רק אז
 * שאין דרך לשלוח.
 */
export default async function BroadcastPage() {
  await requireRouteAccess("/broadcast");

  const overview = await broadcastOverview();

  return (
    <BroadcastClient configured={cloudApiConfigured()} overview={overview} />
  );
}
