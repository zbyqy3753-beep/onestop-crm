import "server-only";

import { prisma } from "@/server/db/client";
import { startOfDay } from "@/lib/tz";
import { normalizeEmail } from "@/lib/email";
import { renderMerge } from "@/lib/domain/mailMerge";
import { roomForTick } from "@/lib/domain/mailRate";
import { insideSendWindow } from "@/server/whatsapp/outbox";
import { readMailerSettings, type MailerSettingsView } from "./settings";

/**
 * מנוע התור של הדיוור.
 *
 * ⚠️ **`insideSendWindow` מיובא מתור הוואטסאפ ולא משוכפל.** אותו
 * חישוב בדיוק, ומימוש שני היה נראה תמים ומתפצל בשקט ברגע שמישהו
 * מתקן באג באחד מהם.
 */

/** מספר הניסיונות לפני ויתור, כדי ששורה תקועה לא תסתובב לנצח. */
const MAX_ATTEMPTS = 3;

/** המתנה לפני ניסיון חוזר אחרי כישלון. */
const RETRY_DELAY_MS = 60_000;

/** שורה שנתבעה ולא דווחה — התהליך נפל באמצע. משוחררת אחרי זה. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

export interface RecipientInput {
  email: string;
  name: string;
  fields: Record<string, string>;
}

export interface EnqueueResult {
  campaignId: string;
  queued: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
}

/**
 * יוצר קמפיין ומכניס את כל הנמענים לתור, כשהגוף כבר מרונדר.
 *
 * ⚠️ **הרינדור כאן ולא בשליחה.** מה שיצא הוא עובדה היסטורית: עריכת
 * הקמפיין אחרי שחצי הרשימה קיבלה אינה משנה את מה שכבר נשלח, ומי
 * שמסתכל על השורה רואה בדיוק את מה שהאדם קרא.
 */
export async function enqueueCampaign(input: {
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  createdById: string | null;
  recipients: RecipientInput[];
}): Promise<EnqueueResult> {
  const optedOut = new Set(
    (await prisma.emailOptOut.findMany({ select: { email: true } })).map(
      (r) => r.email,
    ),
  );

  const seen = new Set<string>();
  let invalid = 0;
  let duplicate = 0;
  let skippedOptOut = 0;

  const rows: {
    email: string;
    name: string;
    subject: string;
    body: string;
  }[] = [];

  for (const recipient of input.recipients) {
    const email = normalizeEmail(recipient.email);
    if (!email) {
      invalid++;
      continue;
    }
    if (optedOut.has(email)) {
      skippedOptOut++;
      continue;
    }
    if (seen.has(email)) {
      duplicate++;
      continue;
    }
    seen.add(email);

    // ⚠️ `שם` זמין תמיד, גם כשהקובץ לא כלל עמודת שם — התבנית הנפוצה
    // ביותר פותחת ב"שלום {{שם}}", ותבנית שנשברת על קובץ בלי שם
    // הייתה מכריחה לכתוב אותה מחדש.
    const values = { ...recipient.fields, שם: recipient.name };

    rows.push({
      email,
      name: recipient.name,
      subject: renderMerge(input.subjectTemplate, values),
      body: renderMerge(input.bodyTemplate, values),
    });
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: input.name,
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate,
      status: rows.length > 0 ? "sending" : "done",
      totalCount: rows.length,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  const now = new Date();
  const { count } = await prisma.emailMessage.createMany({
    data: rows.map((row) => ({
      dedupeKey: `campaign:${campaign.id}:${row.email}`,
      campaignId: campaign.id,
      toEmail: row.email,
      toName: row.name || null,
      subject: row.subject,
      body: row.body,
      scheduledFor: now,
    })),
    // ⚠️ הכפילויות כבר סוננו למעלה; זו רשת ביטחון מפני הרצה כפולה
    // של אותה בקשה, לא תחליף לספירה שהמסך מציג.
    skipDuplicates: true,
  });

  return {
    campaignId: campaign.id,
    queued: count,
    invalid,
    duplicate,
    optedOut: skippedOptOut,
  };
}

/**
 * כמה מיילים כבר יצאו היום (שעון ישראל).
 *
 * נספרים `sent` **ו-`sending`** יחד: שורה שנתבעה ועדיין לא דווחה כבר
 * עזבה את השרת מבחינת התקרה. ספירת `sent` בלבד הייתה מאפשרת לחרוג
 * בגודל אצווה שלם בכל תקתוק.
 */
export async function sentMailToday(): Promise<number> {
  const dayStart = new Date(startOfDay(Date.now()));
  return prisma.emailMessage.count({
    where: {
      status: { in: ["sent", "sending"] },
      OR: [
        { sentAt: { gte: dayStart } },
        { sentAt: null, claimedAt: { gte: dayStart } },
      ],
    },
  });
}

/** משחררת שורות שנתבעו ואיש לא דיווח עליהן. */
async function reclaimAbandoned(): Promise<void> {
  await prisma.emailMessage.updateMany({
    where: {
      status: "sending",
      claimedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) },
    },
    data: { status: "queued", claimedAt: null },
  });
}

