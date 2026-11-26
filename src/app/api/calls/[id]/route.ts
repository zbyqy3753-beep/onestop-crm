import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { callsAuthorized, callsUnauthorized } from "@/server/calls/auth";
import { queueCoachWhatsApp } from "@/server/calls/whatsapp";
import { drainOutbox } from "@/server/whatsapp/drain";

/**
 * המחשב מחזיר תוצאה להקלטה: `done` עם תמליל וניתוח, או `failed` עם סיבה.
 *
 * ⚠️ השמע נמחק כאן בכל מקרה. גם הקלטה שנכשלה לא נשמרת: עדיף שאלירן
 * יראה "נכשל" מאשר ששיחה של לקוח תשב במסד בלי סוף.
 */

type Ctx = { params: Promise<{ id: string }> };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

export async function PATCH(request: Request, ctx: Ctx) {
  if (!callsAuthorized(request, "worker")) return callsUnauthorized();
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status;
  if (status !== "done" && status !== "failed") {
    return NextResponse.json(
      { success: false, error: "נדרש status: done או failed" },
      { status: 400 },
    );
  }

  const updated = await prisma.callRecording.updateMany({
    where: { id, status: "pending" },
    data: {
      status,
      transcript: text(body?.transcript, 200_000),
      analysis: text(body?.analysis, 20_000),
      error: text(body?.error, 1000),
      handledAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { success: false, error: "ההקלטה לא נמצאה או שכבר טופלה" },
      { status: 404 },
    );
  }

  await prisma.callAudioChunk.deleteMany({ where: { recordingId: id } });

  // ⚠️ כישלון בוואטסאפ לא מכשיל את ההחזרה: הניתוח כבר נשמר ומוצג באפליקציה
  if (status === "done") {
    try {
      if ((await queueCoachWhatsApp()) > 0) await drainOutbox(new URL(request.url).origin);
    } catch {
      // ייצא בניקוז הבא, או כשאלירן יכתוב
    }
  }
  return NextResponse.json({ success: true });
}
