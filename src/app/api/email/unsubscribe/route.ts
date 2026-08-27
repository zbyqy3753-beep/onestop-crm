import { NextResponse } from "next/server";

import { optOutByToken } from "@/server/mailer/optOut";

/**
 * הכפתור המובנה של ג'ימייל (`List-Unsubscribe-Post`) שולח POST לכאן.
 *
 * ⚠️ **בלי הנתיב הזה הכותרת `List-Unsubscribe-Post` היא שקר**: היא
 * מבטיחה הסרה בלחיצה, ג'ימייל שולח POST ומקבל 405, והמשתמש רואה
 * שההסרה נכשלה. מי שקורה לו את זה מסמן "דווח כספאם" — וזה בדיוק
 * מה שהכותרת נועדה למנוע.
 */
export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const email = await optOutByToken(token, "כפתור ההסרה של ספק הדואר");

  // ⚠️ 200 גם על טוקן פגום. ג'ימייל אינו מציג את התשובה לאיש,
  // ותשובת שגיאה רק תגרום לו לסמן את השולח כבעייתי.
  return NextResponse.json({ success: Boolean(email) }, { status: 200 });
}
