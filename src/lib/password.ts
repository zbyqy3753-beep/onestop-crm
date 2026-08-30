/**
 * ── מדיניות הסיסמאות ──────────────────────────────────────────────────
 *
 * מודול טהור בכוונה: אין בו `server-only`, אין בו גישה למסד, ואין בו
 * שום תלות. הוא נקרא משלושה מקומות — יצירת משתמש, עריכת משתמש, ועמוד
 * קביעת הסיסמה של העובד — וכל אחד מהם היה יכול לפתח כללים משלו.
 * הכללים כתובים כאן פעם אחת, וניתנים לבדיקה בלי להרים שרת.
 *
 * ⚠️ **הבדיקה חייבת לרוץ בשרת בכל אחד מהשלושה.** הרצה בדפדפן בלבד
 * היא נוחות תצוגה: `/set-password` הוא נקודת קצה HTTP, ומי ששולח
 * אליה בקשה ישירות עוקף כל בדיקה שקיימת רק בטופס.
 */

/**
 * ⚠️ 8 ולא 12. הסיסמאות האלה מוקלדות בטלפון בין שיחות, וסף של 12
 * תווים לא ייצר סיסמאות חזקות — הוא ייצר פתקים על המסך, וזה מצב
 * גרוע יותר מסיסמה בינונית.
 *
 * האורך לבדו כבר לא מספיק בסף הזה, ולכן הבדיקות שמסביב הן מה שנושא
 * את המשקל: `12345678` נופל על הרצף, `aaaaaaaa` על התו החוזר,
 * ו-`password` על הרשימה — ואף אחד מהם לא עובר.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * הסיסמאות שנראות בכל דליפה, בתוספת מה שנפוץ במקלדת עברית/ישראלית.
 *
 * ⚠️ הרשימה קצרה בכוונה ואינה מתיימרת להיות מקיפה — רשימה של מיליון
 * סיסמאות דלופות היא שירות חיצוני, לא קובץ בקוד. תפקידה לחסום את
 * הניחוש הראשון, לא את המילון כולו; דרישת האורך והמגוון עושות את
 * העבודה הכבדה.
 */
const OBVIOUS = [
  "password",
  "123456",
  "qwerty",
  "111111",
  "abc123",
  "letmein",
  "welcome",
  "admin",
  "onestop",
  "iloveyou",
  "monkey",
  "dragon",
];

/** רצף עולה או יורד באורך 4 ומעלה — `1234`, `abcd`, `4321`. */
function hasRun(value: string): boolean {
  let up = 1;
  let down = 1;
  for (let i = 1; i < value.length; i++) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    up = delta === 1 ? up + 1 : 1;
    down = delta === -1 ? down + 1 : 1;
    if (up >= 4 || down >= 4) return true;
  }
  return false;
}

/** כל התווים זהים — `aaaaaaaaaaaa`. */
function allSame(value: string): boolean {
  return value.length > 0 && [...value].every((ch) => ch === value[0]);
}

/**
 * מילים שאסור שהסיסמה תיבנה סביבן — שם המשתמש, החלק שלפני ה-@ במייל,
 * ושם החברה.
 *
 * ⚠️ זה הכלל שתופס את מה שאנשים באמת בוחרים. `moshe2024!` עובר אורך
 * ומגוון בלי בעיה, והוא הניחוש הראשון של כל מי שמכיר את הצוות.
 */
function personalTokens(context: PasswordContext): string[] {
  const local = (context.email ?? "").split("@")[0] ?? "";
  return [local, context.name ?? "", "onestop"]
    .flatMap((part) => part.split(/[^a-zA-Z0-9֐-׿]+/))
    .map((part) => part.trim().toLowerCase())
    // מתחת ל-3 תווים זה לא "השם שלו" אלא צירוף אותיות מקרי, ופסילה
    // עליו הייתה חוסמת סיסמאות תקינות לגמרי.
    .filter((part) => part.length >= 3);
}

export interface PasswordContext {
  /** המייל שאיתו הוא מתחבר. החלק שלפני ה-@ נאסר בתוך הסיסמה. */
  email?: string;
  /** שם המשתמש כפי שהוא רשום. */
  name?: string;
}

/**
 * מה לא בסדר בסיסמה, או `null` אם היא תקינה.
 *
 * מחזירה מחרוזת בעברית ולא boolean: העובד שמקבל "הסיסמה לא עומדת
 * בדרישות" בלי לדעת באיזו דרישה מנסה שוב ושוב את אותו רעיון.
 *
 * ⚠️ הסדר כאן הוא סדר התצוגה. האורך ראשון כי הוא הכשל השכיח, והוא
 * גם היחיד שהמשתמש יכול לתקן בלי לחשוב מחדש על הסיסמה כולה.
 */
export function passwordProblem(
  password: string,
  context: PasswordContext = {},
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
  }

  // ⚠️ רווחים בקצוות נפסלים ולא נחתכים בשקט: סיסמה שנחתכה בשמירה
  // ולא בהתחברות היא נעילה בחוץ שאי אפשר לאבחן.
  if (password !== password.trim()) {
    return "הסיסמה לא יכולה להתחיל או להסתיים ברווח";
  }

  const lower = password.toLowerCase();

  if (allSame(password)) return "הסיסמה לא יכולה להיות אותו תו שחוזר";
  if (hasRun(lower)) return "הסיסמה לא יכולה להכיל רצף כמו 1234 או abcd";

  for (const bad of OBVIOUS) {
    if (lower.includes(bad)) return `הסיסמה לא יכולה להכיל "${bad}"`;
  }

  for (const token of personalTokens(context)) {
    if (lower.includes(token)) {
      return "הסיסמה לא יכולה להכיל את השם או את שם המשתמש שלך";
    }
  }

  /*
   * שתי משפחות תווים ולא ארבע.
   *
   * ⚠️ דרישה לאות גדולה + מספר + תו מיוחד היא בדיוק מה שמייצר
   * `Password1!` — הצורה הצפויה ביותר שיש. שתי משפחות מתוך ארבע
   * נותנות מרחב גדול יותר בפועל, ואפשר לעמוד בה עם
   * צירוף מילים שקל לזכור.
   */
  const families = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(password),
  ).length;
  if (families < 2) {
    return "הסיסמה חייבת לשלב לפחות שני סוגי תווים — אותיות, ספרות או סימנים";
  }

  return null;
}
