import { notFound } from "next/navigation";
import { requireSessionUser } from "@/server/auth/session";
import { botOverview } from "@/server/whatsapp/overview";
import { BotsClient } from "@/components/bots/BotsClient";

/**
 * מסך הבוטים — הכול על בוט הוואטסאפ במקום אחד.
 *
 * הופרד מ-`/admin` כי הוא גדל מעבר לרצועה: הגדרות, תור, היסטוריה,
 * כשלים ורשימת נמענים. מסך ניהול המערכת נשאר על מה שהוא — משתמשים —
 * ומציג רק את הרצועה עם קישור לכאן.
 */
const ALLOWED = ["owner", "manager"] as const;

export default async function BotsPage() {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) notFound();

  const overview = await botOverview();

  return <BotsClient overview={overview} />;
}
