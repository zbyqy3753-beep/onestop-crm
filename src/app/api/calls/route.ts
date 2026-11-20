import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { MAX_CHUNKS, callsAuthorized, callsUnauthorized } from "@/server/calls/auth";

/**
 * הצד של הטלפון בתור ההקלטות.
 *
 * POST — רישום הקלטה חדשה (בלי השמע). מחזיר את המזהה ואת החתיכות שכבר
 *        התקבלו, כך שהעלאה שנקטעה ממשיכה מאיפה שעצרה.
 * GET  — ההקלטות האחרונות עם הסיכום, להצגה באפליקציה.
 */

export async function POST(request: Request) {
  if (!callsAuthorized(request, "phone")) return callsUnauthorized();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim().slice(0, 300) : "";
  const chunkCount = Number(body?.chunkCount);
  const recordedAt = new Date(typeof body?.recordedAt === "string" ? body.recordedAt : NaN);
  const phone =
    typeof body?.phone === "string" && /^\+?\d{6,15}$/.test(body.phone) ? body.phone : null;
  const rawDuration = body?.durationSec;
  const durationSec =
    typeof rawDuration === "number" && Number.isInteger(rawDuration) && rawDuration >= 0
      ? rawDuration
      : null;

  if (
    !fileName ||
    !Number.isInteger(chunkCount) ||
    chunkCount < 1 ||
    chunkCount > MAX_CHUNKS ||
    Number.isNaN(recordedAt.getTime())
  ) {
    return NextResponse.json(
      { success: false, error: "נדרשים fileName, chunkCount ו-recordedAt תקינים" },
      { status: 400 },
    );
  }

  const recording = await prisma.callRecording.upsert({
    where: { fileName },
    // ⚠️ הקלטה קיימת לא משתנה: העלאה חוזרת רק משלימה חתיכות חסרות.
    update: {},
    create: { fileName, phone, recordedAt, durationSec, chunkCount },
    include: { chunks: { select: { index: true } } },
  });

  return NextResponse.json({
    success: true,
    id: recording.id,
    status: recording.status,
    received: recording.chunks.map((c) => c.index),
  });
}

export async function GET(request: Request) {
  if (!callsAuthorized(request, "phone")) return callsUnauthorized();

  const recordings = await prisma.callRecording.findMany({
    orderBy: { recordedAt: "desc" },
    take: 50,
    select: {
      id: true,
      fileName: true,
      phone: true,
      recordedAt: true,
      durationSec: true,
      status: true,
      analysis: true,
      error: true,
      handledAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    recordings: recordings.map((r) => ({
      ...r,
      recordedAt: r.recordedAt.toISOString(),
      handledAt: r.handledAt?.toISOString() ?? null,
    })),
  });
}
