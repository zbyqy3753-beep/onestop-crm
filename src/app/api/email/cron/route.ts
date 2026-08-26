import { NextResponse } from "next/server";
import { drainMailOutbox } from "@/server/mailer/drain";

/**
 * ניקוז ידני של תור הדיוור.
 *
 * ⚠️ **זה אינו השעון.** השעון האמיתי הוא `pg_cron` שדופק את
 * `/api/whatsapp/cron` כל שתי דקות, והניקוז הזה נתלה עליו שם.
 * מתזמן שני היה מעיר את הפונקציה בנפרד ושורף ממכסת
 * `Fluid Active CPU` של חשבון Hobby — ארבע שעות לחודש בסך הכול.
 *
 * הנתיב קיים כדי שאפשר יהיה לדחוף ניקוז ידנית כשבודקים, ומאומת
 * באותו `CRON_SECRET`.
 */

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json(
      { success: false, error: "אימות נכשל" },
      { status: 401 },
    );
  }

  const result = await drainMailOutbox(new URL(request.url).origin);
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
