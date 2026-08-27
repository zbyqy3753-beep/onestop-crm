import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { campaignRecipients } from "@/server/mailer/overview";

/**
 * רשימת הנמענים של דיוור אחד, למסך.
 *
 * ⚠️ נטען לפי דרישה ולא יחד עם המסך: רוב הפעמים שנכנסים ל-`/mailer`
 * זה כדי לשלוח, לא כדי לחקור מי קיבל. משיכת כל הנמענים של עשרים
 * הדיוורים האחרונים בכל טעינה היא עבודה שברובה לא נקראת.
 */
export async function GET(request: Request): Promise<Response> {
  await requireRouteAccess("/mailer");

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: "חסר מזהה דיוור" },
      { status: 400 },
    );
  }

  const recipients = await campaignRecipients(
    campaignId,
    url.searchParams.get("q") ?? undefined,
  );

  return NextResponse.json({ success: true, recipients });
}
