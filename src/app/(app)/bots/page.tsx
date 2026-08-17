import { requireRouteAccess } from "@/server/auth/session";
import { botOverview } from "@/server/whatsapp/overview";
import { BotsClient } from "@/components/bots/BotsClient";

/**
 * מסך הבוטים — הכול על בוט הוואטסאפ במקום אחד.
 *
 * הופרד מ-`/admin` כי הוא גדל מעבר לרצועה: הגדרות, תור, היסטוריה,
 * כשלים ורשימת נמענים. מסך ניהול המערכת נשאר על מה שהוא — משתמשים —
 * ומציג רק את הרצועה עם קישור לכאן.
 */
export default async function BotsPage() {
  await requireRouteAccess("/bots");

  const overview = await botOverview();

  return <BotsClient overview={overview} />;
}
