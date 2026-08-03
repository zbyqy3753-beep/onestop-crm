import { NextResponse } from "next/server";
import { botFromKey } from "@/server/auth/apiKeys";
import { report } from "@/server/whatsapp/outbox";

/**
 * דיווח תוצאות מהבוט: מה נשלח ומה נכשל.
 *
 * שורה שלא דווחה בכלל (הבוט קרס אחרי השליחה) לא הולכת לאיבוד —
 * היא משוחררת חזרה לתור אחרי 5 דקות ב-`reclaimAbandoned`. המחיר
 * במקרה הנדיר הזה הוא תזכורת כפולה לעובד, שעדיף על תזכורת חסרה.
 *
 * אימות זהה ל-`/pull`: `x-api-key` מול `WHATSAPP_API_KEYS`.
 */

const MAX_BODY_BYTES = 16_384;

interface Reported {
  id: string;
  status: "sent" | "failed";
  error?: string;
}

function parseResults(value: unknown): Reported[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): Reported[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const r = entry as Record<string, unknown>;
    if (typeof r.id !== "string") return [];
    if (r.status !== "sent" && r.status !== "failed") return [];
    return [
      {
        id: r.id,
        status: r.status,
        error: typeof r.error === "string" ? r.error : undefined,
      },
    ];
  });
}

export async function POST(request: Request) {
  const bot = botFromKey(request.headers.get("x-api-key"));
  if (!bot) {
    return NextResponse.json(
      { success: false, error: "מפתח לא מורשה" },
      { status: 401 },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "גוף הבקשה גדול מדי" },
      { status: 413 },
    );
  }

  let body: { results?: unknown };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON לא תקין" },
      { status: 400 },
    );
  }

  const results = parseResults(body.results);
  if (results.length === 0) {
    return NextResponse.json(
      { success: false, error: "אין תוצאות תקינות" },
      { status: 400 },
    );
  }

  const applied = await report(results);
  return NextResponse.json({ success: true, applied });
}
