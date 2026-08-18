"use server";

import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import { createAuthUser, updateAuthUser } from "@/server/auth/supabaseAdmin";
import type { Role } from "@/lib/domain/types";
import { isRole } from "@/lib/domain/types";
import { isIsraeliPhone } from "@/lib/format";
import { passwordProblem } from "@/lib/password";
import { isValidLoginId, toLoginEmail } from "@/lib/loginId";
import { revalidateUserSurfaces } from "@/app/(app)/_revalidate";
import { resetPasswords, type ResetLink } from "@/server/auth/passwordReset";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/*
 * ⚠️ כאן ישב `MIN_PASSWORD_LENGTH = 10` ובדיקת אורך בלבד. היא עברה
 * על `1234567890` ועל `aaaaaaaaaaaa` בלי להניד עפעף. הכללים עברו
 * ל-`lib/password.ts` — מודול טהור שגם עמוד קביעת הסיסמה של העובד
 * קורא לו, כדי שלא יתפתחו שתי מדיניות שונות בשני מסכים.
 */

/**
 * יצירת משתמש חדש: גם רשומת User אצלנו, גם חשבון Supabase Auth
 * (כדי שיוכל להתחבר מייד עם המייל/סיסמה שהוזנו כאן).
 *
 * ⚠️ זו הפעולה הרגישה ביותר במערכת — היא מייצרת חשבון התחברות אמיתי
 * עם תפקיד שהקורא בוחר. לכן היא לא מסתפקת ב"יש סשן": רק ניהול רשאי
 * ליצור משתמשים, ורק בעלים רשאי ליצור בעלים נוסף. בלי הבדיקה השנייה
 * כל מנהל היה יכול להנפיק לעצמו חשבון בעלים.
 */
