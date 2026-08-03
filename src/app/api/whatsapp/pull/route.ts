import { NextResponse } from "next/server";
import { botFromKey } from "@/server/auth/apiKeys";
import { pull } from "@/server/whatsapp/outbox";
import { prisma } from "@/server/db/client";

/**
 * הסקר של בוט הוואטסאפ: "מה יש לשלוח עכשיו?".
 *
 * הבוט הוא השעון היחיד במערכת — אין cron. כל קריאה כאן ממלאת את
 * התור, מנקה שורות שכבר לא רלוונטיות, ומחזירה מה בשל לשליחה.
 *
 * ⚠️ הנתיב תחת `/api` ולכן פטור משער העוגייה ב-`proxy.ts` (ראה
 * `PUBLIC_PREFIXES` שם) — כלומר הוא **חייב** לאמת את עצמו. האימות הוא
 * `x-api-key` מול `WHATSAPP_API_KEYS`, רישום נפרד מזה של הלידים.
 *
 * אין CORS בכוונה: זו תקשורת שרת-לשרת בלבד.
 */

const MAX_BODY_BYTES = 4_096;
const DEFAULT_LIMIT = 5;

/** תקרת קצב גסה — הבוט אמור לסקור כל 60 שניות, לא כל שנייה. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 30;
const hits: number[] = [];

function overRateLimit(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0] > RATE_WINDOW_MS) hits.shift();
  hits.push(now);
  return hits.length > RATE_MAX_PER_WINDOW;
}

/** כתובת המערכת לקישור בתוך ההודעה. */
function appUrl(request: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return `${configured.replace(/\/$/, "")}/leads`;
  return new URL("/leads", request.url).toString();
}

export async function POST(request: Request) {
  const bot = botFromKey(request.headers.get("x-api-key"));
  if (!bot) {
    return NextResponse.json(
      { success: false, error: "מפתח לא מורשה" },
      { status: 401 },
    );
  }

  if (overRateLimit()) {
    return NextResponse.json(
      { success: false, error: "יותר מדי בקשות" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "גוף הבקשה גדול מדי" },
      { status: 413 },
    );
  }

  let body: {
    instanceId?: unknown;
    waConnected?: unknown;
    waNumber?: unknown;
    limit?: unknown;
  };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON לא תקין" },
      { status: 400 },
    );
  }

  const result = await pull({
    instanceId:
      typeof body.instanceId === "string" ? body.instanceId : undefined,
    waConnected: body.waConnected === true,
    waNumber: typeof body.waNumber === "string" ? body.waNumber : undefined,
    limit:
      typeof body.limit === "number" && body.limit > 0
        ? body.limit
        : DEFAULT_LIMIT,
    appUrl: appUrl(request),
  });

  return NextResponse.json({ success: true, ...result });
}

/** בדיקת חיים ומפתח, בדפוס של `GET /api/leads`. */
export async function GET(request: Request) {
  const bot = botFromKey(request.headers.get("x-api-key"));
  if (!bot) {
    return NextResponse.json(
      { success: false, error: "מפתח לא מורשה" },
      { status: 401 },
    );
  }

  const [queued, heartbeat] = await Promise.all([
    prisma.whatsAppMessage.count({ where: { status: "queued" } }),
    prisma.botHeartbeat.findUnique({ where: { id: "default" } }),
  ]);

  return NextResponse.json({
    success: true,
    bot: bot.name,
    queued,
    lastSeenAt: heartbeat?.lastSeenAt ?? null,
  });
}
