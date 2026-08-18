import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db/client";
import { db } from "@/server/repositories";
import { toE164 } from "@/lib/format";
import { resetCodeDedupeKey } from "@/lib/domain/whatsapp";
import {
  CODE_TTL_MS,
  MAX_CODE_ATTEMPTS,
  formatCode,
  isCodeShape,
  maskPhone,
  normalizeCode,
} from "@/lib/resetCode";
import { createSessionToken, hashSessionToken } from "./token";
import { updateAuthUser } from "./supabaseAdmin";

/**
 * ── שחזור סיסמה בקוד ──────────────────────────────────────────────────
 *
 * העובד יוזם ממסך הכניסה, מקבל קוד בוואטסאפ, ומקליד אותו מול המערכת.
 *
 * ⚠️ **למה קוד ולא קישור:** מטא מסווגת הודעת איפוס סיסמה כקטגוריית
 * Authentication, ותבניות בקטגוריה הזו **אינן תומכות בכפתור URL** —
 * רק בהעתקת קוד. ניסיון לשלוח קישור נדחה ב-`INCORRECT_CATEGORY`. זו
 * לא בחירת עיצוב אלא אילוץ פלטפורמה.
 *
 * זרימת הקישור (`passwordReset.ts`) נשארת לצד זו: היא חזקה יותר
 * (256 ביט מול מיליון אפשרויות) ומשמשת כשמנהל מאפס ומעביר ידנית.
 */

/**
 * ⚠️ **פלפל מהסביבה, לא מלח מהמסד.**
 *
 * קוד בן 6 ספרות הוא מיליון אפשרויות. `sha256(code)` שמור במסד נשבר
 * בחיפוש ממצה תוך שבריר שנייה — כלומר מי שמשיג גישת קריאה בלבד היה
 * הופך אותה להשתלטות על כל חשבון. HMAC עם סוד שיושב במשתני הסביבה
 * מנתק את הקשר: דליפת מסד לבדה לא מספיקה.
 *
 * ⚠️ **נכשל סגור.** בלי הסוד לא מונפקים קודים בכלל — קוד שנשמר בלי
 * הגנה אמיתית גרוע מהיעדר האפשרות.
 */
function hashCode(code: string): string {
  const pepper = process.env.PASSWORD_CODE_PEPPER?.trim();
  if (!pepper) {
    throw new Error(
      "PASSWORD_CODE_PEPPER חסר — בלעדיו אי אפשר לאחסן קוד איפוס בבטחה",
    );
  }
  return createHmac("sha256", pepper).update(code).digest("hex");
}

/** השוואה בזמן קבוע — הפרשי זמן מדליפים כמה ספרות נכונות. */
function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * האם לחשבון יש איפוס פתוח שממתין לו.
 *
 * ⚠️ **זה מה שמחליף את הקישור ״שכחת סיסמה?״ במסך הכניסה.** במקום
 * כפתור שכל אחד רואה ולוחץ, מסך ההתחברות בודק את השאלה הזו אחרי
 * ניסיון כניסה כושל: עובד שהסיסמה שלו אופסה מנסה להיכנס כרגיל,
 * נכשל — וההודעה שהוא מקבל היא לא "סיסמה שגויה" אלא הדרך קדימה.
 *
 * ⚠️ נבדק לפי `codeHash: null` — שורת הזכאות שהמנהל יצר, ולא שורת
 * קוד שהונפקה בדרך.
 */
export async function hasOpenReset(email: string): Promise<boolean> {
  const user = await db.users.getByEmail(email);
  if (!user?.active) return false;

  const row = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      codeHash: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { tokenHash: true },
  });
  return Boolean(row);
}

export interface IssuedCode {
  code: string;
  phone: string;
  /** ארבע ספרות אחרונות, להצגה למי שביקש. */
  maskedPhone: string;
  name: string;
  userId: string;
}

/**
 * מנפיק קוד למשתמש לפי שם המשתמש שהוקלד.
 *
 * ⚠️ **מחזיר `null` גם כשהמשתמש לא קיים וגם כשאין לו טלפון**, והמסך
 * מציג את אותה הודעה בשני המקרים. הבחנה ביניהם הופכת את המסך לכלי
 * שמגלה אילו שמות משתמש קיימים בארגון.
 */
