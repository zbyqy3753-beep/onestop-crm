"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/repositories";
import {
  getImpersonatorId,
  getRealSessionUser,
  setImpersonation,
} from "@/server/auth/session";

/**
 * כניסה בתור משתמש אחר ("התחזות") — למנהל ראשי בלבד.
 *
 * ⚠️ זה המנגנון הרגיש ביותר במערכת אחרי יצירת משתמשים, והעיצוב שלו
 * מוכתב מזה:
 *
 *  - **רק `owner`.** לא manager — מי שיכול להיכנס בתור כל אחד יכול
 *    לעשות כל דבר, ולכן הסמכות הזו שמורה לבעלים בלבד (אורחן ומשה).
 *  - **הזהות האמיתית לא הולכת לאיבוד.** היא נשארת ב-`userId` של שורת
 *    הסשן; `impersonatingId` הוא רק בתור מי הוא מוצג. `getSessionUser`
 *    ממשיך להחזיר את המשתמש המתוחזה, והיציאה לא דורשת סיסמה.
 *  - **אי אפשר לשרשר.** בעלים שכבר מתחזה לא יכול להתחזות שוב מתוך
 *    המצב — קודם חוזרים, אחר כך נכנסים למישהו אחר. בלי זה הזהות
 *    האמיתית הייתה נדרסת והדרך חזרה הייתה אובדת.
 *  - **התחזות לבעלים אחר חסומה.** אין סיבה תפעולית לכך, והיא הייתה
 *    מאפשרת למשה "להיות אורחן" — טשטוש אחריות בין שני החשבונות
 *    הרגישים ביותר.
 *
 * ⚠️ קדם לזה: הזהות האמיתית ישבה בעוגייה `os_real` לא חתומה, כלומר
 * כל אחד יכול היה לכתוב לעצמו "אני מתחזה" ולבחור בתור מי. עכשיו שני
 * הצדדים יושבים על שורת הסשן, שאי אפשר לזייף.
 */

export async function impersonateAction(targetUserId: string): Promise<void> {
  // הזהות **האמיתית** — גם אם (בטעות) כבר בתוך התחזות
  const real = await getRealSessionUser();
  if (!real || real.role !== "owner") {
    throw new Error("רק מנהל ראשי יכול להיכנס בתור משתמש אחר");
  }

  if (await getImpersonatorId()) {
    throw new Error("כבר במצב התחזות — קודם יש לחזור לחשבון שלך");
  }

  const target = await db.users.getById(targetUserId);
  if (!target) throw new Error("המשתמש לא נמצא");
  if (target.id === real.id) throw new Error("זה החשבון שלך");
  if (target.role === "owner") {
    throw new Error("אי אפשר להיכנס בתור מנהל ראשי אחר");
  }
  // חשבון מושבת אין לו סשנים ואי אפשר להתחבר אליו — גם ההתחזות
  // אליו הייתה עוקפת בדיוק את מה שההשבתה נועדה למנוע
  if (!target.active) throw new Error("החשבון מושבת");

  await setImpersonation(target.id);

  redirect("/leads");
}

/** חזרה לחשבון האמיתי. לא דורש הרשאה — היציאה תמיד מותרת. */
export async function stopImpersonationAction(): Promise<void> {
  await setImpersonation(null);
  redirect("/admin");
}
