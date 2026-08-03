"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireSessionUser } from "@/server/auth/session";
import { writeSettings } from "@/server/whatsapp/settings";
import type { ActionResult } from "./actions";

/**
 * שליטה בבוט הוואטסאפ ממסך הניהול.
 *
 * ⚠️ כל פעולה כאן בודקת הרשאה בעצמה ולא נשענת על כך שהמסך מוסתר.
 * `/admin/page.tsx` חוסם את **הרינדור**, אבל server action היא נקודת
 * קצה HTTP לכל דבר: מי שמכיר את המזהה יכול לקרוא לה ישירות בלי לטעון
 * את המסך. זה בדיוק הפער שהיה קיים במסך הזה עצמו לפני שנוסף לו
 * `requireSessionUser`.
 */
const ALLOWED = ["owner", "manager"] as const;

async function requireManager(): Promise<{ id: string } | null> {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) return null;
  return { id: actor.id };
}

const DENIED = { ok: false, error: "אין לך הרשאה לשלוט בבוט" } as const;

/**
 * מתג ההשבתה.
 *
 * עצירה **לא מבטלת** שורות ולא מרוקנת את התור — היא רק מונעת תביעה.
 * זו ההתנהגות שמנהל מצפה לה: "עצור" הוא פעולה הפיכה, ומה שהצטבר
 * בינתיים ממתין. הביטול היחיד שקורה בזמן עצירה הוא של תזכורות שעברו
 * 48 שעות, וזה נכון — הן כבר לא רלוונטיות.
 */
export async function setBotPausedAction(
  paused: boolean,
  reason?: string,
): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  await writeSettings(
    {
      paused,
      pausedReason: paused ? reason?.trim().slice(0, 200) || null : null,
      pausedAt: paused ? new Date() : null,
    },
    actor.id,
  );

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * חלון השליחה.
 *
 * הבדיקה `start < end` היא לא קוסמטית: חלון הפוך (21→8) גורם ל-
 * `insideSendWindow` להחזיר false בכל שעה ביממה, כלומר משבית את הבוט
 * לגמרי — אבל בשקט, בלי שהרצועה במסך תיראה אדומה. כשל שקט הוא בדיוק
 * מה שהמסך הזה נועד למנוע.
 */
export async function setBotWindowAction(
  startHour: number,
  endHour: number,
): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  const ok = (h: number) => Number.isInteger(h) && h >= 0 && h <= 23;
  if (!ok(startHour) || !ok(endHour)) {
    return { ok: false, error: "שעה חייבת להיות מספר שלם בין 0 ל-23" };
  }
  if (startHour >= endHour) {
    return { ok: false, error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" };
  }

  await writeSettings(
    { sendWindowStartHour: startHour, sendWindowEndHour: endHour },
    actor.id,
  );

  revalidatePath("/admin");
  return { ok: true };
}

/** תקרת ההודעות היומית. 0 = בלי תקרה. */
export async function setBotDailyCapAction(cap: number): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  if (!Number.isInteger(cap) || cap < 0 || cap > 10_000) {
    return { ok: false, error: "תקרה חייבת להיות מספר שלם בין 0 ל-10,000" };
  }

  await writeSettings({ dailyCap: cap }, actor.id);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * ביטול הודעה ממתינה.
 *
 * מותנה על `status: "queued"` ולא `update` לפי מזהה בלבד — בין רגע
 * הרינדור של המסך לרגע הלחיצה הבוט עשוי כבר לתבוע את השורה ולשלוח
 * אותה. `updateMany` מותנה הופך את המרוץ הזה לכישלון גלוי במקום
 * ל"ביטלתי" מדומה על הודעה שכבר יצאה.
 */
export async function cancelQueuedMessageAction(
  id: string,
): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  const { count } = await prisma.whatsAppMessage.updateMany({
    where: { id, status: "queued" },
    data: { status: "cancelled", lastError: "בוטל ידנית ממסך הניהול" },
  });

  if (count === 0) {
    return { ok: false, error: "ההודעה כבר נשלחה או בוטלה" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * ניסיון חוזר להודעה שנכשלה.
 *
 * מאפס את מונה הניסיונות: בלעדיו שורה שהגיעה ל-3 כישלונות הייתה
 * נתבעת ומיד מסומנת `failed` שוב על ידי `reclaimAbandoned`, כלומר
 * הכפתור היה נראה כאילו הוא לא עושה כלום.
 *
 * `scheduledFor` נדחף לעכשיו כדי שהשורה לא תיתפס כ"ישנה מ-48 שעות"
 * ותבוטל בסקר הבא — שזה מה שקורה לכל כישלון שמנסים לשחזר למחרת.
 */
export async function retryFailedMessageAction(
  id: string,
): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  const { count } = await prisma.whatsAppMessage.updateMany({
    where: { id, status: "failed" },
    data: {
      status: "queued",
      attempts: 0,
      lastError: null,
      claimedAt: null,
      scheduledFor: new Date(),
    },
  });

  if (count === 0) return { ok: false, error: "ההודעה כבר לא במצב כישלון" };

  revalidatePath("/admin");
  return { ok: true };
}
