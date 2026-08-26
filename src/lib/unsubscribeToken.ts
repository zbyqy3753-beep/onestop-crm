import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeEmail } from "./email";

/**
 * הקישור להסרה מרשימת התפוצה, חתום.
 *
 * ⚠️ **חתימה ולא מזהה שנשמר במסד**, כי הקישור נשלח לכל נמען, בכל
 * דיוור, ונשאר תקף לנצח. שורה לכל מייל שנשלח אי-פעם היא טבלה שגדלה
 * בלי גבול ולא נמחקת לעולם; החתימה מאמתת את עצמה.
 *
 * ⚠️ **הטוקן מגיע משורת הכתובת ולכן הוא קלט של זר.** כל צורה פגומה
 * מחזירה `null`, ולא נזרקת שגיאה שתהפוך לדף 500 מול מי שרק רצה
 * להסיר את עצמו.
 *
 * ⚠️ ההשוואה היא `timingSafeEqual`. זה נראה מוגזם בשביל הסרה מרשימה,
 * אבל טוקן מזויף מאפשר להסיר לקוח אחר — כלומר למנוע ממנו לקבל דיוור
 * שהוא כן רצה — וזה כשל שקט שאיש לא ישים לב אליו.
 */

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** הטוקן לכתובת. זורק אם הכתובת אינה תקינה. */
export function signUnsubscribe(email: string, secret: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error(`כתובת לא תקינה לחתימה: ${email}`);

  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** הכתובת שהטוקן מייצג, או `null` אם הוא אינו תקף. */
export function verifyUnsubscribe(
  token: string,
  secret: string,
): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(payload, secret);

  // ⚠️ אורך שונה מפיל את `timingSafeEqual`, ולכן נבדק לפניו
  if (provided.length !== expected.length) return null;
  if (
    !timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expected, "utf8"),
    )
  ) {
    return null;
  }

  return normalizeEmail(Buffer.from(payload, "base64url").toString("utf8"));
}
