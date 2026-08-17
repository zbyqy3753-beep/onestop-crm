import { NextResponse } from "next/server";
import { drainOutbox } from "@/server/whatsapp/drain";

/**
 * השעון של התור — מנקז את מה שבשל לשליחה.
 *
 * ⚠️⚠️ **בלי הנתיב הזה תזכורות פשוט לא יוצאות בזמן.** `drainOutbox`
 * נקרא רק ממקום אחד נוסף — ה-webhook — כלומר רק כשלקוח כותב לנו.
 * בגרסת הבוט הלא רשמי הסקר כל 20 שניות היה השעון; משהוא הוסר, תזכורת
 * שנקבעה ל-16:00 הייתה יושבת בתור עד שמישהו במקרה שולח הודעה.
 *
 * ⚠️ הניקוז ב-webhook **נשאר** ואינו מיותר: תשובה של לקוח מייצרת
 * הודעת אישור שיוצאת באותה בקשה, תוך שברירי שנייה. ה-cron מכסה את
 * מה שאין לו טריגר — לא מחליף אותו.
 *
 * התזמון ב-`vercel.json`. אימות: `x-api-key` מול `WHATSAPP_API_KEYS`,
 * אותו רישום כמו `/pull` ו-`/report` — הנתיב פתוח בשער הגישה
 * (`PUBLIC_PREFIXES` ב-`proxy.ts`) ולכן חייב לאמת את עצמו.
 */

/** מפתח ה-cron של Vercel, כשהקריאה מגיעה מהתשתית ולא מהבוט. */
function fromVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  const { botFromKey } = await import("@/server/auth/apiKeys");

  const allowed =
    fromVercelCron(request) || Boolean(botFromKey(request.headers.get("x-api-key")));

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "אימות נכשל" },
      { status: 401 },
    );
  }

  const result = await drainOutbox(new URL(request.url).origin);
  return NextResponse.json({ success: true, ...result });
}

/**
 * GET ולא POST: כך Vercel Cron קורא, וכך גם אפשר לבדוק ידנית עם
 * curl בלי גוף בקשה. אין כאן שום דבר שנקרא — רק תופעת לוואי — ולכן
 * זו חריגה מודעת מהסמנטיקה הרגילה של GET.
 */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
