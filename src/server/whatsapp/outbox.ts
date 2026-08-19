import "server-only";

import { prisma } from "@/server/db/client";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { isIsraeliPhone, toE164 } from "@/lib/format";
import { followUpReminder } from "@/lib/domain/whatsapp";
import {
  dealWonBody,
  dealWonDedupeKey,
  overdueBody,
  overdueDedupeKey,
  unassignedBody,
  unassignedDedupeKey,
} from "@/lib/domain/alerts";
import { leadFromPrisma } from "@/server/repositories/prisma/mappers";
import { israelHourMinute, startOfDay } from "@/lib/tz";
import { readSettings, type BotSettingsView } from "./settings";
import { markOpenerSent } from "@/server/renewals/campaign";

/**
 * מנוע התור של תזכורות הוואטסאפ.
 *
 * כל ההיגיון כאן ולא בבוט: מי זכאי לתזכורת, מה כתוב בה, ומתי מותר
 * לשלוח. הבוט מקבל שורות מוכנות ומדווח תוצאה — הוא לא מכיר את מודל
 * הנתונים ולא מחזיק את פרטי החיבור למסד.
 *
 * הבוט הוא גם **השעון היחיד**: אין cron. כשהמחשב במשרד כבוי התור
 * מצטבר, וכשהוא חוזר הוא מתנקז. שני שעונים בלתי תלויים היו יכולים
 * שניהם להחליט ששורה בשלה.
 */

/** שורה שנתבעה ולא דווחה — הבוט קרס באמצע. משוחררת אחרי זה. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

/** מעל זה ההודעה כבר לא רלוונטית — עדיף כלום מאשר תזכורת מלפני יומיים. */
const STALE_AFTER_MS = 48 * 3_600_000;

/** מספר הניסיונות לפני ויתור, כדי ששורה תקועה לא תסתובב לנצח. */
const MAX_ATTEMPTS = 3;

/** המתנה לפני ניסיון חוזר אחרי כישלון שדוּוח. ראה `report`. */
const RETRY_DELAY_MS = 60_000;

/** מעל חצי שעה בלי דופק = נפילה אמיתית ולא רק פספוס סקר אחד. */
const RECOVERY_THRESHOLD_MS = 30 * 60_000;

export interface ClaimedMessage {
  id: string;
  toPhone: string;
  body: string;
  /**
   * ⚠️ נחשף כי הוא **מקור האמת לסוג ההודעה**.
   *
   * ב-Cloud API הודעה שיוזמת שיחה חייבת תבנית מאושרת, ותשובה בתוך
   * חלון 24 השעות היא טקסט חופשי. ההבחנה כבר מקודדת במפתח
   * (`renewal:opener:` מול `renewal:confirm:`), ושדה נפרד בסכימה היה
   * מוסיף מצב שאפשר לשכוח לעדכן. הבוט הישן פשוט מתעלם מהשדה.
   */
  dedupeKey: string;
}

/** מפתח ה-exactly-once: תזמון מחדש = חובה חדשה, אותה שעה = no-op. */
function dedupeKeyFor(leadId: string, followUpAt: Date): string {
  return `followup:${leadId}:${followUpAt.toISOString()}`;
}

/** חלון השליחה, כפי שהמנהל הגדיר אותו. */
interface SendWindow {
  sendWindowStartHour: number;
  sendWindowEndHour: number;
}

/**
 * מתי התזכורת של חזרה נתונה תצא — לפי ההגדרות הנוכחיות.
 *
 * קיים בשביל מסך הבוטים. בלעדיו "יש חזרה ב-16:30" ו"אין כלום בתור"
 * נראים כמו סתירה, כי השורה בתור נוצרת רק דקות לפני השליחה. הצגת
 * המועד המתוכנן הופכת את זה ממה שנראה כמו באג למידע.
 */
export function plannedSendAt(
  followUpAt: Date,
  settings: BotSettingsView,
): Date {
  const leadMs = Math.max(0, settings.reminderLeadMinutes) * 60_000;
  return nextSendableInstant(new Date(followUpAt.getTime() - leadMs), settings);
}

