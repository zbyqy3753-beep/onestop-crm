/*
 * משותף ל-`admin/actions.ts` ול-`team/actions.ts` — שני המקומות שיוצרים
 * חשבון התחברות. מודול רגיל ולא בתוך קובץ "use server", שמותר לו לייצא
 * פונקציות א-סינכרוניות בלבד.
 */

/**
 * הודעת שגיאה של Supabase → עברית.
 *
 * ⚠️ ההודעות של Supabase מגיעות באנגלית ומתארות את המודל שלו, לא את
 * המסך שלנו: מנהל שרואה "Unable to validate email address: invalid
 * format" אחרי שהקליד שם משתמש לא יודע שהבעיה היא רווח בשדה, ולא
 * יודע שהמערכת בכלל מרכיבה ממנו כתובת מייל. שאר ההודעות עוברות כפי
 * שהן — עדיף אנגלית מובנת מ"שגיאה לא ידועה".
 */
export function authErrorInHebrew(error: unknown, email: string): string {
  const message = error instanceof Error ? error.message : "";

  if (/validate email address|invalid format/i.test(message)) {
    return (
      `מערכת ההתחברות דחתה את הכתובת ${email} כלא תקינה. ` +
      `שם המשתמש הוא מילה אחת רצופה באנגלית, בלי רווחים — ` +
      `השם המלא נכנס בשדה "שם מלא".`
    );
  }
  if (/already been registered|already registered|already exists/i.test(message)) {
    return `כבר קיים חשבון התחברות עם הכתובת ${email}.`;
  }

  return message || "יצירת חשבון האימות נכשלה";
}
