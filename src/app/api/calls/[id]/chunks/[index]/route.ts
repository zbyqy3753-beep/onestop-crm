import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import {
  MAX_CHUNK_BYTES,
  callsAuthorized,
  callsUnauthorized,
} from "@/server/calls/auth";

/**
 * חתיכת שמע אחת של הקלטה.
 *
 * PUT — הטלפון מעלה את החתיכה כגוף בינארי. כשכל החתיכות הגיעו, ההקלטה
 *       עוברת ל-`pending` ונכנסת לתור של המחשב.
 * GET — המחשב מוריד את החתיכה. בנפרד ולא כקובץ אחד, כי גם תשובה ב-Vercel
 *       מוגבלת ל-4.5MB.
 */

type Ctx = { params: Promise<{ id: string; index: string }> };

async function parse(ctx: Ctx) {
  const { id, index } = await ctx.params;
  const i = Number(index);
  return { id, index: Number.isInteger(i) && i >= 0 ? i : -1 };
}

export async function PUT(request: Request, ctx: Ctx) {
  if (!callsAuthorized(request, "phone")) return callsUnauthorized();
  const { id, index } = await parse(ctx);

  const recording = await prisma.callRecording.findUnique({ where: { id } });
  if (!recording || index < 0 || index >= recording.chunkCount) {
    return NextResponse.json({ success: false, error: "הקלטה או חתיכה לא קיימת" }, { status: 404 });
  }
  if (recording.status !== "uploading") {
    return NextResponse.json({ success: true, status: recording.status });
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_CHUNK_BYTES) {
    return NextResponse.json({ success: false, error: "גודל חתיכה לא תקין" }, { status: 413 });
  }

  await prisma.callAudioChunk.upsert({
    where: { recordingId_index: { recordingId: id, index } },
    update: { data },
    create: { recordingId: id, index, data },
  });

  const have = await prisma.callAudioChunk.count({ where: { recordingId: id } });
  let status: string = recording.status;
  if (have >= recording.chunkCount) {
    await prisma.callRecording.updateMany({
      where: { id, status: "uploading" },
      data: { status: "pending" },
    });
    status = "pending";
  }

  return NextResponse.json({ success: true, status });
}

export async function GET(request: Request, ctx: Ctx) {
  if (!callsAuthorized(request, "worker")) return callsUnauthorized();
  const { id, index } = await parse(ctx);

  const chunk = await prisma.callAudioChunk.findUnique({
    where: { recordingId_index: { recordingId: id, index } },
  });
  if (!chunk) {
    return NextResponse.json({ success: false, error: "חתיכה לא קיימת" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(chunk.data), {
    headers: { "content-type": "application/octet-stream", "cache-control": "no-store" },
  });
}
