import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { enqueueBroadcast } from "@/server/whatsapp/broadcast";
import { cloudApiConfigured } from "@/server/whatsapp/cloudApi";
import { BROADCAST_MAX_CHARS, parsePhoneList } from "@/lib/domain/broadcast";

/**
 * יצירת דיוור וואטסאפ מהמסך.
 *
 * ⚠️ המספרים מפוענחים **שוב** בשרת ולא נלקחים כמו שהם מהדפדפן:
 * הלקוח כבר פיענח אותם כדי להציג ספירה, אבל בקשה אפשר לזייף, ומספר
 * שלא עבר נרמול הופך להודעה שנשלחת לאיש הלא נכון.
 */

/** תקרת מספרים לבקשה — מגן על גוף בקשה שמנפח את הפונקציה. */
const MAX_RECIPIENTS = 5_000;

export async function POST(request: Request): Promise<Response> {
  const user = await requireRouteAccess("/broadcast");

  if (!cloudApiConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "השליחה אינה מוגדרת — חסרים WHATSAPP_TOKEN או WHATSAPP_PHONE_NUMBER_ID",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    message?: string;
    phones?: string;
  };

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json(
      { success: false, error: "ההודעה ריקה" },
      { status: 400 },
    );
  }
  if (message.length > BROADCAST_MAX_CHARS) {
    return NextResponse.json(
      {
        success: false,
        error: `ההודעה ארוכה מ-${BROADCAST_MAX_CHARS} תווים`,
      },
      { status: 400 },
    );
  }

  const parsed = parsePhoneList(body.phones ?? "");
  if (parsed.valid.length === 0) {
    return NextResponse.json(
      { success: false, error: "אין מספרים תקינים ברשימה" },
      { status: 400 },
    );
  }
  if (parsed.valid.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { success: false, error: `יותר מ-${MAX_RECIPIENTS} מספרים בבקשה אחת` },
      { status: 400 },
    );
  }

  const result = await enqueueBroadcast({
    // ⚠️ נופל לתחילת ההודעה כשלא הוקלד שם. השם הוא תווית פנימית
    // לרשימה ואין סיבה שהוא יחסום שליחה.
    name: body.name?.trim() || message.slice(0, 40),
    message,
    createdById: user.id,
    phones: parsed.valid,
  });

  return NextResponse.json({
    success: true,
    ...result,
    invalid: parsed.invalid.length,
    duplicates: parsed.duplicates,
  });
}
