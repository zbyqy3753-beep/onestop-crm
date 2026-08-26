/**
 * נרמול ותיקוף כתובות מייל, לצורך דיוור.
 *
 * ⚠️ **הנרמול הוא חלק ממפתח הכפילות** (`dedupeKey`), ולכן שתי צורות
 * של אותה כתובת חייבות להצטמצם לאחת — אחרת `Dana@` ו-`dana@` היו
 * שתי שורות בתור והאדם היה מקבל את הדיוור פעמיים.
 *
 * ⚠️ **מה שאינו כתובת מוחזר `null` ולא מתוקן בכוח.** בייבוא לידים
 * מותר להשלים אפס מוביל לטלפון, כי מספר פגום נכשל בשליחה ותו לא.
 * כתובת מייל מנוחשת נשלחת בהצלחה — לאדם אחר.
 */

/*
 * מכוון להיות מחמיר יותר מ-RFC 5322 ולא פחות: המקרים שהוא פוסל
 * (רווחים, פסיקים, נקודה כפולה, tld חסר) הם בדיוק מה שמגיע מתא
 * אקסל שמולא ביד, ולא כתובות אמיתיות שנדחות בטעות.
 */
const SHAPE = /^[^\s@,;<>]+@[^\s@,;<>.]+(\.[^\s@,;<>.]+)+$/;

/**
 * מקלף את העטיפה שאאוטלוק ו-Gmail מדביקים: `"שם" <a@b.com>`.
 * מוחזר הטקסט שבין הסוגריים, או המקור אם אין כאלה.
 */
function unwrapAngleBrackets(value: string): string {
  const m = /<([^<>]*)>\s*$/.exec(value);
  return m ? m[1].trim() : value;
}

/** הכתובת בצורתה הקנונית, או `null` אם אינה תקינה. */
export function normalizeEmail(raw: string): string | null {
  const candidate = unwrapAngleBrackets(raw.trim()).trim().toLowerCase();
  if (!SHAPE.test(candidate)) return null;
  return candidate;
}

export function isEmail(value: string): boolean {
  return normalizeEmail(value) !== null;
}
