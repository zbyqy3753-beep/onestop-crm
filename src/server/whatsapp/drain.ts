import "server-only";

import {
  attachProviderId,
  scrubBody,
  pull,
  report,
  type ClaimedMessage,
} from "./outbox";
import {
  cloudApiConfigured,
  cloudApiSenderId,
  sendFlow,
  sendList,
  sendTemplate,
  sendText,
} from "./cloudApi";
import {
  RENEWAL_OPENER_TEMPLATE,
  renewalNoSlotsAck,
  renewalSlotsPrompt,
} from "@/lib/domain/renewalMessages";
import { LIST_MAX_ROWS, buildSlots, slotRowId } from "@/server/renewals/slots";
import {
  FOLLOWUP_REMINDER_TEMPLATE,
  PASSWORD_RESET_CODE_TEMPLATE,
  PASSWORD_RESET_NOTICE_TEMPLATE,
  followUpReminderParams,
} from "@/lib/domain/whatsapp";
import { BROADCAST_TEMPLATE } from "@/lib/domain/broadcast";
import {
  DEAL_WON_TEMPLATE,
  FOLLOWUP_OVERDUE_TEMPLATE,
  LEAD_UNASSIGNED_TEMPLATE,
  dealWonParams,
  overdueParams,
  unassignedParams,
} from "@/lib/domain/alerts";

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
):
  | typeof RENEWAL_OPENER_TEMPLATE
  | typeof FOLLOWUP_REMINDER_TEMPLATE
  | typeof PASSWORD_RESET_CODE_TEMPLATE
  | typeof PASSWORD_RESET_NOTICE_TEMPLATE
  | typeof LEAD_UNASSIGNED_TEMPLATE
  | typeof DEAL_WON_TEMPLATE
  | typeof FOLLOWUP_OVERDUE_TEMPLATE
  | typeof BROADCAST_TEMPLATE
  | null {
  if (dedupeKey.startsWith("renewal:opener:")) return RENEWAL_OPENER_TEMPLATE;
  if (dedupeKey.startsWith("followup:")) return FOLLOWUP_REMINDER_TEMPLATE;
  if (dedupeKey.startsWith("pwcode:")) return PASSWORD_RESET_CODE_TEMPLATE;
  if (dedupeKey.startsWith("pwnotice:")) return PASSWORD_RESET_NOTICE_TEMPLATE;
  if (dedupeKey.startsWith("unassigned:")) return LEAD_UNASSIGNED_TEMPLATE;
  if (dedupeKey.startsWith("dealwon:")) return DEAL_WON_TEMPLATE;
  if (dedupeKey.startsWith("overdue:")) return FOLLOWUP_OVERDUE_TEMPLATE;
  if (dedupeKey.startsWith("broadcast:")) return BROADCAST_TEMPLATE;
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

/**
 * רשימת השעות, מורכבת **ברגע הזה**.
 *
 * ⚠️⚠️ כאן ולא ב-`campaign.ts` שהכניס את השורה לתור. בין ההכנסה
 * לשליחה עוברות דקות עד שעות — חלון השליחה, התקרה היומית, מתג
 * ההשהיה — ורשימה שנבנתה בבוקר הייתה מציעה בערב שעות שכבר עברו.
 * זה הרגע היחיד שבו "עכשיו" של המערכת שווה ל"עכשיו" של הלקוח.
 *
 * ⚠️ מקבץ ריק לא נשלח. מטא דוחים סעיף בלי שורות, וכישלון כאן היה
 * משאיר את הלקוח בלי תשובה אחרי שלחץ.
 */
async function deliverSlots(msg: ClaimedMessage): Promise<string> {
  const prompt = renewalSlotsPrompt();

  /*
   * ⚠️ ה-Flow ראשון, והרשימה היא נפילה לאחור.
   *
   * ה-Flow מציג את כל 42 חצאי השעות במסך נגלל אחד; הרשימה מוגבלת
   * ל-10 שורות בסך הכול, וזה בדיוק מה שהיה "אין כמעט שעות". אבל
   * הודעת Flow יכולה להידחות — לקוח עם אפליקציה ישנה, או תקלה בנכס
   * שאי אפשר לתקן מכאן — וללקוח שלחץ מגיעה תשובה כלשהי. עשר שעות
   * גרועות מארבעים ושתיים, ושתיהן טובות משתיקה.
   */
  const all = buildSlots();
  if (all.length > 0) {
    try {
      return await sendFlow(msg.toPhone, {
        header: prompt.header,
        body: prompt.body,
        footer: prompt.footer,
        cta: prompt.action,
        // המפתח שנרשם בלוג ומקשר תשובה לשליחה
        flowToken: msg.dedupeKey,
        screen: "PICK_TIME",
        data: {
          slots: all.map((slot) => ({
            id: slotRowId(slot.at),
            // ⚠️ ב-Flow אין תיאור לצד הכותרת כמו ברשימה, ולכן היום
            // נכנס לתוך הכותרת עצמה — בלעדיו "16:00" לא אומר מתי
            title: `${slot.day === "today" ? "היום" : "מחר"} ${slot.label}`,
          })),
        },
      });
    } catch {
      // נופלים לרשימה — ראה ההערה למעלה
    }
  }

  const slots = buildSlots(Date.now(), LIST_MAX_ROWS);
  if (slots.length === 0) return sendText(msg.toPhone, renewalNoSlotsAck());

  const sections = (
    [
      { title: "היום", day: "today" as const },
      { title: "מחר", day: "tomorrow" as const },
    ]
  )
    .map((s) => ({
      title: s.title,
      rows: slots
        .filter((slot) => slot.day === s.day)
        .map((slot) => ({
          id: slotRowId(slot.at),
          title: slot.label,
          // ⚠️ הכותרת היא "16:00" בלבד, ובלי התיאור אי אפשר לדעת אם
          // זה היום או מחר. השיוך האמיתי נשען על ה-id, אבל הלקוח
          // רואה רק את הטקסט — והוא צריך לדעת על מה הוא לוחץ.
          description: s.title === "היום" ? "היום" : "מחר",
        })),
    }))
    .filter((s) => s.rows.length > 0);

  return sendList(msg.toPhone, {
    header: prompt.header,
    body: prompt.body,
    footer: prompt.footer,
    action: prompt.action,
    sections,
  });
}

async function deliver(msg: ClaimedMessage): Promise<string> {
  // ⚠️ לפני `templateFor`: זו אינה תבנית ואינה טקסט, והיא היחידה
  // שהתוכן שלה נקבע כאן ולא ב-`body` השמור
  if (msg.dedupeKey.startsWith("renewal:slots:")) return deliverSlots(msg);

  const template = templateFor(msg.dedupeKey);
  if (!template) return sendText(msg.toPhone, msg.body);

  // ⚠️ שתי התבניות מחלצות את הפרמטרים מהגוף המרונדר ולא מהליד: בזמן
  // השליחה יש בידינו רק את ה-snapshot. פונקציית החילוץ של כל תבנית
  // יושבת ליד הפונקציה שמרנדרת אותה, כדי שהשתיים ישתנו יחד.
  /*
   * ⚠️ הודעת קוד היא היחידה שהגוף שלה **הוא** הסוד ולא תיאור שלו:
   * הוא מכיל את שש הספרות בלבד. אין כאן חילוץ בעזרת ביטוי רגולרי —
   * הגוף עובר כמות שהוא.
   */
  if (template === PASSWORD_RESET_CODE_TEMPLATE) {
    return sendTemplate(
      msg.toPhone,
      template.name,
      template.language,
      [msg.body.trim()],
      { otpButton: true },
    );
  }

  /*
   * ⚠️ הדיוור ההמוני הוא היחיד שהגוף שלו **הוא** הפרמטר, בלי חילוץ:
   * מה שהמשתמש כתב נשמר כבר מנורמל (`normalizeBroadcastText`), וכל
   * עיבוד נוסף כאן היה משנה טקסט שהוא כבר אישר בתצוגה המקדימה.
   */
  if (template === BROADCAST_TEMPLATE) {
    return sendTemplate(msg.toPhone, template.name, template.language, [
      msg.body,
    ]);
  }

  const params =
    template === FOLLOWUP_REMINDER_TEMPLATE
      ? followUpReminderParams(msg.body)
      : template === LEAD_UNASSIGNED_TEMPLATE
        ? unassignedParams(msg.body)
        : template === DEAL_WON_TEMPLATE
          ? dealWonParams(msg.body)
          : template === FOLLOWUP_OVERDUE_TEMPLATE
            ? overdueParams(msg.body)
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
      // ⚠️ מיד אחרי השליחה, לא בניקוי מאוחר: הגוף של הודעת קוד **הוא**
      // הקוד, וכל שנייה שהוא יושב במסד היא חלון מיותר.
      if (msg.dedupeKey.startsWith("pwcode:")) await scrubBody(msg.id);
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
