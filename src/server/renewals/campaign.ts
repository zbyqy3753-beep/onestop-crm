import "server-only";

import { prisma } from "@/server/db/client";
import { parseDocument } from "./parse";
import { parseReply } from "./reply";
import {
  renewalConfirmation,
  renewalDeclineAck,
  renewalOpener,
  renewalOptOutAck,
  renewalUnclearAck,
} from "@/lib/domain/renewalMessages";

/**
 * מנוע קמפיין החידושים.
 *
 * זרימה מלאה: מסמך → אנשי קשר → אישור אדם → הודעה ללקוח → תשובה →
 * שעה מוסכמת → ליד.
 *
 * ⚠️ **אין כאן שליחה אוטומטית.** חילוץ אנשי הקשר לא מוציא שום הודעה;
 * צריך אישור מפורש במסך. זה מכוון: המקור הוא PDF שנקרא ע"י פרסר,
 * וטעות חילוץ שקטה שהופכת מיד להודעה ללקוח אמיתי היא בדיוק סוג
 * התקלה שאי אפשר לבטל אחרי שקרתה.
 */

/**
 * כמה זמן איש קשר חוסם הוספה מחדש של אותו מספר.
 *
 * ⚠️ החסימה הייתה **לנצח**, וזו הייתה טעות. לקוח שתקופת ההטבה שלו
 * נגמרת שוב בשנה הבאה הוא מועמד לגיטימי לקמפיין חדש — אבל הוא נדחה
 * כ"כבר קיים" בלי שום דרך להחזיר אותו חוץ ממחיקה ידנית במסד. כלומר
 * הזרימה כולה הייתה חד-פעמית לכל לקוח, לתמיד.
 *
 * תשעים יום מכסים בנוחות מחזור קמפיין אחד ואת כל הזנב שלו, ורחוקים
 * מספיק מהמחזור הבא.
 */
const REENTRY_BLOCK_DAYS = 90;

/**
 * חילוץ אנשי קשר ממסמך שכבר נקרא.
 *
 * ⚠️ מדלג על מספר שכבר קיים כאיש קשר פעיל, או שנוצר לאחרונה — גם
 * ממסמך אחר. לקוח שמופיע בשתי חשבוניות (סלולר ואינטרנט) הוא אדם אחד,
 * ושתי הודעות זהות מאותו מספר הן מה שהופך דיוור לגיטימי לתלונה.
 *
 * ⚠️ "פעיל" נבדק **בנוסף** לחלון הזמן ולא במקומו: איש קשר שממתין
 * לתשובה כבר חצי שנה עדיין באמצע שיחה, ואסור לפתוח לו שיחה שנייה.
 */
export async function extractContacts(documentId: string): Promise<{
  created: number;
  skippedPages: number[];
  duplicates: string[];
}> {
  const doc = await prisma.renewalDocument.findUnique({
    where: { id: documentId },
    select: { id: true, extractedText: true },
  });
  if (!doc?.extractedText) {
    return { created: 0, skippedPages: [], duplicates: [] };
  }

  const { contacts, skippedPages } = parseDocument(doc.extractedText);

  const phones = contacts.map((c) => c.phone);
  const cutoff = new Date(Date.now() - REENTRY_BLOCK_DAYS * 86_400_000);
  const taken = new Set(
    (
      await prisma.renewalContact.findMany({
        where: {
          phone: { in: phones },
          OR: [
            // באמצע שיחה — בלי קשר לכמה זמן עבר
            { status: { in: ["pending", "queued", "awaitingReply", "needsReview"] } },
            // או פשוט טרי מדי מכדי לפנות שוב
            { createdAt: { gte: cutoff } },
          ],
        },
        select: { phone: true },
      })
    ).map((r) => r.phone),
  );

  /*
   * ⚠️ מי שביקש הסרה לא נכנס בחזרה.
   *
   * זה הסגר האמיתי של בקשת ההסרה: בלעדיו הלקוח מוסר מהדיוור, ובעוד
   * חודש מישהו מעלה PDF חדש שהוא מופיע בו — והוא חוזר לרשימה כאילו
   * לא ביקש כלום. הסינון כאן, ולא רק בשליחה, כדי שהוא גם לא יוצג
   * במסך כמועמד לאישור.
   */
  const suppressed = new Set(
    (
      await prisma.renewalOptOut.findMany({
        where: { phone: { in: phones } },
        select: { phone: true },
      })
    ).map((r) => r.phone),
  );

  let created = 0;
  const duplicates: string[] = [];

  for (const [i, c] of contacts.entries()) {
    if (suppressed.has(c.phone)) continue;
    if (taken.has(c.phone)) {
      duplicates.push(c.name);
      continue;
    }
    taken.add(c.phone);

    try {
      await prisma.renewalContact.create({
        data: {
          documentId: doc.id,
          pageIndex: i,
          name: c.name,
          phone: c.phone,
          city: c.city,
          email: c.email,
          provider: c.provider,
          packageName: c.packageName,
          serviceType: c.serviceType,
          currentPrice: c.currentPrice,
          futurePrice: c.futurePrice,
          contractEndsAt: c.contractEndsAt,
          rawText: c.rawText,
        },
      });
      created++;
    } catch {
      // הפרת ייחודיות על (documentId, pageIndex) — כבר חולץ בעבר
    }
  }

  return { created, skippedPages, duplicates };
}

