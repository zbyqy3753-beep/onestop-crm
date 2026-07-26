"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/repositories";
import { isIsraeliPhone } from "@/lib/format";

/**
 * שליחת טופס ההרשמה הציבורי — לא דורש session, מגיע מבעלי עסקים
 * חיצוניים דרך קישור הפניה אישי.
 *
 * ⚠️ פתרון הטוקן ל-`referredByUserId` הוא best-effort בכוונה: טוקן
 * שבור/ישן/לא מוכר לא נכשל קשה — הפנייה נוצרת בכל זאת עם
 * `referredByUserId: undefined` ו-`referralSource: "ONE STOP"` (ברירת
 * מחדל גנרית), כי עסק אמיתי לא צריך להיחסם בגלל קישור הפניה שבור.
 *
 * הפעולה מחוברת ישירות ל-`<form action={...}>` בלי `useActionState` —
 * זה עמוד ציבורי ללא JS מובטח, ולכן כל התוצאה (הצלחה/שגיאה) עוברת
 * דרך redirect + query param, שהעמוד הסטטי קורא ב-`searchParams`.
 */

/** `user_<id>` → מזהה משתמש, או `null` אם התבנית לא תואמת. */
function parseToken(token: string): string | null {
  const match = /^user_(.+)$/.exec(token);
  return match ? match[1] : null;
}

export async function submitRegistrationAction(formData: FormData): Promise<void> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  function fail(message: string): never {
    redirect(`/form/${encodeURIComponent(token)}?error=${encodeURIComponent(message)}`);
  }

  if (businessName.length < 2) fail("שם העסק הוא שדה חובה");
  if (contactName.length < 2) fail("שם איש הקשר הוא שדה חובה");
  if (!isIsraeliPhone(phone)) fail("מספר טלפון לא תקין — צריך להתחיל ב-0");

  let referredByUserId: string | undefined;
  let referralSource = "ONE STOP";

  const candidateId = parseToken(token);
  if (candidateId) {
    const user = await db.users.getById(candidateId);
    if (user) {
      referredByUserId = user.id;
      referralSource = user.name;
    }
  }

  await db.registrations.create({
    businessName,
    contactName,
    phone,
    email: email || undefined,
    referralSource,
    referredByUserId,
  });

  redirect(`/form/${encodeURIComponent(token)}?submitted=1`);
}
