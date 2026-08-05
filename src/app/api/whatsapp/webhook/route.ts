import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleInbound } from "@/server/renewals/campaign";
import { markDelivered, markUndeliverable } from "@/server/whatsapp/outbox";
import { drainOutbox } from "@/server/whatsapp/drain";

/**
 * ה-webhook של WhatsApp Cloud API.
 *
 * ⚠️⚠️ **זה מה שמחליף את הסקר של הבוט.** עד היום הבוט שאל את השרת כל
 * 20 שניות "מה חדש", וכל תשובה של לקוח המתינה למחזור הבא. כאן מטא
 * דוחפים אלינו את התשובה ברגע שהיא מגיעה — אין דיליי ואין תור פנימי.
 *
 * ⚠️ הנתיב תחת `/api` ולכן פטור משער העוגייה ב-`proxy.ts`, ו**חייב**
 * לאמת את עצמו. שני מנגנונים שונים לשני סוגי הבקשות:
 *
 *  • `GET` — אתגר האימות של מטא, מול `WHATSAPP_VERIFY_TOKEN` שאנחנו
 *    ממציאים ומזינים גם כאן וגם בלוח הבקרה שלהם.
 *  • `POST` — חתימת HMAC על גוף הבקשה, מול `WHATSAPP_APP_SECRET`.
 *    בלעדיה כל אחד באינטרנט יכול היה להמציא "הלקוח ענה מחר ב-8"
 *    וליצור לידים אצלנו.
 */

const MAX_BODY_BYTES = 512 * 1024;

/**
 * אימות הבעלות על הנתיב.
 *
 * מטא קוראים לזה פעם אחת בהגדרה, ומצפים להחזיר את `hub.challenge`
 * כטקסט נקי — לא JSON.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!expected) {
    return new NextResponse("webhook לא מוגדר", { status: 503 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new NextResponse("אימות נכשל", { status: 403 });
}

/**
 * האם החתימה על הגוף תואמת לסוד האפליקציה.
 *
 * ⚠️ `timingSafeEqual` ולא `===`. השוואת מחרוזות רגילה נעצרת בתו
 * הראשון שנבדל, וההפרש בזמן מאפשר לגלות את החתימה בייט אחר בייט.
 */
function signatureValid(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret || !header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");

  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface WebhookMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
}

interface WebhookStatus {
  id?: string;
  status?: string;
  errors?: { title?: string; message?: string }[];
}

interface WebhookPayload {
  entry?: {
    changes?: {
      value?: { messages?: WebhookMessage[]; statuses?: WebhookStatus[] };
    }[];
  }[];
}

/**
 * הטקסט מתוך הודעה נכנסת.
 *
 * ⚠️ לא רק `text.body`. לקוח שלוחץ על כפתור או בוחר מרשימה שולח
 * מבנה אחר לגמרי, ובלי הענפים האלה התשובה שלו נראית ריקה — בדיוק
 * הבאג שאכל לנו יום שלם בגרסת הבוט.
 */
function textOf(m: WebhookMessage): string {
  return (
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    ""
  );
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "גוף גדול מדי" }, { status: 413 });
  }

  if (!signatureValid(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "חתימה לא תקינה" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON לא תקין" }, { status: 400 });
  }

  const changes = (payload.entry ?? []).flatMap((e) => e.changes ?? []);

  for (const change of changes) {
    /*
     * ⚠️ כל כישלון נבלע בנפרד ולא מפיל את האצווה.
     *
     * מטא חוזרים על webhook שלא ענה 200, ומכיוון שהודעה אחת פגומה
     * הייתה מפילה את כולן — הן היו חוזרות שוב ושוב יחד איתה. מזהה
     * ההודעה ייחודי במסד, ולכן חזרה על הודעה שכן נקלטה היא no-op.
     */
    for (const m of change.value?.messages ?? []) {
      const id = m.id;
      const from = m.from;
      if (!id || !from) continue;

      const body = textOf(m);
      const ts = Number(m.timestamp);

      try {
        await handleInbound({
          waMessageId: id,
          fromPhone: from.replace(/\D/g, ""),
          body,
          receivedAt: new Date(
            Number.isFinite(ts) && ts > 0 ? ts * 1000 : Date.now(),
          ),
        });
      } catch {
        // נרשם, לא מטופל — נמשיך להודעה הבאה
      }
    }

    /*
     * עדכוני מסירה.
     *
     * ⚠️ זה מה שהופך "נשלח" למשמעותי, והפעם בלי שום ניחוש: מטא
     * אומרים במפורש `sent` / `delivered` / `read` / `failed`. בגרסת
     * הבוט נאלצנו להסיק את זה מאישורי סוקט, וזה בדיוק המקום שבו
     * הכריזו "נשלח" על הודעה שאיש לא קיבל.
     */
    for (const s of change.value?.statuses ?? []) {
      if (!s.id) continue;

      if (s.status === "failed") {
        const why =
          s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "מטא דחו את ההודעה";
        try {
          await markUndeliverable(s.id, why);
        } catch {
          // אין מה לעשות מכאן; העדכון יגיע שוב או שהשורה תסונן בסקר
        }
      } else if (s.status === "delivered" || s.status === "read") {
        try {
          await markDelivered(s.id);
        } catch {
          // כנ"ל
        }
      }
    }
  }

  /*
   * ⚠️ ניקוז התור **באותה בקשה** — זה מה שמחליף את הסקר.
   *
   * תשובה של לקוח מייצרת הודעת אישור, וללא השורה הזו היא הייתה
   * ממתינה למחזור הבא. בגרסת הבוט זה היה עד דקה, וזו בדיוק התלונה
   * שהובילה לכל המעבר הזה. כאן האישור יוצא תוך שברירי שנייה.
   *
   * כישלון בניקוז לא הופך את ה-webhook לכושל: ההודעה הנכנסת כבר
   * נשמרה, והתור ינוקז בהזדמנות הבאה.
   */
  try {
    await drainOutbox(new URL(request.url).origin);
  } catch {
    // התור יחכה לניקוז הבא
  }

  // ⚠️ תמיד 200 אחרי שהחתימה אומתה. כל דבר אחר גורם למטא לחזור על
  // אותה אצווה, וחזרה על אצווה שכבר טופלה היא עבודה כפולה מיותרת.
  return NextResponse.json({ received: true });
}
