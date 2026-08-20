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
  options: { otpButton?: boolean } = {},
): Promise<string> {
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneId) throw new Error("חסר WHATSAPP_PHONE_NUMBER_ID");

  const components: unknown[] = params.length
    ? [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ]
    : [];

  /*
   * ⚠️ תבנית אימות דורשת את הקוד **פעמיים** — גם בגוף וגם בכפתור.
   *
   * כפתור העתקת הקוד אינו טקסט אלא כתובת שמטא בונה
   * (`.../otp/code/?...&code=otp{{1}}`), ויש לה משתנה משלה. שליחה עם
   * פרמטר לגוף בלבד נדחית ב-132000 — "מספר הפרמטרים אינו תואם" —
   * וזה נראה כמו תקלת תוכן בזמן שהבעיה היא רכיב חסר.
   */
  if (options.otpButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: params[0] }],
    });
  }

  const res = await graph<SendResponse>(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWaPhone(toPhone),
    type: "template",
    template: {
      name,
      language: { code: language },
      components,
    },
  });

  const id = res.messages?.[0]?.id;
  if (!id) throw new Error("מטא לא החזירו מזהה הודעה");
  return id;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

/**
 * רשימה אינטראקטיבית — **רק בתוך חלון 24 השעות**.
 *
 * ⚠️⚠️ **אי אפשר לשלוח רשימה כתבנית.** מטא מתירים ברשימה יזומה רק
 * תבנית מאושרת, ולתבנית מותרים לחצנים אבל לא רשימה. זו הסיבה
 * שהזרימה מפוצלת: הפתיחה היא תבנית עם לחצן "לתאם שעה", והרשימה
 * יוצאת רק אחרי שהלקוח לחץ — כלומר אחרי שהוא כתב אלינו והחלון נפתח.
 * ניסיון לקצר את הדרך נדחה ב-131047.
 *
 * ⚠️ מטא מגבילים: 10 שורות בסך הכול, כותרת שורה עד 24 תווים, תיאור
 * עד 72, וטקסט הכפתור עד 20. חריגה נדחית בשגיאת ולידציה ולא נחתכת
 * בשקט — ולכן החיתוך נעשה כאן, ליד המגבלה שהוא מכבד.
 */
export async function sendList(
  toPhone: string,
  list: {
    header: string;
    body: string;
    footer?: string;
    action: string;
    sections: ListSection[];
  },
): Promise<string> {
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneId) throw new Error("חסר WHATSAPP_PHONE_NUMBER_ID");

  const rows = list.sections.reduce((n, s) => n + s.rows.length, 0);
  if (rows === 0) throw new Error("רשימה בלי שורות");
  if (rows > 10) throw new Error(`רשימה עם ${rows} שורות — מטא מתירים 10`);

  const res = await graph<SendResponse>(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWaPhone(toPhone),
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: list.header.slice(0, 60) },
      body: { text: list.body.slice(0, 1024) },
      ...(list.footer ? { footer: { text: list.footer.slice(0, 60) } } : {}),
      action: {
        button: list.action.slice(0, 20),
        sections: list.sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description
              ? { description: r.description.slice(0, 72) }
              : {}),
          })),
        })),
      },
    },
  });

  const id = res.messages?.[0]?.id;
  if (!id) throw new Error("מטא לא החזירו מזהה הודעה");
  return id;
}

/**
 * מזהה ה-Flow שפורסם אצל מטא.
 *
 * ⚠️ קבוע ולא משתנה סביבה. יש בדיוק אחד, הוא נוצר ידנית בלוח הבקרה,
 * והוא שייך לחשבון הזה בלבד — משתנה סביבה היה מרמז שאפשר להחליף
 * אותו בפריסה אחרת, וזה לא נכון. שם ה-Flow: "תיאום שעת שיחה —
 * חידושים", פורסם 20/08/2026.
 *
 * ⚠️ **Flow שפורסם אינו ניתן לעריכה.** שינוי במסך מחייב יצירת גרסה
 * חדשה בלוח הבקרה והחלפת המזהה כאן.
 */
export const RENEWAL_SLOTS_FLOW_ID = "1076409214769751";

/**
 * הודעת Flow — טופס שנפתח בתוך וואטסאפ.
 *
 * ⚠️⚠️ **הנתונים מוזרמים בזמן השליחה** דרך `flow_action_payload.data`.
 * ה-Flow עצמו מגדיר רק את המבנה (רשימה נגללת בשם `slot`), והשעות
 * מגיעות מכאן. זה מה שמאפשר להציע 42 חצאי שעות מבלי לקבע אותן
 * בנכס שאי אפשר לערוך אחרי פרסום.
 *
 * ⚠️ `flow_token` הוא מה שיחזור אלינו עם התשובה. אנחנו לא נשענים
 * עליו לזיהוי (המספר עושה את זה), אבל מטא דורשים ערך — והוא שימושי
 * בלוג כשצריך לקשר תשובה לשליחה.
 *
 * ⚠️ **רק בתוך חלון 24 השעות**, כמו כל הודעה אינטראקטיבית.
 */
export async function sendFlow(
  toPhone: string,
  flow: {
    header: string;
    body: string;
    footer?: string;
    cta: string;
    flowToken: string;
    screen: string;
    data: Record<string, unknown>;
  },
): Promise<string> {
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!phoneId) throw new Error("חסר WHATSAPP_PHONE_NUMBER_ID");

  const res = await graph<SendResponse>(`${phoneId}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWaPhone(toPhone),
    type: "interactive",
    interactive: {
      type: "flow",
      header: { type: "text", text: flow.header.slice(0, 60) },
      body: { text: flow.body.slice(0, 1024) },
      ...(flow.footer ? { footer: { text: flow.footer.slice(0, 60) } } : {}),
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: flow.flowToken,
          flow_id: RENEWAL_SLOTS_FLOW_ID,
          flow_cta: flow.cta.slice(0, 20),
          // ⚠️ `navigate` ולא `data_exchange`: אין נקודת קצה, וכל
          // המידע שהמסך צריך נשלח כאן מראש
          flow_action: "navigate",
          flow_action_payload: { screen: flow.screen, data: flow.data },
        },
      },
    },
  });

  const id = res.messages?.[0]?.id;
  if (!id) throw new Error("מטא לא החזירו מזהה הודעה");
  return id;
}
