import "server-only";

import {
  attachProviderId,
  pull,
  report,
  type ClaimedMessage,
} from "./outbox";
import {
  cloudApiConfigured,
  cloudApiSenderId,
  sendTemplate,
  sendText,
} from "./cloudApi";
import { RENEWAL_OPENER_TEMPLATE } from "@/lib/domain/renewalMessages";

/**
 * ניקוז התור דרך Cloud API — מחליף את לולאת הסקר של הבוט.
 *
 * ⚠️⚠️ **משתמש ב-`pull` ו-`report` הקיימים ולא מממש תביעה משלו.** כל
 * הכללים שכבר נבנו ואומתו — חלון השליחה, מתג ההשהיה, התקרה היומית,
 * מניעת כפילות, ביטול שורות שאיבדו רלוונטיות, וניסיונות חוזרים —
 * חיים שם. מימוש שני היה נראה פשוט יותר והיה מאבד אותם בשקט.
 *
 * ההבדל היחיד מהבוט: מי מבצע את השליחה. הבוט היה תהליך חיצוני שמושך;
 * כאן זו קריאה מהשרת עצמו.
 */

/** תקרה למחזור אחד, כדי שבקשה בודדת לא תרוץ בלי גבול. */
const BATCH = 10;

export interface DrainResult {
  sent: number;
  failed: number;
  skipped: "notConfigured" | "paused" | null;
}

/**
 * האם ההודעה יוזמת שיחה ולכן חייבת תבנית.
 *
 * ⚠️ נגזר ממפתח הדדופ, שהוא כבר מקור האמת לסוג ההודעה במערכת.
 * שדה נפרד בסכימה היה מוסיף מצב שאפשר לשכוח לעדכן.
 *
 * ⚠️ תזכורות לעובדים (`followup:`) הן גם יזומות, ולכן גם הן ידרשו
 * תבנית משלהן כשהן יעברו ל-API. כרגע הן עדיין יוצאות דרך הבוט, וזו
 * ההחלטה שנשארה פתוחה: להשאיר אותן שם (חינם) או לשלם עליהן.
 */
function needsTemplate(dedupeKey: string): boolean {
  return dedupeKey.startsWith("renewal:opener:");
}

/**
 * שם הלקוח מתוך גוף ההודעה, למילוי `{{1}}` בתבנית.
 *
 * ⚠️ הגוף הוא snapshot שכבר רונדר, ולכן השם כבר בתוכו. חילוץ ממנו
 * שומר על מקור אמת אחד — אבל הוא גם שביר, ולכן נופל בחזרה למחרוזת
 * ניטרלית במקום להיכשל. תבנית עם פרמטר ריק נדחית על ידי מטא.
 */
function nameFromBody(body: string): string {
  const m = /^שלום\s+(.+?),/.exec(body);
  return m?.[1]?.trim() || "לקוח יקר";
}

async function deliver(msg: ClaimedMessage): Promise<string> {
  if (!needsTemplate(msg.dedupeKey)) {
    return sendText(msg.toPhone, msg.body);
  }

  return sendTemplate(
    msg.toPhone,
    RENEWAL_OPENER_TEMPLATE.name,
    RENEWAL_OPENER_TEMPLATE.language,
    [nameFromBody(msg.body)],
  );
}

/**
 * ⚠️ `appUrl` נופל ל-`APP_URL` ולא נדרש מהקורא.
 *
 * הוא משמש רק לקישור בתוך תזכורות לעובדים, ורוב הקוראים כאן הם
 * פעולות שרת בלי אובייקט בקשה. חובה לספק אותו הייתה גוררת העברה
 * מלאכותית של הבקשה דרך שכבות שלא זקוקות לה.
 */
export async function drainOutbox(appUrl?: string): Promise<DrainResult> {
  if (!cloudApiConfigured()) {
    return { sent: 0, failed: 0, skipped: "notConfigured" };
  }

  const base = (appUrl ?? process.env.APP_URL ?? "").replace(/\/$/, "");

  const res = await pull({
    instanceId: "cloud-api",
    // ⚠️ תמיד "מחובר": אין סשן שיכול ליפול, וזו בדיוק הנקודה
    waConnected: true,
    waNumber: cloudApiSenderId(),
    limit: BATCH,
    appUrl: `${base}/leads`,
  });

  if (res.paused) return { sent: 0, failed: 0, skipped: "paused" };

  const results: { id: string; status: "sent" | "failed"; error?: string }[] =
    [];

  for (const msg of res.messages) {
    try {
      const providerId = await deliver(msg);
      // ⚠️ לפני הדיווח: בלי הקישור הזה עדכון המסירה שיגיע ב-webhook
      // לא יידע לאיזו שורה הוא שייך
      await attachProviderId(msg.id, providerId);
      results.push({ id: msg.id, status: "sent" });
    } catch (e) {
      results.push({
        id: msg.id,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (results.length) await report(results);

  return {
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: null,
  };
}