/** האם רגע נתון נופל בתוך חלון השליחה, בשעון ישראל. */
export function insideSendWindow(now: number, win: SendWindow): boolean {
  const hour = Number(israelHourMinute(now).slice(0, 2));
  return hour >= win.sendWindowStartHour && hour < win.sendWindowEndHour;
}

/**
 * הרגע הבא שבו מותר לשלוח. תזכורת שנקבעה ל-03:00 בטעות נדחית
 * ל-08:00 ולא נעלמת.
 */
function nextSendableInstant(scheduled: Date, win: SendWindow): Date {
  if (insideSendWindow(scheduled.getTime(), win)) return scheduled;

  const hour = Number(israelHourMinute(scheduled).slice(0, 2));
  const dayStart = startOfDay(scheduled);
  // אחרי סגירת החלון — מחר בבוקר; לפני פתיחתו — הבוקר הזה
  const base = hour >= win.sendWindowEndHour ? dayStart + 86_400_000 : dayStart;
  return new Date(base + win.sendWindowStartHour * 3_600_000);
}

/**
 * כמה הודעות כבר יצאו היום (שעון ישראל).
 *
 * נספרות `sent` **ו-`sending`** יחד: שורה שנתבעה ועדיין לא דווחה כבר
 * עזבה את השרת מבחינת התקרה. ספירה של `sent` בלבד הייתה מאפשרת לחרוג
 * בגודל אצווה שלם בכל סקר.
 */
export async function sentToday(): Promise<number> {
  return prisma.whatsAppMessage.count({
    where: {
      status: { in: ["sent", "sending"] },
      OR: [
        { sentAt: { gte: new Date(startOfDay(Date.now())) } },
        { sentAt: null, claimedAt: { gte: new Date(startOfDay(Date.now())) } },
      ],
    },
  });
}

/**
 * ממלא את התור מלידים שהגיע זמן החזרה שלהם.
 *
 * תנאי הזכאות: תאריך חזרה שהגיע, סטטוס לא סופי, משויך לעובד פעיל
 * עם טלפון תקין. ליד ללא שיוך **מדולג בכוונה** — אין למי לשלוח,
 * וחלוקת לידים היא החלטה ניהולית שהבוט לא אמור לקבל.
 *
 * ⚠️ התזכורת יוצאת `reminderLeadMinutes` **לפני** מועד החזרה, ולכן
 * החלון כאן הוא `followUpAt <= now + lead` ולא `<= now`. בלי ההקדמה
 * הזו התזכורת מגיעה בדיוק בשנייה שבה כבר היה צריך לחייג, והעובד
 * מתחיל את השיחה באיחור של הזמן שלקח לו לקרוא אותה.
 *
 * ה-`dedupeKey` נשאר על `followUpAt` המקורי ולא על מועד השליחה:
 * שינוי ההקדמה בהגדרות **לא** אמור לייצר תזכורת שנייה לאותה חזרה.
 */
