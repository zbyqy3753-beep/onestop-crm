import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { writeMailerSettings } from "@/server/mailer/settings";

/**
 * עצירת כל הדיוור, לחיצה אחת.
 *
 * ⚠️ עצירה ולא ביטול: התור נשמר וממשיך להתנקז כשמפעילים מחדש.
 * דיוור שנמחק בטעות אינו ניתן לשחזור, ודיוור שנעצר — כן.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await requireRouteAccess("/mailer");
  const { paused } = (await request.json()) as { paused?: boolean };

  await writeMailerSettings(
    {
      paused: Boolean(paused),
      pausedReason: paused ? "נעצר מהמסך" : null,
      pausedAt: paused ? new Date() : null,
    },
    user.id,
  );

  return NextResponse.json({ success: true, paused: Boolean(paused) });
}
