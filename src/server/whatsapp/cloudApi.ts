import "server-only";

/**
 * שליחה דרך WhatsApp Cloud API של מטא.
 *
 * ⚠️⚠️ **מחליף את הבוט הלא רשמי, לא מתווסף אליו.** הבוט שרץ על מחשב
 * במשרד נשען על סשן שאפשר לפסול, על כתובות `@lid` שהשתנו מתחת לרגליים,
 * ועל תהליך שצריך לשרוד ריסטארט. כל אלה לא קיימים כאן: אין סשן, אין
 * מחשב, ואין מה להתנתק.
 *
 * ⚠️ **הבדל מוצרי שאי אפשר לעקוף:** הודעה שאנחנו יוזמים חייבת להיות
 * **תבנית מאושרת** מראש על ידי מטא. טקסט חופשי מותר **רק** בתוך 24
 * שעות מרגע שהלקוח כתב לנו. לכן:
 *
 *   הודעת פתיחה ללקוח   →  תבנית (בתשלום)
 *   כל תשובה אחרי שהוא ענה  →  טקסט חופשי (חינם)
 *
 * ניסיון לשלוח טקסט חופשי מחוץ לחלון נדחה בשגיאה 131047, ולא נכשל
 * בשקט — וזה טוב: עדיף כישלון גלוי מאשר הודעה שלא הגיעה.
 */

/**
 * ⚠️ גרסה נעוצה ולא `latest`. מטא משנים התנהגות בין גרסאות, ושדרוג
 * שקורה מעצמו הוא בדיוק סוג התקלה שקשה לאתר אחר כך.
 */
const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** האם יש מספיק תצורה כדי לשלוח בכלל. */
export function cloudApiConfigured(): boolean {
  return Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID"));
}

/** המספר שממנו שולחים, לתצוגה במסך הבוטים. */
export function cloudApiSenderId(): string | undefined {
  return env("WHATSAPP_PHONE_NUMBER_ID");
}

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

interface SendResponse {
  messages?: { id?: string }[];
}

/**
 * קריאה ל-Graph API.
 *
 * ⚠️ שגיאות מטא חוזרות ב-200 לפעמים וב-4xx לפעמים, ותמיד עם גוף
 * שמסביר. הודעת השגיאה שלהם היא מה שיופיע במסך הבוטים, ולכן היא
 * מועברת כמו שהיא ולא מוחלפת ב"שליחה נכשלה".
 */
async function graph<T>(path: string, body: unknown): Promise<T> {
  const token = env("WHATSAPP_TOKEN");
  if (!token) throw new Error("חסר WHATSAPP_TOKEN");

  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`תשובה לא תקינה ממטא (${res.status})`);
  }

  const err = (parsed as GraphError).error;
  if (err) {
    const code = err.error_subcode ?? err.code;
    throw new Error(`${err.message ?? "שגיאה ממטא"}${code ? ` (${code})` : ""}`);
  }
  if (!res.ok) throw new Error(`מטא החזירו ${res.status}`);

  return parsed as T;
}

/**
 * מספר בפורמט שמטא מצפים לו.
 *
 * ⚠️ בלי הפלוס ובלי מפרידים. אצלנו הוא כבר שמור כך (`toPhone` ב-
 * `WhatsAppMessage`), אבל הניקוי כאן זול ומונע תלות בשומר אחר.
 */
const toWaPhone = (raw: string) => raw.replace(/\D/g, "");

/**
 * טקסט חופשי — **רק בתוך חלון 24 השעות**.
 *
 * מחזיר את מזהה ההודעה אצל מטא, שישמש לקישור עדכוני סטטוס מה-webhook.
 */
export async function sendText(toPhone: string, body: string): Promise<string> {
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneId) throw new Error("חסר WHATSAPP_PHONE_NUMBER_ID");

  const res = await graph<SendResponse>(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWaPhone(toPhone),
    type: "text",
    // ⚠️ בלי תצוגה מקדימה של קישורים — היא מוסיפה עיבוד ולפעמים
    // מציגה תמונה שלא התכוונו אליה
    text: { preview_url: false, body },
  });

  const id = res.messages?.[0]?.id;
  if (!id) throw new Error("מטא לא החזירו מזהה הודעה");
  return id;
}

/**
 * תבנית מאושרת — הדרך היחידה ליזום שיחה עם לקוח.
 *
 * `params` ממלאים את `{{1}}`, `{{2}}` … בגוף התבנית, **לפי הסדר**.
 * מטא דוחים קריאה שבה מספר הפרמטרים לא תואם למה שאושר, וזו בדיקה
 * שקורית רק בזמן ריצה — ולכן שם התבנית והפרמטרים חיים במקום אחד
 * (`renewalMessages.ts`) ולא מפוזרים בקוד.
 */
export async function sendTemplate(
  toPhone: string,
  name: string,
  language: string,
  params: string[],
): Promise<string> {
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneId) throw new Error("חסר WHATSAPP_PHONE_NUMBER_ID");

  const res = await graph<SendResponse>(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWaPhone(toPhone),
    type: "template",
    template: {
      name,
      language: { code: language },
      components: params.length
        ? [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ]
        : [],
    },
  });

  const id = res.messages?.[0]?.id;
  if (!id) throw new Error("מטא לא החזירו מזהה הודעה");
  return id;
}
