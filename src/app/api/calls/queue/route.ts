import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { callsAuthorized, callsUnauthorized } from "@/server/calls/auth";

/** ההקלטות שהועלו במלואן ומחכות לתמלול, מהישנה לחדשה. הצד של המחשב. */
export async function GET(request: Request) {
  if (!callsAuthorized(request, "worker")) return callsUnauthorized();

  const recordings = await prisma.callRecording.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      phone: true,
      recordedAt: true,
      durationSec: true,
      chunkCount: true,
    },
  });

  return NextResponse.json({
    success: true,
    recordings: recordings.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() })),
  });
}