export async function issueCode(email: string): Promise<IssuedCode | null> {
  const user = await db.users.getByEmail(email);
  if (!user?.active || !user.phone) return null;

  const phone = toE164(user.phone);
  if (!phone) return null;

  /*
   * ⚠️⚠️ **שער הזכאות: קוד מונפק רק למי שמנהל באמת איפס.**
   *
   * בלי זה המסך היה נקודת קצה פתוחה — מי שמכיר שם משתמש של עובד היה
   * יכול להפעיל לו וואטסאפ מתי שבא לו. זו גם הטרדה וגם עלות לכל
   * הודעה, ובעיקר: הודעת אימות שמגיעה בלי סיבה מאמנת את הצוות
   * להתעלם מהודעות אימות.
   *
   * ה"זכאות" היא שורת האיפוס שהמנהל יצר — שורה בלי `codeHash`. היא
   * נשארת פתוחה לאורך כל התהליך ונסגרת רק כשנקבעת סיסמה, כדי שעובד
   * שלא קיבל את ההודעה יוכל לבקש קוד שוב.
   */
  const entitled = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      codeHash: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { tokenHash: true },
  });
  if (!entitled) return null;

  // ⚠️ נסגרים רק קודים קודמים (`codeHash` קיים), **לא** שורת הזכאות.
  // סגירתה הייתה חוסמת בקשה חוזרת של מי שההודעה הראשונה לא הגיעה
  // אליו — בדיוק המקרה שבשבילו הכפתור "בקש קוד חדש" קיים.
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null, codeHash: { not: null } },
    data: { usedAt: new Date() },
  });

  const code = formatCode(randomInt(0, 10 ** 6));

  await prisma.passwordReset.create({
    data: {
      // הטוקן כאן אינו בשימוש — הוא רק המפתח הראשי של השורה. זרימת
      // הקוד לא מייצרת קישור, ולכן הוא לא נמסר לאיש.
      tokenHash: hashSessionToken(createSessionToken()),
      userId: user.id,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  return {
    code,
    phone,
    maskedPhone: maskPhone(phone),
    name: user.name,
    userId: user.id,
  };
}

/**
 * מכניס את הודעת הקוד לתור ומנקז מיד.
 *
 * ⚠️ **גוף השורה הוא הקוד עצמו ותו לא.** התבנית של מטא בונה את
 * המשפט; מה שאנחנו מספקים הוא הפרמטר. הגוף נמחק מהשורה מיד אחרי
 * שליחה מוצלחת — ראה `scrubBody` ב-`whatsapp/outbox.ts`.
 *
 * ⚠️ ניקוז מיידי ולא המתנה לשעון: העובד עומד מול המסך ומחכה. קוד
 * שמגיע בעוד חמש דקות שווה לקוד שלא הגיע — התוקף שלו עשר דקות.
 */
export async function sendCode(issued: IssuedCode): Promise<void> {
  // ⚠️ `codeHash: not null` — אחרת זה היה תופס את שורת הזכאות, שהיא
  // גם פתוחה, ומייצר מפתח דדופ שמתנגש בין הנפקות.
  const row = await prisma.passwordReset.findFirst({
    where: { userId: issued.userId, usedAt: null, codeHash: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { tokenHash: true },
  });

  await prisma.whatsAppMessage.create({
    data: {
      dedupeKey: resetCodeDedupeKey(row?.tokenHash ?? issued.userId),
      toPhone: issued.phone,
      body: issued.code,
      scheduledFor: new Date(),
      recipientUserId: issued.userId,
    },
  });

  const { drainOutbox } = await import("@/server/whatsapp/drain");
  await drainOutbox();
}

export type CodeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * מאמת קוד וקובע את הסיסמה שהמשתמש בחר.
 *
 * ⚠️ סדר הפעולות: מוצאים את השורה הפתוחה, סופרים ניסיון, ורק אז
 * משווים. ספירה אחרי ההשוואה הייתה מאפשרת ניחוש בלי גבול — כל ניסיון
 * כושל יוצא מוקדם ולא נספר.
 */
export async function redeemCode(
  email: string,
  rawCode: string,
  password: string,
): Promise<CodeResult> {
  if (!isCodeShape(rawCode)) return { ok: false, error: "קוד לא תקין" };

  const user = await db.users.getByEmail(email);
  if (!user?.active) return { ok: false, error: "קוד לא תקין או שפג תוקפו" };

  const row = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      codeHash: { not: null },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row?.codeHash) {
    return { ok: false, error: "קוד לא תקין או שפג תוקפו" };
  }

  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "יותר מדי ניסיונות. בקש קוד חדש." };
  }

  // ⚠️ נספר **לפני** ההשוואה, כדי שגם ניסיון שנכשל בהמשך ייחשב.
  const bumped = await prisma.passwordReset.update({
    where: { tokenHash: row.tokenHash },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  if (!sameHash(row.codeHash, hashCode(normalizeCode(rawCode)))) {
    const left = MAX_CODE_ATTEMPTS - bumped.attempts;
    return {
      ok: false,
      error:
        left > 0
          ? `קוד שגוי. נותרו ${left} ניסיונות.`
          : "יותר מדי ניסיונות. בקש קוד חדש.",
    };
  }

  // ⚠️ תפיסת השורה מותנית ב-`usedAt: null` ולא עדכון עיוור — שתי
  // שליחות בו-זמנית היו שתיהן עוברות את ההשוואה למעלה.
  const claimed = await prisma.passwordReset.updateMany({
    where: { tokenHash: row.tokenHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return { ok: false, error: "קוד לא תקין או שפג תוקפו" };
  }

  try {
    await updateAuthUser(user.email, { password });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "שמירת הסיסמה נכשלה",
    };
  }

  /*
   * ⚠️ **שורת הזכאות נסגרת כאן, ורק כאן.** כל עוד היא פתוחה העובד
   * רשאי לבקש קודים נוספים — וזה נכון כל עוד הוא לא הצליח להיכנס.
   * מרגע שיש לו סיסמה, הזכאות מסתיימת: בקשת קוד נוספת תדרוש איפוס
   * חדש מהמנהל. בלי הסגירה הזו נשאר לו ערוץ פתוח לנצח.
   */
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // כל המכשירים מנותקים: אם החשבון נפרץ, קביעת סיסמה חייבת לזרוק את
  // מי שכבר בפנים.
  await db.sessions.deleteAllForUser(user.id);

  return { ok: true };
}