async function enqueueDueFollowUps(
  appUrl: string,
  settings: BotSettingsView,
): Promise<number> {
  const win = settings;
  const leadMs = Math.max(0, settings.reminderLeadMinutes) * 60_000;

  // ⚠️ הלידים חסרי השיוך מטופלים בנפרד ולא כאן — ראה
  // `enqueueUnassignedAlerts`. הם היו נופלים מהתנאי שלמטה בשקט.
  await enqueueUnassignedAlerts(leadMs, win);
  await enqueueDealWonAlerts(win);
  await enqueueOverdueAlerts(win);

  const due = await prisma.lead.findMany({
    where: {
      followUpAt: { not: null, lte: new Date(Date.now() + leadMs) },
      assigneeId: { not: null },
      assignee: { active: true, phone: { not: null } },
    },
    include: {
      notes: true,
      history: { orderBy: { createdAt: "asc" } },
      activity: { orderBy: { createdAt: "asc" } },
      assignee: true,
    },
  });

  let created = 0;
  for (const row of due) {
    if (STATUS_CONFIG[row.status].terminal) continue;
    const recipient = row.assignee;
    if (!recipient?.phone || !isIsraeliPhone(recipient.phone)) continue;

    const scheduled = row.followUpAt!;
    const key = dedupeKeyFor(row.id, scheduled);

    // מתי ההודעה אמורה לצאת — מוקדם ממועד החזרה, ומוסט קדימה אם
    // ההקדמה הוציאה אותה מחוץ לחלון (חזרה ב-08:05 פחות 10 דקות)
    const sendAt = new Date(scheduled.getTime() - leadMs);

    try {
      await prisma.whatsAppMessage.create({
        data: {
          dedupeKey: key,
          toPhone: toE164(recipient.phone),
          body: followUpReminder(leadFromPrisma(row), {
            appUrl,
            leadMinutes: settings.reminderLeadMinutes,
            // מועד החזרה כבר עבר ברגע הכניסה לתור = המחשב במשרד היה
            // כבוי. "בעוד 10 דקות" על חזרה מלפני שעתיים הוא שקר
            late: sendAt.getTime() < Date.now() - 60_000,
          }),
          scheduledFor: nextSendableInstant(sendAt, win),
          leadId: row.id,
          recipientUserId: recipient.id,
        },
      });
      created++;
    } catch {
      // הפרת ייחודיות = התזכורת הזו כבר בתור או כבר נשלחה. זה המצב
      // הרגיל בכל סקר אחרי הראשון, ולא שגיאה.
    }
  }
  return created;
}

/**
 * מבטל שורות ממתינות שכבר לא משקפות את מצב הליד.
 *
 * רץ על **כל** השורות הממתינות ולא רק על מה שנוצר עכשיו, כי כאן
 * נתפסים גם: תאריך חזרה שנוקה, סטטוס שהפך לסופי, שיוך שהוסר, ועובד
 * שהושבת. הבחירה לסרוק כאן ולא לחבר hook ל-`patchLeadAction` היא
 * מכוונת: hook היה מצמיד את נתיב הכתיבה החם לתור ומוסיף מצב כשל לכל
 * שינוי סטטוס, תמורת חלון של עד דקה שהנזק בו הוא הודעה פנימית אחת.
 */
async function cancelSuperseded(): Promise<number> {
  const pending = await prisma.whatsAppMessage.findMany({
    /*
     * ⚠️⚠️ **תזכורות חזרה בלבד.** התנאים למטה נכתבו עבורן ובודקים,
     * בין השאר, שלליד יש משויך פעיל — ולכן שורה מסוג אחר שיש לה
     * `leadId` הייתה מבוטלת כאן בשקט, מיד עם יצירתה.
     *
     * זה בדיוק מה שהיה קורה להתראות `unassigned:`: הן קיימות **בגלל**
     * שאין לליד משויך, כלומר הן היו נכשלות בתנאי שנועד להגן על
     * התזכורות. בלי הסינון הזה התכונה כולה לא הייתה עובדת, ושום
     * שגיאה לא הייתה מופיעה.
     */
    where: {
      status: "queued",
      leadId: { not: null },
      dedupeKey: { startsWith: "followup:" },
    },
    select: {
      id: true,
      dedupeKey: true,
      lead: {
        select: {
          id: true,
          followUpAt: true,
          status: true,
          assigneeId: true,
          assignee: { select: { active: true, phone: true } },
        },
      },
    },
  });

  const stale: string[] = [];
  for (const msg of pending) {
    const lead = msg.lead;
    const invalid =
      !lead ||
      !lead.followUpAt ||
      STATUS_CONFIG[lead.status].terminal ||
      !lead.assigneeId ||
      !lead.assignee?.active ||
      !lead.assignee.phone ||
      dedupeKeyFor(lead.id, lead.followUpAt) !== msg.dedupeKey;

    if (invalid) stale.push(msg.id);
  }

  if (stale.length === 0) return 0;
  const { count } = await prisma.whatsAppMessage.updateMany({
    where: { id: { in: stale }, status: "queued" },
    data: { status: "cancelled", lastError: "superseded" },
  });
  return count;
}