function dedupeKeyFor(contactId: string, step: string): string {
  return `renewal:${step}:${contactId}`;
}

/**
 * מכניס לתור הודעה ללקוח.
 *
 * ⚠️ `leadId`/`recipientUserId` נשארים ריקים — התור משותף עם תזכורות
 * העובדים, ושתי השורות האלה מצביעות על **עובדים**. איש קשר בקמפיין
 * אינו עובד ואינו ליד (עדיין), והצבעה שגויה שם הייתה מציגה במסך
 * הבוטים שההודעה נשלחה למישהו אחר.
 */
async function enqueue(
  contactId: string,
  step: string,
  toPhone: string,
  body: string,
): Promise<boolean> {
  try {
    await prisma.whatsAppMessage.create({
      data: {
        dedupeKey: dedupeKeyFor(contactId, step),
        toPhone,
        body,
        scheduledFor: new Date(),
      },
    });
    return true;
  } catch {
    // כבר בתור או כבר נשלח — no-op מכוון
    return false;
  }
}

/** מאשר אנשי קשר ומכניס את ההודעה הראשונה לתור. */
export async function approveAndQueue(ids: string[]): Promise<number> {
  const contacts = await prisma.renewalContact.findMany({
    where: { id: { in: ids }, status: "pending" },
  });

  /*
   * ⚠️ שער שני, אחרי זה שב-`extractContacts`.
   *
   * החילוץ מסנן לפי רשימת ההסרה, אבל איש קשר יכול היה להיחלץ **לפני**
   * שהוא ביקש הסרה ולהמתין באישור מאז. זו הנקודה האחרונה לפני שהודעה
   * נכנסת לתור, ולכן היא זו שחייבת להיות אטומה.
   */
  const suppressed = new Set(
    (
      await prisma.renewalOptOut.findMany({
        where: { phone: { in: contacts.map((c) => c.phone) } },
        select: { phone: true },
      })
    ).map((r) => r.phone),
  );

  let queued = 0;
  for (const c of contacts) {
    if (suppressed.has(c.phone)) {
      await prisma.renewalContact.update({
        where: { id: c.id },
        data: { status: "optedOut" },
      });
      continue;
    }

    const body = renewalOpener({ name: c.name });

    await enqueue(c.id, "opener", c.phone, body);
    await prisma.renewalContact.update({
      where: { id: c.id },
      data: { status: "queued" },
    });
    queued++;
  }
  return queued;
}

/**
 * מסמן שההודעה הראשונה יצאה בפועל.
 *
 * נקרא מ-`report` של הבוט, ולא בזמן ההכנסה לתור: "נשלח" צריך להיות
 * מה שקרה, לא מה שתוכנן. מחשב כבוי במשרד היה משאיר אנשי קשר במצב
 * "ממתין לתשובה" בלי ששום הודעה יצאה.
 */
export async function markOpenerSent(dedupeKeys: string[]): Promise<void> {
  const ids = dedupeKeys
    .filter((k) => k.startsWith("renewal:opener:"))
    .map((k) => k.slice("renewal:opener:".length));
  if (ids.length === 0) return;

  await prisma.renewalContact.updateMany({
    where: { id: { in: ids }, status: "queued" },
    data: { status: "awaitingReply", sentAt: new Date() },
  });
}

export interface InboundOutcome {
  matched: boolean;
  intent: string;
  contactName?: string;
}

/**
 * קליטת תשובה מלקוח — הלב של הזרימה.
 *
 * ⚠️ ההודעה נשמרת **תמיד**, גם כשאין איש קשר תואם. הודעה ממספר לא
 * מוכר עדיין עשויה להיות "הסר", וזו בקשה שחייבים לתעד ולכבד גם בלי
 * לדעת מי שלח אותה.
 */
