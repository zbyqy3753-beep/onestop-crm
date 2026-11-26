import "server-only";

import { prisma } from "@/server/db/client";
import { hasOpenServiceWindow } from "@/server/whatsapp/serviceWindow";

/**
 * ניתוחי מאמן השיחות גם בוואטסאפ של אלירן, **רק בחלון השירות החינמי**.
 *
 * מטא מרשה טקסט חופשי בלי תשלום למי שכתב למספר העסקי ב-24 השעות
 * האחרונות. אלירן כותב פעם ביום (למשל "בוקר טוב"), ומאותו רגע כל ניתוח
 * יוצא אליו במלואו. כשהחלון סגור, הניתוח נשאר באפליקציה בלבד, ויוצא
 * בוואטסאפ ברגע שאלירן כותב שוב, כל עוד הוא מהימים האחרונים.
 *
 * ⚠️ בלי תבנית בכוונה: המשתמש בחר בחלון החינמי. תבנית התראה כזו מטא
 * מסווגת MARKETING, ואז חלק מההודעות נחסמות.
 *
 * ⚠️ המפתח `callcoach:<id>` אינו ב-`templateFor` של `drain.ts`, ולכן
 * ההודעה יוצאת שם כ-`sendText`. ייחודיות המפתח מונעת כפילות: הקריאה
 * מה-PATCH ומה-webhook יכולות להתנגש בלי שתצא הודעה פעמיים.
 */

/** ניתוח ישן מזה לא נשלח כשהחלון נפתח: הוא כבר לא רלוונטי לשיחה. */
const BACKLOG_MS = 3 * 24 * 60 * 60 * 1000;

/** תקרת טקסט של וואטסאפ היא 4096 תווים. */
const MAX_BODY = 3900;

/**
 * השורה שמזכירה לאלירן לפתוח את החלון. מתווספת באפליקציה לניתוח העליון
 * בלבד, וכשהחלון סגור בלבד: שורה בכל כרטיס הייתה עומס.
 *
 * ⚠️ המספר הוא המספר השולח של ה-WABA (`One Stop`, phone id
 * 1257118410820972). אם המספר השולח מוחלף, צריך לעדכן גם כאן.
 */
const WINDOW_HINT =
  "💬 רוצה לקבל את הניתוחים גם בוואטסאפ? שלח הודעה כלשהי (למשל \"בוקר טוב\") ל-050-714-1099, ובמשך 24 שעות כל ניתוח יגיע אליך לשם.";

/** מוסיף את התזכורת לניתוח הראשון שמוכן, אם החלון של אלירן סגור. */
export async function withWindowHint<T extends { status: string; analysis: string | null }>(
  rows: T[],
): Promise<T[]> {
  const to = coachWhatsAppPhone();
  if (!to) return rows;
  const first = rows.findIndex((r) => r.status === "done" && r.analysis?.trim());
  if (first < 0) return rows;
  if (await hasOpenServiceWindow(to)) return rows;
  return rows.map((r, i) =>
    i === first ? { ...r, analysis: `${r.analysis!.trim()}\n\n${WINDOW_HINT}` } : r,
  );
}

/** המספר של אלירן כ-972…, או `null` כשלא הוגדר. */
export function coachWhatsAppPhone(): string | null {
  const raw = (process.env.CALLS_COACH_WHATSAPP ?? "").replace(/\D/g, "");
  if (!raw) return null;
  return raw.startsWith("0") ? `972${raw.slice(1)}` : raw;
}

function render(r: { phone: string | null; recordedAt: Date; analysis: string | null }): string {
  const when = r.recordedAt.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const head = `📞 מאמן שיחות: ${r.phone ?? "מספר לא ידוע"} · ${when}`;
  const body = (r.analysis ?? "").trim();
  const text = `${head}\n\n${body}`;
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…\n\n(ההמשך באפליקציה)` : text;
}

/**
 * מכניס לתור הוואטסאפ כל ניתוח מהימים האחרונים שעוד לא נשלח, אם החלון
 * של אלירן פתוח. מחזיר כמה שורות נוספו.
 */
export async function queueCoachWhatsApp(): Promise<number> {
  const to = coachWhatsAppPhone();
  if (!to) return 0;
  if (!(await hasOpenServiceWindow(to))) return 0;

  const recent = await prisma.callRecording.findMany({
    where: {
      status: "done",
      handledAt: { gt: new Date(Date.now() - BACKLOG_MS) },
    },
    orderBy: { handledAt: "asc" },
    select: { id: true, phone: true, recordedAt: true, analysis: true },
  });
  if (recent.length === 0) return 0;

  const now = new Date();
  const { count } = await prisma.whatsAppMessage.createMany({
    data: recent
      .filter((r) => r.analysis?.trim())
      .map((r) => ({
        dedupeKey: `callcoach:${r.id}`,
        toPhone: to,
        body: render(r),
        scheduledFor: now,
      })),
    skipDuplicates: true,
  });
  return count;
}
