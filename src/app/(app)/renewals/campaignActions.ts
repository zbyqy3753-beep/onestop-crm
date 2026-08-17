"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/server/db/client";
import { drainOutbox } from "@/server/whatsapp/drain";
import { requireSessionUser } from "@/server/auth/session";
import { approveAndQueue, extractContacts } from "@/server/renewals/campaign";
import { renewalOpener } from "@/lib/domain/renewalMessages";
import type { ActionResult } from "@/app/(app)/admin/actions";

/**
 * פעולות קמפיין החידושים.
 *
 * ⚠️ כל פעולה בודקת הרשאה בעצמה — server action היא נקודת קצה HTTP,
 * והסתרת המסך אינה הרשאה. כאן זה חמור מהרגיל: `approveContactsAction`
 * היא הפעולה היחידה במערכת ששולחת הודעה **ללקוח אמיתי**.
 */
const ALLOWED = ["owner", "manager"] as const;

async function requireManager(): Promise<{ id: string } | null> {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) return null;
  return { id: actor.id };
}

const DENIED = { ok: false, error: "אין לך הרשאה לפעולה הזו" } as const;

export interface ExtractSummary {
  created: number;
  skippedPages: number[];
  duplicates: string[];
}

/** חילוץ אנשי קשר ממסמך. **לא** שולח כלום. */
export async function extractContactsAction(
  documentId: string,
): Promise<ActionResult<ExtractSummary>> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  const summary = await extractContacts(documentId);
  revalidatePath("/renewals");
  return { ok: true, data: summary };
}

/**
 * אישור ושליחה.
 *
 * ⚠️ הרגע היחיד שבו הודעה יוצאת ללקוח, ולכן הוא מפורש ונפרד מהחילוץ.
 * המקור הוא PDF שנקרא ע"י פרסר, וטעות חילוץ שקטה שהופכת ישירות
 * להודעה ללקוח אמיתי היא בדיוק סוג התקלה שאי אפשר לבטל.
 */
export async function approveContactsAction(
  ids: string[],
): Promise<ActionResult<{ queued: number }>> {
  const actor = await requireManager();
  if (!actor) return DENIED;
  if (ids.length === 0) return { ok: false, error: "לא נבחרו אנשי קשר" };

  const queued = await approveAndQueue(ids);
  revalidatePath("/renewals");
  revalidatePath("/bots");

  /*
   * ⚠️⚠️ **ניקוז מיידי, ולא המתנה לשעון.**
   *
   * השעון החיצוני (GitHub Actions) מתוזמן ל-5 דקות אבל בפועל רץ כל
   * 25–47 דקות — GitHub מריצים cron כ"מאמץ סביר" ומעכבים אותו בעומס.
   * זה מדיד: ראה `.github/workflows/whatsapp-cron.yml`.
   *
   * המשמעות בלי השורה הזו: מנהל מאשר שליחה, לא קורה כלום במשך חצי
   * שעה, ומסך הבוטים מציג דופק בן 20+ דקות שנראה בדיוק כמו בוט מת.
   * זו הייתה התלונה, וזה התיקון — אישור הוא הרגע שבו ההודעה יוצאת.
   *
   * `after` ולא `await`: השליחה למטא נמשכת שנייה-שתיים להודעה, ואין
   * שום סיבה שהמנהל יסתכל על ספינר בזמן הזה. הקולבק רץ אחרי שהתשובה
   * כבר נשלחה. **לא** promise יתום — ב-serverless הוא היה נקטע.
   *
   * ⚠️ `drainOutbox` מוגבל ל-10 הודעות למחזור (`BATCH`), ולכן קמפיין
   * גדול ישלח 10 מיד והשאר ימתינו לשעון. זה מכוון: תקרה היא מה שמונע
   * מבקשה בודדת לרוץ בלי גבול.
   */
  after(async () => {
    try {
      await drainOutbox();
    } catch {
      // כישלון ניקוז אינו כישלון אישור — השורות כבר בתור והשעון
      // ינסה שוב. זריקה כאן הייתה הופכת אישור מוצלח לשגיאה במסך.
    }
  });

  return { ok: true, data: { queued } };
}

/** מחיקת איש קשר שחולץ שגוי — לפני שיצאה אליו הודעה. */
export async function deleteContactAction(id: string): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  const contact = await prisma.renewalContact.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!contact) return { ok: false, error: "איש הקשר לא נמצא" };

  // ⚠️ מותר למחוק רק לפני שיצאה הודעה. אחרי שדיברנו עם הלקוח, השורה
  // היא הראיה למה נשלח ומה הוא ענה — כולל בקשת הסרה, שחייבים לתעד.
  if (contact.status !== "pending") {
    return { ok: false, error: "אי אפשר למחוק אחרי שיצאה הודעה" };
  }

  await prisma.renewalContact.delete({ where: { id } });
  revalidatePath("/renewals");
  return { ok: true };
}

/**
 * תצוגה מקדימה של ההודעה שתישלח.
 *
 * ⚠️ קוראת לאותה פונקציה שהשליחה קוראת לה, ולא משכפלת את הנוסח.
 * תצוגה מקדימה שנבנית בנפרד מתחילה לשקר ברגע שמישהו משנה נוסח אחד —
 * וזו הפעם היחידה שאדם רואה את הטקסט לפני שהוא מגיע ללקוח.
 */
export async function previewMessageAction(
  id: string,
): Promise<ActionResult<{ body: string }>> {
  const actor = await requireManager();
  if (!actor) return DENIED;

  const c = await prisma.renewalContact.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "איש הקשר לא נמצא" };

  return {
    ok: true,
    data: {
      body: renewalOpener({ name: c.name }),
    },
  };
}