/**
 * מכבד בקשת הסרה — בלי תלות בשאלה אם מוכר לנו מי שלח אותה.
 *
 * ⚠️ שלושה חלקים, וכל אחד מהם היה חסר וגרם ל"שולחים הסר ולא קורה כלום":
 *
 * 1. **רישום ברשימת ההסרה.** קודם ההסרה הייתה רק סטטוס על איש הקשר,
 *    ולכן מספר שאינו איש קשר פעיל (או שהמסמך שלו נמחק) פשוט לא נרשם
 *    בשום מקום — והעלאת ה-PDF הבאה הייתה מכניסה אותו חזרה.
 * 2. **ביטול מה שכבר בתור.** אם ההודעה הראשונה עדיין ממתינה לשליחה,
 *    היא הייתה יוצאת **אחרי** שהלקוח ביקש להפסיק. זו ההפרה הגרועה
 *    ביותר בזרימה, והיא הייתה קורית בשקט מוחלט.
 * 3. **אישור ללקוח.** בלעדיו הוא לא יודע שהבקשה נקלטה, וההתנהגות
 *    הסבירה שלו היא לחסום ולדווח.
 */
async function honorOptOut(
  phone: string,
  body: string,
  contactId?: string,
): Promise<void> {
  await prisma.renewalOptOut.upsert({
    where: { phone },
    create: { phone, body: body.slice(0, 500) },
    update: {},
  });

  // ⚠️ `queued` בלבד. שורה ב-`sending` כבר נתבעה ע"י הבוט ואולי כבר
  // יצאה בפועל; סימונה כמבוטלת היה יוצר תיעוד שקרי של מה שנשלח.
  await prisma.whatsAppMessage.updateMany({
    where: { toPhone: phone, status: "queued" },
    data: { status: "cancelled", lastError: "בקשת הסרה מהלקוח" },
  });

  if (contactId) {
    await prisma.renewalContact.update({
      where: { id: contactId },
      data: { status: "optedOut" },
    });
  }

  // מפתח הדדופ נגזר מאיש הקשר; בלעדיו אין למה לתלות את האישור, ולכן
  // נופלים למספר עצמו — הוא ייחודי לא פחות
  await enqueue(contactId ?? `phone:${phone}`, "optout", phone, renewalOptOutAck());
}

export async function handleInbound(input: {
  waMessageId: string;
  fromPhone: string;
  body: string;
  receivedAt: Date;
}): Promise<InboundOutcome> {
  /*
   * ⚠️ **בלי סינון סטטוס.** הגרסה הקודמת חיפשה רק
   * `awaitingReply | needsReview | scheduled`, ולכן "הסר" מלקוח
   * שההודעה אליו עדיין בתור (`queued`), או שכבר סירב (`declined`),
   * לא מצא כלום ונפל לענף "מספר לא מוכר" — כלומר לא עשה דבר.
   * המספר הוא הזהות; הסטטוס הוא רק המקום בזרימה.
   */
  const contact = await prisma.renewalContact.findFirst({
    where: { phone: input.fromPhone },
    orderBy: { createdAt: "desc" },
  });

  const intent = parseReply(input.body, input.receivedAt.getTime());

  try {
    await prisma.whatsAppInbound.create({
      data: {
        waMessageId: input.waMessageId,
        fromPhone: input.fromPhone,
        body: input.body.slice(0, 2000),
        receivedAt: input.receivedAt,
        contactId: contact?.id,
        parsed: intent.kind,
      },
    });
  } catch {
    // אותה הודעה דווחה פעמיים — כבר טופלה, ואין לעבד שוב
    return { matched: !!contact, intent: "duplicate" };
  }

  /*
   * ⚠️ ההסרה מטופלת **לפני** הבדיקה אם יש איש קשר, ולא בתוך ה-switch.
   *
   * זה היה הבאג: השורה הבאה החזירה מוקדם כשלא נמצא איש קשר, ולכן
   * "הסר" ממספר לא מוכר נשמר ביומן ההודעות הנכנסות — ומעולם לא כובד.
   * ההערה מעל הפונקציה הבטיחה "לתעד ולכבד"; הקוד רק תיעד.
   */
  if (intent.kind === "optOut") {
    await honorOptOut(input.fromPhone, input.body, contact?.id);
    return {
      matched: !!contact,
      intent: intent.kind,
      contactName: contact?.name,
    };
  }

  /*
   * ⚠️ הסרה גוברת על כל מה שיגיע אחריה.
   *
   * נצפה בלוג של הייצור: לקוח שלח "הסר" ב-11:56:58, ושלוש-עשרה שניות
   * אחר כך שלח "5". ההודעה השנייה פוענחה כשעה, נקבעה לו שיחה, והסטטוס
   * חזר מ-`optedOut` ל-`scheduled` — כלומר המערכת **ביטלה בעצמה** את
   * בקשת ההסרה שהיא בדיוק כיבדה, ובנתה מסלול לשלוח לו עוד הודעות.
   *
   * ההודעה עדיין נשמרת ביומן הנכנסות (זה קרה למעלה), אבל שום פעולה
   * לא ננקטת ושום תשובה לא יוצאת. אדם שמשנה את דעתו יפנה לנציג.
   */
  const suppressed = await prisma.renewalOptOut.findUnique({
    where: { phone: input.fromPhone },
    select: { phone: true },
  });
  if (suppressed) {
    return { matched: !!contact, intent: "suppressed", contactName: contact?.name };
  }

  if (!contact) return { matched: false, intent: intent.kind };

  await prisma.renewalContact.update({
    where: { id: contact.id },
    data: {
      lastInboundAt: input.receivedAt,
      lastInboundText: input.body.slice(0, 500),
    },
  });

  switch (intent.kind) {
    case "decline":
      await prisma.renewalContact.update({
        where: { id: contact.id },
        data: { status: "declined" },
      });
      await enqueue(contact.id, "decline", contact.phone, renewalDeclineAck());
      break;

    case "time":
      await scheduleFromReply(contact.id, intent.at, intent.label);
      break;

    case "unclear":
      await prisma.renewalContact.update({
        where: { id: contact.id },
        data: { status: "needsReview" },
      });
      await enqueue(contact.id, "unclear", contact.phone, renewalUnclearAck());
      break;
  }

  return { matched: true, intent: intent.kind, contactName: contact.name };
}

