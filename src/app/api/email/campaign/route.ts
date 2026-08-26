import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { enqueueCampaign, type RecipientInput } from "@/server/mailer/outbox";
import { mailerConfigured } from "@/server/mailer/provider";

/** תקרת נמענים לבקשה — מגן על גוף בקשה שמנפח את הפונקציה. */
const MAX_RECIPIENTS = 5_000;

export async function POST(request: Request): Promise<Response> {
  const user = await requireRouteAccess("/mailer");

  if (!mailerConfigured() || !process.env.MAILER_SECRET?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "השליחה אינה מוגדרת — חסרים GMAIL_USER, GMAIL_APP_PASSWORD או MAILER_SECRET",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
    recipients?: RecipientInput[];
  };

  const name = body.name?.trim();
  const subjectTemplate = body.subjectTemplate?.trim();
  const bodyTemplate = body.bodyTemplate?.trim();
  const recipients = body.recipients ?? [];

  if (!name || !subjectTemplate || !bodyTemplate) {
    return NextResponse.json(
      { success: false, error: "שם הדיוור, הנושא והתוכן הם שדות חובה" },
      { status: 400 },
    );
  }
  if (recipients.length === 0) {
    return NextResponse.json(
      { success: false, error: "אין נמענים" },
      { status: 400 },
    );
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { success: false, error: `יותר מ-${MAX_RECIPIENTS} נמענים בבקשה אחת` },
      { status: 400 },
    );
  }

  const result = await enqueueCampaign({
    name,
    subjectTemplate,
    bodyTemplate,
    createdById: user.id,
    recipients,
  });

  return NextResponse.json({ success: true, ...result });
}
