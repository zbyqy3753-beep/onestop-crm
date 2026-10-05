import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

/**
 * תור בקשות הפוסט, בצד של המשימה המתוזמנת של Claude.
 *
 * GET   — הבקשות שממתינות, מהישנה לחדשה.
 * PATCH — סימון בקשה כטופלה (`done`) או כנכשלה (`failed`), עם קישור או הסבר.
 *
 * ⚠️ `/api` פתוח ב-proxy, ולכן האימות כאן. אותו `CRON_SECRET` כמו
 * שאר נקודות הקצה של המכונה: סוד אחד לסובב, לא שניים.
 */

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const unauthorized = () =>
  NextResponse.json({ success: false, error: "אימות נכשל" }, { status: 401 });

export async function GET(request: Request) {
  if (!authorized(request)) return unauthorized();

  const requests = await prisma.postRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json({
    success: true,
    requests: requests.map((r) => ({
      id: r.id,
      topic: r.topic,
      notes: r.notes,
      by: r.createdBy?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    resultUrl?: unknown;
    resultNote?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status;
  if (!id || (status !== "done" && status !== "failed")) {
    return NextResponse.json(
      { success: false, error: "נדרשים id ו-status (done או failed)" },
      { status: 400 },
    );
  }

  const resultUrl =
    typeof body?.resultUrl === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(body.resultUrl)
      ? body.resultUrl
      : null;
  const resultNote = typeof body?.resultNote === "string" ? body.resultNote.slice(0, 1000) : null;

  // רק בקשה שעדיין ממתינה: ריצה כפולה של המשימה לא תדרוס תוצאה קיימת
  const updated = await prisma.postRequest.updateMany({
    where: { id, status: "pending" },
    data: { status, resultUrl, resultNote, handledAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { success: false, error: "הבקשה לא נמצאה או שכבר טופלה" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