/**
 * הלקוח נקב בשעה → נוצר ליד עם תאריך חזרה.
 *
 * ⚠️ כאן הזרימה מתחברת למה שכבר קיים: הליד מקבל `followUpAt`, ומנוע
 * התזכורות ששלח עד היום רק תזכורות פנימיות ישלח לעובד המשויך את כל
 * פרטי הלקוח עשר דקות לפני השיחה. אין כאן מנגנון תזמון חדש.
 *
 * הליד נוצר **בלי שיוך**: חלוקת לידים לעובדים היא החלטה ניהולית,
 * והבוט לא אמור לקבל אותה. עד שישויך, "צפויות" במסך הבוטים יראה
 * אותו כחסום עם הסיבה.
 */
async function scheduleFromReply(
  contactId: string,
  at: number,
  label: string,
): Promise<void> {
  const contact = await prisma.renewalContact.findUnique({
    where: { id: contactId },
  });
  if (!contact) return;

  // מי נרשם כיוצר הליד — הבעלים, כי אין כאן משתמש מחובר
  const creator = await prisma.user.findFirst({
    where: { role: "owner", active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!creator) return;

  const followUpAt = new Date(at);

  const lead = contact.leadId
    ? await prisma.lead.update({
        where: { id: contact.leadId },
        data: { followUpAt },
      })
    : await prisma.lead.create({
        data: {
          name: contact.name,
          // ⚠️ הליד שומר מספר ישראלי מקומי ולא E.164 — זה מה שכל
          // המערכת מצפה לו (`isIsraeliPhone`, `waLink`, ייבוא CSV)
          phone: contact.phone.replace(/^972/, "0"),
          email: contact.email,
          city: contact.city,
          status: "recycled",
          category: "recycled",
          kind: "hot",
          source: "campaign",
          sourceDetail: [contact.provider, "חידוש"].filter(Boolean).join(" · "),
          packageName: contact.packageName,
          followUpAt,
          createdById: creator.id,
          // עלות 0 — לקוח עבר, כבר שילמנו על רכישתו פעם אחת
          cost: 0,
        },
      });

  /*
   * ⚠️ הערה ולא רק `followUpAt`.
   *
   * מה שהובטח ללקוח הוא **טווח** ("מחר בין 08:00 ל-09:00"), אבל
   * `followUpAt` הוא נקודה אחת — תחילת הטווח, כי כל המערכת (המיון,
   * "לחזור היום", תור התזכורות) נשענת על נקודה. בלי ההערה הזו הנציג
   * היה רואה 08:00 ומניח שזו התחייבות מדויקת, ולא יודע שיש לו שעה.
   *
   * לקוח שמזיז את השעה מקבל הערה נוספת, וזה בדיוק הרצוי — נשאר תיעוד
   * של מה שהובטח ומתי.
   */
  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      authorId: creator.id,
      body: `הלקוח ביקש שנחזור אליו ${label}.`,
    },
  });

  await prisma.renewalContact.update({
    where: { id: contactId },
    data: { status: "scheduled", agreedAt: followUpAt, leadId: lead.id },
  });

  await enqueue(contactId, `confirm:${at}`, contact.phone, renewalConfirmation(label));
}
