import { NextResponse } from "next/server";
import { botFromKey } from "@/server/auth/apiKeys";
import { handleInbound } from "@/server/renewals/campaign";

/**
 * קליטת הודעות נכנסות מהבוט.
 *
 * ⚠️ זו נקודת הקצה היחידה במערכת שמקבלת טקסט חופשי שנכתב ע"י אדם
 * חיצוני ומריצה עליו לוגיקה שמייצרת רשומות. שלוש הגנות:
 *
 *  1. `x-api-key` — אותו מנגנון של שאר נקודות הקצה של הבוט.
 *  2. תקרת גוף — הודעת וואטסאפ ארוכה במיוחד לא תפיל את התהליך.
 *  3. הגוף נחתך ל-2000 תווים לפני שמירה (ב-`handleInbound`).
 *
 * ⚠️ **אין כאן אימות שהשולח הוא באמת מי שהוא טוען.** מספר וואטסאפ
 * ניתן לזיוף בתיאוריה, וכל מה שהוא יכול להשיג כאן הוא לקבוע שעה
 * לליד קיים או להסיר את עצמו מדיוור. שני אלה הפיכים ולא מסוכנים —
 * וזו הסיבה שהזרימה עוצרת ביצירת ליד ולא נוגעת בכסף או בהרשאות.
 */

const MAX_BODY_BYTES = 16 * 1024;

interface InboundPayload {
  messages?: {
    id?: unknown;
    fromPhone?: unknown;
    body?: unknown;
    timestamp?: unknown;
  }[];
}

export async function POST(req: Request) {
  const bot = botFromKey(req.headers.get("x-api-key"));
  if (!bot) {
    return NextResponse.json({ error: "מפתח לא תקין" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "הגוף גדול מדי" }, { status: 413 });
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(raw) as InboundPayload;
  } catch {
    return NextResponse.json({ error: "JSON לא תקין" }, { status: 400 });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) return NextResponse.json({ handled: 0 });

  const results: { id: string; intent: string; matched: boolean }[] = [];

  for (const m of messages.slice(0, 50)) {
    const id = typeof m.id === "string" ? m.id : null;
    const fromPhone = typeof m.fromPhone === "string" ? m.fromPhone : null;
    const body = typeof m.body === "string" ? m.body : "";
    if (!id || !fromPhone) continue;

    const ts = typeof m.timestamp === "number" ? m.timestamp : Date.now();

    try {
      const outcome = await handleInbound({
        waMessageId: id,
        fromPhone: fromPhone.replace(/\D/g, ""),
        body,
        receivedAt: new Date(ts),
      });
      results.push({ id, intent: outcome.intent, matched: outcome.matched });
    } catch {
      // הודעה בודדת שנכשלה לא צריכה להפיל את כל האצווה — הבוט
      // ידווח אותה שוב בסקר הבא, וה-waMessageId הייחודי ימנע כפילות
    }
  }

  return NextResponse.json({ handled: results.length, results });
}
