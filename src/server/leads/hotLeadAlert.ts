import "server-only";

import { prisma } from "@/server/db/client";
import { db } from "@/server/repositories";
import { hotLeadDedupeKey } from "@/lib/domain/alerts";
import {
  HOT_BATCH_WINDOW_MS,
  hotBatchAppend,
  hotBatchBody,
  hotBatchDedupeKey,
  hotBatchKeyPrefix,
} from "@/lib/domain/hotLeadBatch";
import { phoneTargets } from "@/server/whatsapp/recipients";
import { canLeadTeam } from "@/lib/domain/permissions";
import type { User } from "@/lib/domain/types";

/**
 * ── התראה על ליד חם שהגיע לעובד ───────────────────────────────────────
 *
 * העובד מקבל וואטסאפ ברגע שליד חם נוחת אצלו — מקליטה אוטומטית, משיוך
 * ידני של מנהל, או משינוי שיוך.
 *
 * ⚠️⚠️ **ההתראה יוצאת כמקבץ ולא אחת לכל ליד.** התבנית רשומה במטא
 * כ-MARKETING, ולכן כל הודעה נגרעת ממכסת ההודעות השיווקיות של הנמען;
 * עובד שקיבל שישה לידים בשתי דקות חצה אותה וקיבל אפס. איחוד לחלון
 * של חמש דקות מכווץ 153 הודעות ל-77 על נתוני 30 יום. ראה
 * `lib/domain/hotLeadBatch.ts`.
 *
 * ⚠️ **לא זורקת לעולם.** היא נקראת אחרי שהשיוך כבר נשמר, ומכשלון
 * בהתראה אסור שיבטל אותו או יחזיר שגיאה למי שביצע.
 */
export async function notifyHotLeadAssigned(input: {
  lead: { id: string; name: string; phone: string; kind: string };
  assigneeId: string | null | undefined;
  /**
   * מי ביצע את השיוך, כשיש כזה.
   *
   * ⚠️ עובד ששייך ליד לעצמו לא מקבל הודעה: הוא יושב מול המסך ובדיוק
   * לחץ על הכפתור. התראה על פעולה שהמשתמש עשה בעצמו היא הדרך
   * המהירה ביותר ללמד אותו להתעלם מההתראות.
   */
  actorId?: string;
}): Promise<void> {
  try {
    if (input.lead.kind !== "hot") return;
    if (!input.assigneeId) return;
    if (input.actorId && input.actorId === input.assigneeId) return;

    const user = await db.users.getById(input.assigneeId);
    if (!user?.active) return;

    await announceTo(user, input.lead, input.lead.name);

    /*
     * ── עותק לבעל העסק ─────────────────────────────────────────────
     *
     * עובד שמשויך לבעל עסק (`teamOwnerId`) — גם בעל העסק מקבל את
     * הליד, עם שם העובד לצד הלקוח, כדי לדעת מה נכנס לצוות שלו ולמי.
     *
     * ⚠️ אותה תבנית ואותו מקבץ, ולא תבנית חדשה: תבנית נוספת במטא היא
     * אישור חדש, וזו כבר מאושרת. ⚠️ לא כשבעל העסק הוא שביצע את
     * השיוך — אותו כלל כמו לעובד שמשייך לעצמו.
     */
    if (user.teamOwnerId && user.teamOwnerId !== input.actorId) {
      const teamOwner = await db.users.getById(user.teamOwnerId);
      if (teamOwner?.active && canLeadTeam(teamOwner.role)) {
        await announceTo(teamOwner, input.lead, `${input.lead.name} ← ${user.name}`);
      }
    }
  } catch (error) {
    console.error("[hot] התראת ליד חם נכשלה:", error);
  }
}

/**
 * מכניסה את הליד למקבץ של נמען אחד, בכל המספרים שלו — פעם אחת לתמיד.
 *
 * `label` הוא מה שנכתב בהודעה במקום שם הלקוח: לעובד — השם, לבעל
 * העסק — השם ולמי מהצוות הוא הגיע.
 */
async function announceTo(
  user: User,
  lead: { id: string; phone: string },
  label: string,
): Promise<void> {
  // ⚠️ `User` של הדומיין מחזיק `undefined` ו-`PhoneOwner` מחזיק
  // `null`. אותה משמעות, שני טיפוסים — ההמרה כאן ולא בחתימה של
  // `phoneTargets`, שמשרתת גם קוראים שבאים ישירות מ-Prisma.
  const owner = {
    phone: user.phone ?? null,
    extraPhones: user.extraPhones,
  };

  for (const target of phoneTargets(owner)) {
    const announced = await markAnnounced(
      `${hotLeadDedupeKey(lead.id, user.id)}${target.keySuffix}`,
      lead.id,
      user.id,
      target.toPhone,
    );
    // כבר הוכרז לנמען הזה בעבר — לא נכנס למקבץ שוב
    if (!announced) continue;

    await addToBatch(user.id, target.toPhone, { name: label, phone: lead.phone });
  }
}