export interface ClaimedMail {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
}

/**
 * תובעת שורות לשליחה.
 *
 * ⚠️ שלוש הבלימות הן "לא לתבוע" ולא "לבטל": התור נשמר וממשיך
 * להתנקז כשהתנאי חוזר, בדיוק כמו בתור הוואטסאפ.
 *
 * ⚠️ **התביעה היא `updateMany` מותנה על `status: "queued"`,** ולכן
 * שתי הרצות במקביל אינן שולחות את אותה שורה פעמיים. זה מה שמאפשר
 * לתלות את הניקוז על תקתוק קיים בלי לפחד מחפיפה.
 */
export async function claimMail(
  settings: MailerSettingsView,
): Promise<ClaimedMail[]> {
  if (settings.paused) return [];
  if (!insideSendWindow(Date.now(), settings)) return [];

  await reclaimAbandoned();

  const room = roomForTick(settings, await sentMailToday());
  if (room <= 0) return [];

  const candidates = await prisma.emailMessage.findMany({
    where: { status: "queued", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: room,
    select: { id: true },
  });

  const claimed: ClaimedMail[] = [];
  for (const { id } of candidates) {
    const { count } = await prisma.emailMessage.updateMany({
      where: { id, status: "queued" },
      data: {
        status: "sending",
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (count === 0) continue; // מופע אחר הקדים — לא שלנו

    const row = await prisma.emailMessage.findUnique({
      where: { id },
      select: { id: true, toEmail: true, subject: true, body: true },
    });
    if (row) claimed.push(row);
  }

  return claimed;
}

/**
 * מדווחת תוצאה. `error === null` = הצלחה.
 *
 * ⚠️ כישלון חוזר לתור עד `MAX_ATTEMPTS`, ואחריו `failed`. שורה
 * שממשיכה לנסות לנצח היא שורה שאיש לא רואה שנתקעה.
 */
export async function reportMail(
  id: string,
  error: string | null,
): Promise<void> {
  if (!error) {
    await prisma.emailMessage.update({
      where: { id },
      data: { status: "sent", sentAt: new Date(), lastError: null },
    });
    await closeCampaignIfDone(id);
    return;
  }

  const row = await prisma.emailMessage.findUnique({
    where: { id },
    select: { attempts: true },
  });
  const giveUp = (row?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;

  await prisma.emailMessage.update({
    where: { id },
    data: {
      status: giveUp ? "failed" : "queued",
      claimedAt: null,
      lastError: error.slice(0, 500),
      scheduledFor: giveUp ? undefined : new Date(Date.now() + RETRY_DELAY_MS),
    },
  });

  if (giveUp) await closeCampaignIfDone(id);
}

/**
 * מסמנת קמפיין כגמור כשלא נשארה בו שורה ממתינה.
 *
 * ⚠️ נגזר מהתור ולא ממונה: מונה שנשמר בשדה יכול לסתור את התור, וזו
 * בדיוק הסיבה ש-`EmailCampaign` מחזיק רק את `totalCount`.
 */
async function closeCampaignIfDone(messageId: string): Promise<void> {
  const row = await prisma.emailMessage.findUnique({
    where: { id: messageId },
    select: { campaignId: true },
  });
  if (!row) return;

  const pending = await prisma.emailMessage.count({
    where: {
      campaignId: row.campaignId,
      status: { in: ["queued", "sending"] },
    },
  });
  if (pending > 0) return;

  await prisma.emailCampaign.updateMany({
    where: { id: row.campaignId, status: "sending" },
    data: { status: "done" },
  });
}

/** קריאת ההגדרות, לנוחות הניקוז. */
export { readMailerSettings };
