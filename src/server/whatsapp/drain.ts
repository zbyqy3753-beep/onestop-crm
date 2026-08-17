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
import {
  FOLLOWUP_REMINDER_TEMPLATE,
  followUpReminderParams,
} from "@/lib/domain/whatsapp";

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
 * התבנית שההודעה חייבת לצאת דרכה, או `null` אם היא תשובה בתוך חלון
 * 24 השעות ולכן מותרת כטקסט חופשי.
 *
 * ⚠️ נגזר ממפתח הדדופ, שהוא כבר מקור האמת לסוג ההודעה במערכת.
 * שדה נפרד בסכימה היה מוסיף מצב שאפשר לשכוח לעדכן.
 *
 * ⚠️ **גם תזכורת לעובד היא הודעה יזומה.** היא נראית פנימית, אבל מטא
 * רואים רק מספר ששולח למספר — והעובד לא כתב לנו קודם. כשהיא יצאה
 * דרך הבוט זה לא הפריע (הבוט הוא וואטסאפ רגיל); דרך Cloud API בלי
 * תבנית היא נדחית ב-131047.
 */
function templateFor(
  dedupeKey: string,
): typeof RENEWAL_OPENER_TEMPLATE | typeof FOLLOWUP_REMINDER_TEMPLATE | null {
  if (dedupeKey.startsWith("renewal:opener:")) return RENEWAL_OPENER_TEMPLATE;
  if (dedupeKey.startsWith("followup:")) return FOLLOWUP_REMINDER_TEMPLATE;
  return null;
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
  const template = templateFor(msg.dedupeKey);
  if (!template) return sendText(msg.toPhone, msg.body);

  // ⚠️ שתי התבניות מחלצות את הפרמטרים מהגוף המרונדר ולא מהליד: בזמן
  // השליחה יש בידינו רק את ה-snapshot. פונקציית החילוץ של כל תבנית
  // יושבת ליד הפונקציה שמרנדרת אותה, כדי שהשתיים ישתנו יחד.
  const params =
    template === FOLLOWUP_REMINDER_TEMPLATE
      ? followUpReminderParams(msg.body)
      : [nameFromBody(msg.body)];

  return sendTemplate(
    msg.toPhone,
    template.name,
    template.language,
    params,
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