/**
 * רושמת שהליד הוכרז לעובד, ומחזירה `false` אם כבר היה רשום.
 *
 * ⚠️⚠️ **שורה במצב `cancelled` ולא רשומה בטבלה נפרדת.** מה שנדרש כאן
 * הוא בדיוק מה שאילוץ הייחודיות על `dedupeKey` כבר עושה, וטבלה
 * נוספת הייתה מוסיפה מיגרציה ומצב שאפשר לשכוח לנקות. השורה גם
 * שומרת על הקישור ל-`leadId` ומופיעה בהיסטוריה במסך הבוטים, כך
 * שרואים מה אוחד ולאן.
 *
 * ⚠️ בלי הסמן הזה האיחוד היה מוריד את ההבטחה של `hotLeadDedupeKey` —
 * "ליד מוכרז לעובד פעם אחת, לתמיד" — ל"פעם אחת לכל חלון". עובד
 * שקיבל ליד, החזיר אותו וקיבל שוב היה מקבל התראה שנייה.
 */
async function markAnnounced(
  dedupeKey: string,
  leadId: string,
  userId: string,
  toPhone: string,
): Promise<boolean> {
  try {
    await prisma.whatsAppMessage.create({
      data: {
        dedupeKey,
        toPhone,
        body: "",
        status: "cancelled",
        lastError: "אוחדה למקבץ",
        scheduledFor: new Date(),
        leadId,
        recipientUserId: userId,
      },
    });
    return true;
  } catch {
    // הפרת ייחודיות = הליד כבר הוכרז לעובד הזה. זה המצב הרגיל
    // בשיוך חוזר, ולא שגיאה.
    return false;
  }
}

/**
 * מוסיפה את הליד למקבץ הפתוח של העובד, או פותחת מקבץ חדש.
 *
 * ⚠️⚠️ **העדכון מותנה על `status = 'queued'` בשאילתה עצמה.** ליד שנכנס
 * בדיוק ברגע שהמקבץ נתבע לשליחה מוצא `count = 0` ופותח מקבץ חדש,
 * במקום להתווסף לגוף של הודעה שכבר בדרך החוצה — כלומר ללכת לאיבוד.
 * זה אותו אידיום שבו `claim` תובע שורות.
 *
 * ⚠️ **החלון עוגן בליד הראשון ולא בשעון.** דליים קבועים על השעון
 * מפצלים צרור שחוצה גבול דלי, ודווקא הצרורות הם מה שיש לאחד.
 *
 * ⚠️ מרוץ אפשרי: שני לידים בו-זמנית יכולים לפתוח שני מקבצים. זה
 * שפיר — התוצאה הגרועה ביותר היא שתי הודעות, כלומר בדיוק ההתנהגות
 * שהייתה קודם. אתר הקריאה הכבד ביותר (שיוך קבוצתי) קורא בלולאה עם
 * `await` סדרתי, ולכן שם המרוץ אינו קיים כלל.
 */
async function addToBatch(
  userId: string,
  toPhone: string,
  lead: { name: string; phone: string },
): Promise<void> {
  const open = await prisma.whatsAppMessage.findFirst({
    where: {
      dedupeKey: { startsWith: hotBatchKeyPrefix(userId) },
      toPhone,
      status: "queued",
    },
    orderBy: { scheduledFor: "desc" },
    select: { id: true, body: true },
  });

  if (open) {
    const { count } = await prisma.whatsAppMessage.updateMany({
      where: { id: open.id, status: "queued" },
      data: { body: hotBatchAppend(open.body, lead.name, lead.phone) },
    });
    if (count > 0) return;
    // המקבץ נתבע בינתיים — נופלים לפתיחת מקבץ חדש
  }

  const openedAt = Date.now();
  await prisma.whatsAppMessage.create({
    data: {
      dedupeKey: hotBatchDedupeKey(userId, openedAt),
      toPhone,
      body: hotBatchBody(lead.name, lead.phone),
      // ⚠️ סוף החלון, לא עכשיו. חלון השליחה עצמו נאכף ב-`claim`;
      // מקבץ שנפתח בלילה מחכה לבוקר בלי שנחשב את השעה כאן פעמיים.
      scheduledFor: new Date(openedAt + HOT_BATCH_WINDOW_MS),
      // ⚠️ בלי `leadId`: המקבץ מכיל כמה לידים, ושדה יחיד היה בוחר
      // אחד מהם שרירותית. הקישור לכל ליד נשמר בשורות הסמן.
      recipientUserId: userId,
    },
  });
}