export async function createUserAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSessionUser();
  if (actor.role !== "owner" && actor.role !== "manager") {
    return { ok: false, error: "אין לך הרשאה ליצור משתמשים" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const rawLoginId = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const store = String(formData.get("store") ?? "").trim();
  const leadSourceName = String(formData.get("leadSourceName") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!isValidLoginId(rawLoginId)) {
    return {
      ok: false,
      error: "שם משתמש לא תקין — אותיות באנגלית, ספרות, נקודה או מקף",
    };
  }
  /*
   * מה שנשמר הוא תמיד כתובת מלאה, גם כשהוקלד שם בלבד: המייל הוא
   * המפתח לחשבון ה-Supabase Auth, ושם בודד אינו מזהה חוקי שם.
   * אותה המרה בדיוק רצה בהתחברות — ראה lib/loginId.ts
   */
  const email = toLoginEmail(rawLoginId);
  // אופציונלי, אבל אם הוזן — חייב להיות תקין: זה היעד של תזכורות
  // הוואטסאפ, ומספר שגוי נכשל בשקט אצל הבוט ולא כאן
  if (phone && !isIsraeliPhone(phone)) {
    return { ok: false, error: "מספר טלפון לא תקין" };
  }
  if (!isRole(rawRole)) return { ok: false, error: "תפקיד לא מוכר" };
  const role: Role = rawRole;
  if (role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול ליצור מנהל ראשי נוסף" };
  }
  /*
   * ספק בלי שם מקור הוא חשבון שנכנס למסך ריק לנצח, בלי שום רמז למה:
   * `leads/page.tsx` מחזיר רשימה ריקה כשהשדה חסר (וזו ההתנהגות
   * הנכונה — סינון ריק היה מציג לו את כל מאגר הארגון). לכן חוסמים
   * כאן, במקום היחיד שיכול להסביר את הבעיה למי שיוצר את החשבון.
   */
  if (role === "supplier" && !leadSourceName) {
    return { ok: false, error: "לספק לידים חובה להגדיר שם מקור" };
  }
  const weak = passwordProblem(password, { email, name });
  if (weak) return { ok: false, error: weak };

  const existing = await db.users.getByEmail(email);
  if (existing) return { ok: false, error: "כבר קיים משתמש עם האימייל הזה" };

  try {
    await createAuthUser(email, password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "יצירת חשבון האימות נכשלה" };
  }

  await db.users.create({
    name,
    email,
    // ספרות בלבד, כמו בלידים — הבוט ממיר ל-E.164 ולא מנקה מקפים
    phone: phone ? phone.replace(/\D/g, "") : undefined,
    store: store || undefined,
    // רק לספק: לשאר התפקידים השדה חסר משמעות, ושמירתו הייתה יוצרת
    // משתמשים שנראים כספקים בכל שאילתה שתיכתב בעתיד על העמודה הזו
    leadSourceName: role === "supplier" ? leadSourceName : undefined,
    role,
  });

  revalidateUserSurfaces();
  return { ok: true };
}

/**
 * עריכת משתמש קיים: שם, אימייל, סיסמה, טלפון, חנות, תפקיד ופעיל/לא.
 *
 * ⚠️ **אימייל וסיסמה חיים בשתי מערכות.** המייל הוא המפתח שמקשר בין
 * שורת ה-`User` שלנו לחשבון ה-Supabase Auth: `verifyCredentials`
 * מאמת את הסיסמה מול Supabase ואז מחפש אצלנו לפי אותו מייל. אם רק
 * צד אחד מתעדכן — המשתמש ננעל בחוץ.
 *
 * לכן הסדר כאן הוא: Supabase קודם (הקריאה החיצונית שעלולה להיכשל),
 * המסד שלנו אחריו, **וגלגול אחורה של Supabase אם המסד נכשל**.
 *
 * אותם כללי סמכות כמו ביצירה, ועוד שניים שקיימים רק בעריכה:
 *  - **על חשבון בעלים רק בעלים נוגע** — לכל שינוי, לא רק לתפקיד.
 *    בלי זה מנהל היה יכול להשבית את הבעלים.
 *  - **אי אפשר להשבית או להוריד בדרגה את עצמך** — נעילה עצמית בטעות
 *    היא הדרך הקלה ביותר לאבד גישה למערכת.
 */
export async function updateUserAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSessionUser();
  if (actor.role !== "owner" && actor.role !== "manager") {
    return { ok: false, error: "אין לך הרשאה לערוך משתמשים" };
  }

  const target = await db.users.getById(userId);
  if (!target) return { ok: false, error: "המשתמש לא נמצא" };

  if (target.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול לערוך מנהל ראשי" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const store = String(formData.get("store") ?? "").trim();
  const leadSourceName = String(formData.get("leadSourceName") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";
  const rawLoginId = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (phone && !isIsraeliPhone(phone)) {
    return { ok: false, error: "מספר טלפון לא תקין" };
  }
  if (!isRole(rawRole)) return { ok: false, error: "תפקיד לא מוכר" };
  const role: Role = rawRole;

  if (!isValidLoginId(rawLoginId)) {
    return {
      ok: false,
      error: "שם משתמש לא תקין — אותיות באנגלית, ספרות, נקודה או מקף",
    };
  }
  // כמו ביצירה — ראה lib/loginId.ts
  const email = toLoginEmail(rawLoginId);

  // שדה ריק = "אל תשנה את הסיסמה", ולכן הבדיקה חלה רק כשהוזן משהו
  if (password) {
    const weak = passwordProblem(password, { email, name });
    if (weak) return { ok: false, error: weak };
  }

  const emailChanged = email.toLowerCase() !== target.email.toLowerCase();
  if (emailChanged) {
    const taken = await db.users.getByEmail(email);
    if (taken && taken.id !== userId) {
      return { ok: false, error: "כבר קיים משתמש עם האימייל הזה" };
    }
  }

  if (role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול להעניק תפקיד מנהל ראשי" };
  }
  // כמו ביצירה — ספק בלי שם מקור נכנס למסך ריק בלי הסבר
  if (role === "supplier" && !leadSourceName) {
    return { ok: false, error: "לספק לידים חובה להגדיר שם מקור" };
  }

  if (target.id === actor.id) {
    if (!active) return { ok: false, error: "אי אפשר להשבית את החשבון שלך" };
    if (role !== actor.role) {
      return { ok: false, error: "אי אפשר לשנות את התפקיד של עצמך" };
    }
  }

  // Supabase קודם: זו הקריאה החיצונית שעלולה להיכשל (מייל תפוס,
  // חשבון חסר, רשת). אם היא נכשלת — לא נגענו בכלום אצלנו.
  if (emailChanged || password) {
    try {
      await updateAuthUser(target.email, {
        email: emailChanged ? email : undefined,
        password: password || undefined,
      });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "עדכון חשבון ההתחברות נכשל",
      };
    }
  }

  try {
    await db.users.update(userId, {
      name,
      email,
      phone: phone ? phone.replace(/\D/g, "") : null,
      store: store || null,
      // `null` ולא `undefined` כשהתפקיד אינו ספק: הורדת תפקיד מספק
      // לעובד חייבת לנקות את השדה, אחרת הוא נשאר תלוי על החשבון
      leadSourceName: role === "supplier" ? leadSourceName : null,
      role,
      active,
    });
  } catch (e) {
    // ⚠️ המסד נכשל אחרי ש-Supabase כבר עודכן — בלי גלגול אחורה
    // המשתמש היה נשאר עם מייל אחד ב-Auth ומייל אחר אצלנו, כלומר
    // ננעל בחוץ. מחזירים את Supabase למייל הישן.
    if (emailChanged) {
      try {
        await updateAuthUser(email, { email: target.email });
      } catch {
        return {
          ok: false,
          error:
            `העדכון נכשל וגם השחזור נכשל. חשבון ההתחברות של ${target.name} ` +
            `נמצא כעת על ${email} בעוד המערכת מכירה את ${target.email} — ` +
            `צריך לתקן ידנית ב-Supabase.`,
        };
      }
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "עדכון המשתמש נכשל",
    };
  }

  /*
   * השבתה = ניתוק מיידי מכל המכשירים.
   *
   * ⚠️ בלי זה ההשבתה כמעט לא עושה כלום בטווח הקצר: העוגייה של המשתמש
   * נשארת תקפה, ו-`proxy.ts` מאריך אותה בכל ניווט — כלומר עובד שעזב
   * ממשיך לעבוד כרגיל כל עוד הוא לא סוגר את הדפדפן. `getSessionUser`
   * חוסם אותו ממילא, אבל זה נשען על בדיקה בכל בקשה; מחיקת הסשן היא
   * מה שמסיים את הסיפור.
   *
   * גם שינוי סיסמה או מייל מנתק: אם החשבון נפרץ, החלפת סיסמה חייבת
   * לזרוק את מי שכבר בפנים — אחרת הסשן הגנוב שורד את התיקון.
   */
  if (!active || password || emailChanged) {
    await db.sessions.deleteAllForUser(userId);
  }

  revalidateUserSurfaces();
  return { ok: true };
}

/* ── איפוס סיסמאות ──────────────────────────────────────────────────── */

export interface ResetLinkView {
  userId: string;
  name: string;
  email: string;
  url: string;
  /**
   * האם יצאה אליו התראה בוואטסאפ.
   *
   * ⚠️ `false` פירושו שהעובד אופס אבל **אינו יודע על כך** ואין לו דרך
   * לגלות — אין לו טלפון תקין במערכת. הוא היחיד שחייב טיפול ידני,
   * ולכן המסך מפריד בין השניים במקום להציג רשימה אחידה.
   */
  notified: boolean;
}

export interface ResetReport {
  links: ResetLinkView[];
  failures: { name: string; email: string; error: string }[];
}

/**
 * מאפס סיסמאות ומחזיר קישורים חד-פעמיים להעברה ידנית.
 *
 * ⚠️ **הקישורים מוחזרים פעם אחת בלבד.** במסד נשמר רק ה-hash שלהם,
 * בדיוק כמו בסשן, ולכן מסך שנסגר לפני שהעתקת אותם = קישורים אבודים.
 * זו לא תקלה אלא התכונה — אבל היא מחייבת שהמסך יאמר את זה בבירור,
 * ושתהיה דרך להנפיק מחדש (`userIds` עם משתמש בודד).
 *
 * ⚠️ רק בעלים. איפוס סיסמאות הוא השתלטות על חשבונות: מי שמריץ אותו
 * מחזיק לרגע קישור שפותח כל חשבון במערכת, כולל של הבעלים. `manager`
 * רשאי ליצור משתמשים אבל לא לקחת חשבון קיים.
 */
export async function resetPasswordsAction(
  userIds: string[],
): Promise<ActionResult<ResetReport>> {
  const actor = await requireSessionUser();
  if (actor.role !== "owner") {
    return { ok: false, error: "רק מנהל ראשי יכול לאפס סיסמאות" };
  }
  if (userIds.length === 0) return { ok: false, error: "לא נבחר אף משתמש" };

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    // ⚠️ בלי הכתובת היינו מייצרים קישורים יחסיים — כלומר מנפיקים
    // טוקנים אמיתיים (שמבטלים סיסמאות!) ומדפיסים כתובת שבורה.
    // עדיף להיכשל לפני שנגענו בחשבון של מישהו.
    return { ok: false, error: "APP_URL אינו מוגדר — בלעדיו אי אפשר לבנות קישור" };
  }

  const results = await resetPasswords(userIds, {
    appUrl,
    issuedById: actor.id,
    keepSessionOf: actor.id,
  });

  await revalidateUserSurfaces();

  return {
    ok: true,
    data: {
      links: results
        .filter((r) => r.ok)
        .map((r) => {
          const { userId, name, email, url, notified } = (
            r as { link: ResetLink }
          ).link;
          return { userId, name, email, url, notified };
        }),
      failures: results
        .filter((r) => !r.ok)
        .map((r) => r as { name: string; email: string; error: string }),
    },
  };
}