/** מוותר על תזכורות ישנות מדי — עדיף כלום מאשר הצפה אחרי סוף שבוע. */
async function cancelStale(): Promise<number> {
  const { count } = await prisma.whatsAppMessage.updateMany({
    where: {
      status: "queued",
      scheduledFor: { lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    data: { status: "cancelled", lastError: "stale" },
  });
  return count;
}

/** משחרר שורות שנתבעו ולא דווחו — הבוט קרס או איבד חיבור באמצע. */
async function reclaimAbandoned(): Promise<void> {
  const cutoff = new Date(Date.now() - CLAIM_TIMEOUT_MS);

  await prisma.whatsAppMessage.updateMany({
    where: {
      status: "sending",
      claimedAt: { lt: cutoff },
      attempts: { gte: MAX_ATTEMPTS },
    },
    data: { status: "failed", lastError: "אבד אחרי מספר ניסיונות" },
  });

  await prisma.whatsAppMessage.updateMany({
    where: { status: "sending", claimedAt: { lt: cutoff } },
    data: { status: "queued" },
  });
}

/**
 * תובע שורות לשליחה.
 *
 * התביעה היא `updateMany` מותנה על `status: "queued"` — שני מופעי בוט
 * לא יכולים פיזית לתבוע את אותה שורה, ולכן הרצה כפולה בטוחה מעצם
 * הבנייה ואין צורך בנעילה.
 */
async function claim(
  limit: number,
  settings: BotSettingsView,
): Promise<ClaimedMessage[]> {
  // שלוש בלימות, כולן "לא לתבוע" ולא "לבטל": התור נשמר וממשיך
  // להתנקז כשהתנאי חוזר להיות מתקיים, בדיוק כמו מחשב שכובה.
  if (settings.paused) return [];
  if (!insideSendWindow(Date.now(), settings)) return [];

  let room = Math.min(limit, 20);
  if (settings.dailyCap > 0) {
    room = Math.min(room, settings.dailyCap - (await sentToday()));
    if (room <= 0) return [];
  }

  const candidates = await prisma.whatsAppMessage.findMany({
    where: { status: "queued", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: room,
    select: { id: true },
  });
  if (candidates.length === 0) return [];

  const claimed: ClaimedMessage[] = [];
  for (const { id } of candidates) {
    const { count } = await prisma.whatsAppMessage.updateMany({
      where: { id, status: "queued" },
      data: {
        status: "sending",
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (count === 0) continue; // מופע אחר הקדים — לא שלנו

    const row = await prisma.whatsAppMessage.findUnique({
      where: { id },
      select: { id: true, toPhone: true, body: true, dedupeKey: true },
    });
    if (row) claimed.push(row);
  }
  return claimed;
}

export interface PullResult {
  messages: ClaimedMessage[];
  queued: number;
  /** דקות שהבוט היה שקוע, אם זו חזרה מנפילה — אחרת null */
  recoveredAfterMinutes: number | null;
  /** מנהל עצר את השליחה מהאתר. הבוט מדפיס את זה במקום "0 בתור". */
  paused: boolean;
}

/**
 * הסקר שהבוט קורא לו. עושה הכול בסדר אחד ומחזיר מה לשלוח.
 */
export async function pull(input: {
  instanceId?: string;
  waConnected: boolean;
  waNumber?: string;
  limit: number;
  appUrl: string;
}): Promise<PullResult> {
  const [previous, settings] = await Promise.all([
    prisma.botHeartbeat.findUnique({
      where: { id: "default" },
      select: { lastSeenAt: true },
    }),
    readSettings(),
  ]);
  const downMs = previous
    ? Date.now() - previous.lastSeenAt.getTime()
    : Number.POSITIVE_INFINITY;

  // ⚠️ המילוי רץ **גם כשעצור**. עצירה חוסמת שליחה, לא צבירה: כשמנהל
  // משחרר את המתג הוא מצפה למצוא את מה שהצטבר, ולא לגלות שהתזכורות
  // של השעתיים האחרונות פשוט לא קיימות.
  await enqueueDueFollowUps(input.appUrl, settings);

  await cancelSuperseded();
  await cancelStale();
  await reclaimAbandoned();

  // בלי חיבור לוואטסאפ אין טעם לתבוע — התביעה הייתה מבזבזת ניסיון
  const messages = input.waConnected ? await claim(input.limit, settings) : [];
  const queued = await prisma.whatsAppMessage.count({
    where: { status: "queued" },
  });

  await prisma.botHeartbeat.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      lastSeenAt: new Date(),
      waConnected: input.waConnected,
      waNumber: input.waNumber,
      instanceId: input.instanceId,
      queuedCount: queued,
    },
    update: {
      lastSeenAt: new Date(),
      waConnected: input.waConnected,
      waNumber: input.waNumber,
      instanceId: input.instanceId,
      queuedCount: queued,
    },
  });

  return {
    messages,
    queued,
    recoveredAfterMinutes:
      previous && downMs > RECOVERY_THRESHOLD_MS
        ? Math.round(downMs / 60_000)
        : null,
    paused: settings.paused,
  };
}

/**
 * מטא אישרו שההודעה נמסרה ללקוח.
 *
 * ⚠️ לא משנה סטטוס אלא רק מנקה שגיאה. `sent` אצלנו כבר נכתב ברגע
 * שמטא קיבלו אותה; המסירה בפועל היא חיזוק, ולא מצב חדש שצריך לנהל.
 * מה שכן חשוב זה שדיווח מסירה **מבטל** שגיאה קודמת — שורה שנרשמה
 * עליה תקלה ואז נמסרה בכל זאת לא צריכה להישאר מסומנת כבעייתית.
 */
export async function markDelivered(providerMessageId: string): Promise<void> {
  await prisma.whatsAppMessage.updateMany({
    where: { providerMessageId },
    data: { lastError: null },
  });
}

/**
 * מטא דחו את ההודעה או שהיא לא נמסרה.
 *
 * ⚠️ אותה מדיניות בדיוק כמו כישלון שדוּוח מהבוט: חוזר לתור עד
 * `MAX_ATTEMPTS`, ורק אז `failed`. ההבדל היחיד הוא שכאן הכישלון
 * מגיע **אחרי** שכבר סימנו `sent`, כי מטא קיבלו את ההודעה ורק אחר
 * כך גילו שאי אפשר למסור אותה.
 */
export async function markUndeliverable(
  providerMessageId: string,
  error: string,
): Promise<void> {
  const row = await prisma.whatsAppMessage.findUnique({
    where: { providerMessageId },
    select: { id: true, attempts: true },
  });
  if (!row) return;

  const giveUp = row.attempts >= MAX_ATTEMPTS;

  await prisma.whatsAppMessage.update({
    where: { id: row.id },
    data: giveUp
      ? { status: "failed", lastError: error.slice(0, 300) }
      : {
          status: "queued",
          claimedAt: null,
          sentAt: null,
          providerMessageId: null,
          lastError: error.slice(0, 300),
          scheduledFor: new Date(Date.now() + RETRY_DELAY_MS),
        },
  });
}

/** מקשר שורה למזהה שמטא החזירו, כדי ש-webhook יוכל לעדכן אותה. */
export async function attachProviderId(
  id: string,
  providerMessageId: string,
): Promise<void> {
  await prisma.whatsAppMessage.updateMany({
    where: { id },
    data: { providerMessageId },
  });
}

/**
 * מוחק את גוף ההודעה אחרי שליחה מוצלחת.
 *
 * ⚠️ **קיים בשביל הודעות הקוד בלבד, וזו הסיבה שהוא קיים בכלל.** הגוף
 * שלהן **הוא** הקוד — סוד חי שפותח חשבון — ושורות התור נשמרות אחרי
 * השליחה בתור ראיה שההודעה יצאה. בלי המחיקה הזו היו מצטברים במסד
 * קודים בטקסט גלוי, וכל מי שקורא את הטבלה היה יכול להשתמש בהם בעשר
 * הדקות שלהם.
 *
 * ⚠️ הראיה נשמרת: השורה, הנמען, מזהה ההודעה אצל מטא ותאריך השליחה
 * נשארים. רק התוכן מוחלף — אי אפשר לדעת מהתור מה היה הקוד, ואפשר
 * עדיין לדעת שנשלח.
 */
export async function scrubBody(id: string): Promise<void> {
  await prisma.whatsAppMessage.updateMany({
    where: { id },
    data: { body: "[הקוד נמחק אחרי השליחה]" },
  });
}

/** קולט את תוצאות השליחה מהבוט. */
export async function report(
  results: { id: string; status: "sent" | "failed"; error?: string }[],
): Promise<number> {
  let applied = 0;
  const sentKeys: string[] = [];

  for (const r of results) {
    if (r.status === "sent") {
      const { count } = await prisma.whatsAppMessage.updateMany({
        where: { id: r.id, status: "sending" },
        data: { status: "sent", sentAt: new Date(), lastError: null },
      });
      applied += count;

      if (count > 0) {
        const row = await prisma.whatsAppMessage.findUnique({
          where: { id: r.id },
          select: { dedupeKey: true },
        });
        if (row) sentKeys.push(row.dedupeKey);
      }
      continue;
    }

    /*
     * ⚠️ כישלון מדוּוח חוזר לתור — לא נקבר.
     *
     * עד עכשיו כל כישלון סימן `failed` מיד, וזה מצב סופי: אין שום דבר
     * שמחזיר ממנו. כלומר ניתוק רשת של שנייה אחת, או סשן שנפל באמצע,
     * הרג את ההודעה לתמיד — וזה קרה בפועל, עם `Connection Closed`
     * שדרש שחזור ידני במסד.
     *
     * `MAX_ATTEMPTS` כבר קיים ומשמש את `reclaimAbandoned`; כאן הוא
     * מקבל את המשמעות שהתכוונו לו מלכתחילה. אחרי שלושה ניסיונות
     * ההודעה באמת נכשלת ומופיעה במסך הבוטים.
     */
    const row = await prisma.whatsAppMessage.findUnique({
      where: { id: r.id },
      select: { attempts: true },
    });
    const giveUp = (row?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;
    const error = r.error?.slice(0, 300) ?? "שגיאה";

    const { count } = await prisma.whatsAppMessage.updateMany({
      where: { id: r.id, status: "sending" },
      data: giveUp
        ? { status: "failed", lastError: error }
        : {
            status: "queued",
            claimedAt: null,
            lastError: error,
            // ⚠️ דקה קדימה ולא מיד: ניסיון חוזר מיידי על חיבור שבור
            // היה שורף את שלושת הניסיונות בשלוש שניות
            scheduledFor: new Date(Date.now() + RETRY_DELAY_MS),
          },
    });
    applied += count;
  }

  /*
   * ⚠️ מצב איש הקשר בקמפיין מתקדם ל"ממתין לתשובה" **כאן** ולא בזמן
   * ההכנסה לתור. "נשלח" חייב להיות מה שקרה ולא מה שתוכנן: מחשב כבוי
   * במשרד היה משאיר לקוחות במצב שממתין לתשובה שלא תגיע, כי מעולם
   * לא נשאלה שאלה.
   */
  if (sentKeys.length > 0) await markOpenerSent(sentKeys);

  return applied;
}

/**
 * מתריע לבעלים על ליד שנקבעה לו חזרה ואין לו משויך.
 *
 * ⚠️⚠️ **החור שזה סוגר היה שקט לחלוטין.** `enqueueDueFollowUps` דורש
 * `assigneeId: { not: null }`, ובצדק — אין למי לשלוח תזכורת, וחלוקת
 * לידים היא החלטה ניהולית שהבוט לא אמור לקבל. אבל התוצאה הייתה שליד
 * עם חזרה שנקבעה פשוט נשמט: אין תזכורת, אין שגיאה, ואיש לא חוזר
 * ללקוח. שום מסך לא הראה את זה.
 *
 * ⚠️ **לבעלים בלבד.** הם היחידים שרשאים לשייך לידים, ולכן הם היחידים
 * שההתראה מבקשת מהם דבר שהם יכולים לעשות. שליחה לכל הצוות הייתה
 * מייצרת הודעה שאיש אינו אחראי עליה.
 *
 * ⚠️ **עובד לא פעיל או בלי טלפון נספר כאן כמו חסר שיוך.** מבחינת
 * הלקוח אין הבדל: גם אז אף תזכורת לא תצא. זו בדיוק הצורה שבה עובד
 * שעזב משאיר אחריו לידים שקטים.
 */
async function enqueueUnassignedAlerts(
  leadMs: number,
  win: SendWindow,
): Promise<void> {
  const orphans = await prisma.lead.findMany({
    where: {
      followUpAt: { not: null, lte: new Date(Date.now() + leadMs) },
      OR: [
        { assigneeId: null },
        { assignee: { active: false } },
        { assignee: { phone: null } },
      ],
    },
    select: { id: true, name: true, phone: true, status: true, followUpAt: true },
  });
  if (orphans.length === 0) return;

  const owners = await prisma.user.findMany({
    where: { role: "owner", active: true, phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });
  if (owners.length === 0) return;

  for (const lead of orphans) {
    if (STATUS_CONFIG[lead.status].terminal) continue;
    const scheduled = lead.followUpAt!;

    for (const owner of owners) {
      const to = toE164(owner.phone ?? "");
      if (!to || !isIsraeliPhone(owner.phone ?? "")) continue;

      try {
        await prisma.whatsAppMessage.create({
          data: {
            dedupeKey: unassignedDedupeKey(lead.id, owner.id, scheduled),
            toPhone: to,
            body: unassignedBody(owner.name, lead.name, lead.phone),
            // ⚠️ יוצאת מיד ולא במועד החזרה: כל הנקודה היא לתת לבעלים
            // זמן לשייך **לפני** שהשעה מגיעה. התראה שתגיע בשעת החזרה
            // עצמה כבר מאחרת.
            scheduledFor: nextSendableInstant(new Date(), win),
            leadId: lead.id,
            recipientUserId: owner.id,
          },
        });
      } catch {
        // מפתח כפול = כבר הותרענו על החזרה הזו לבעלים הזה. זו
        // ההתנהגות הרצויה ולא שגיאה.
      }
    }
  }
}

/**
 * ⚠️ כמה זמן אחרי מועד החזרה נחשב "לא בוצע".
 *
 * לא אפס: עובד שמחייג בדיוק בשעה עדיין לא עדכן את המערכת, והתראה
 * מיידית הייתה מאשימה אותו באיחור בזמן שהוא בשיחה. חצי שעה היא
 * הפער שבו כבר סביר שהחזרה נשכחה ולא שהיא פשוט מתבצעת ברגע זה.
 */
const OVERDUE_AFTER_MS = 30 * 60_000;

/** הבעלים שמקבלים התראות ניהוליות — פעילים ועם טלפון תקין. */
async function alertOwners() {
  const rows = await prisma.user.findMany({
    where: { role: "owner", active: true, phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });
  return rows.filter((o) => isIsraeliPhone(o.phone ?? ""));
}

/**
 * מתריע לבעלים על עסקה שנסגרה — מי הלקוח ומי סגר.
 *
 * ⚠️ **נקרא מ-`LeadStatusEvent` ולא מ-hook בנתיב הכתיבה.** אותה בחירה
 * כמו ב-`cancelSuperseded`: hook היה מצמיד את מסך הלידים לתור ומוסיף
 * מצב כשל לכל שינוי סטטוס. הטבלה כבר רושמת מי שינה ומתי, וזה כל מה
 * שההתראה צריכה.
 *
 * ⚠️ החלון הוא שעה אחורה. הוא לא צריך להיות רחב — הניקוז רץ כל חמש
 * דקות — אבל הוא כן צריך לספוג הפסקה קצרה של המתזמן בלי לאבד סגירה.
 * המפתח מונע כפילות בכל מקרה.
 */
async function enqueueDealWonAlerts(win: SendWindow): Promise<void> {
  const events = await prisma.leadStatusEvent.findMany({
    where: {
      to: "won",
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
    },
    select: {
      id: true,
      createdAt: true,
      actor: { select: { name: true } },
      lead: { select: { name: true, phone: true, id: true } },
    },
  });
  if (events.length === 0) return;

  const owners = await alertOwners();

  for (const ev of events) {
    for (const owner of owners) {
      try {
        await prisma.whatsAppMessage.create({
          data: {
            dedupeKey: dealWonDedupeKey(ev.id, owner.id),
            toPhone: toE164(owner.phone!),
            body: dealWonBody(ev.lead.name, ev.lead.phone, ev.actor.name),
            scheduledFor: nextSendableInstant(new Date(), win),
            leadId: ev.lead.id,
            recipientUserId: owner.id,
          },
        });
      } catch {
        // כבר הותרענו על הסגירה הזו לבעלים הזה.
      }
    }
  }
}

/**
 * מתריע לבעלים על חזרה שהמועד שלה עבר והליד עדיין פתוח.
 *
 * ⚠️ **"לא בוצע" נגזר מכך שהחזרה עדיין קבועה לאותו מועד.** כשעובד
 * מטפל בליד הוא מזיז את מועד החזרה או משנה סטטוס, ואז השורה הזו לא
 * נתפסת. מי שנשאר תקוע על מועד שעבר — פשוט לא נגע בו.
 *
 * ⚠️ נשלח **גם** למשויך עצמו? לא. הוא כבר קיבל תזכורת במועד, וזו
 * התראה ניהולית על כך שהיא לא הובילה לכלום. הודעה שנייה לאותו אדם
 * הופכת את המערכת למציקה במקום למועילה.
 */
async function enqueueOverdueAlerts(win: SendWindow): Promise<void> {
  const overdue = await prisma.lead.findMany({
    where: {
      followUpAt: {
        not: null,
        lt: new Date(Date.now() - OVERDUE_AFTER_MS),
        // ⚠️ תקרה אחורה: בלעדיה כל ליד ישן עם תאריך חזרה נשכח היה
        // מייצר התראה ברגע שהתכונה עולה לאוויר — הצפה במאות הודעות.
        gt: new Date(Date.now() - 24 * 3_600_000),
      },
      assigneeId: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      followUpAt: true,
      lastContactAt: true,
      assignee: { select: { name: true } },
    },
  });
  if (overdue.length === 0) return;

  const owners = await alertOwners();

  for (const lead of overdue) {
    if (STATUS_CONFIG[lead.status].terminal) continue;
    const at = lead.followUpAt!;

    /*
     * ⚠️⚠️ **"לא פנה" נקבע לפי `lastContactAt`, לא לפי מועד החזרה.**
     *
     * `changeStatus` **אינו מנקה** את מועד החזרה בסטטוס לא-סופי — יש
     * על כך הערה מפורשת שם, והיא נכונה: מעבר ל"אין מענה" לא אמור
     * למחוק חזרה שנקבעה מראש. אבל המשמעות היא שנציג שחייג, דיבר
     * ועדכן ל"נוצר קשר" משאיר את התאריך הישן על הליד.
     *
     * בלי הבדיקה הזו ההתראה הייתה יוצאת בדיוק על מי שכן עשה את
     * העבודה — ההפך הגמור ממה שהיא נועדה לתפוס, ובתוך יומיים היא
     * הייתה נחשבת לרעש שמתעלמים ממנו.
     *
     * `lastContactAt` מתעדכן בכל שינוי סטטוס, ולכן "מגע אחרי המועד
     * שנקבע" הוא בדיוק ההגדרה של "הנציג טיפל".
     */
    if (lead.lastContactAt && lead.lastContactAt.getTime() >= at.getTime()) {
      continue;
    }

    for (const owner of owners) {
      try {
        await prisma.whatsAppMessage.create({
          data: {
            dedupeKey: overdueDedupeKey(lead.id, owner.id, at),
            toPhone: toE164(owner.phone!),
            body: overdueBody(
              lead.name,
              lead.phone,
              lead.assignee?.name ?? "—",
              israelHourMinute(at.getTime()),
            ),
            scheduledFor: nextSendableInstant(new Date(), win),
            leadId: lead.id,
            recipientUserId: owner.id,
          },
        });
      } catch {
        // כבר הותרענו על החזרה הזו.
      }
    }
  }
}
