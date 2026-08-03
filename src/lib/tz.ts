/**
 * אזור זמן אחד לכל המערכת.
 *
 * הקוד הזה רץ גם בשרת וגם בלקוח. בשרת (Vercel) אזור הזמן של התהליך
 * הוא UTC; בדפדפן של המשתמש הוא Asia/Jerusalem. כל חישוב תאריך שנשען
 * על אזור הזמן של הסביבה מקבל שתי תשובות שונות — וזה ייצר כאן שלושה
 * באגים נפרדים: תאריכים שהוצגו ביום שגוי סביב חצות, אי-התאמת הידרציה
 * בין מה שהשרת רינדר למה שהלקוח רינדר, ולוח מובילים ש"היום" שלו היה
 * היום הקודם בין 00:00 ל-03:00.
 *
 * זו מערכת ישראלית. "היום" פירושו היום בישראל, לא במכונה שמריצה את
 * הקוד ולא בשעון של המחשב הנייד של הצופה.
 */

export const TZ = "Asia/Jerusalem";

/**
 * חלקי התאריך בשעון ישראל.
 *
 * `formatToParts` הוא הדרך היחידה לקבל שנה/חודש/יום באזור זמן מסוים
 * בלי ספריית תאריכים — והוא נכון גם במעברי שעון קיץ, שם חישוב ידני
 * של היסט קבוע נשבר.
 */
const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` בשעון ישראל. שני זמנים עם אותו מפתח הם אותו יום קלנדרי. */
export function dayKey(instant: number | Date): string {
  return partsFmt.format(instant);
}

function ymd(instant: number | Date): [number, number, number] {
  const [y, m, d] = dayKey(instant).split("-").map(Number);
  return [y, m, d];
}

/**
 * ההיסט של ישראל מ-UTC באותו רגע, בדקות.
 *
 * נגזר ולא קבוע: ישראל היא +02:00 בחורף ו-+03:00 בקיץ, וקוד שמניח
 * אחד מהם שגוי חצי שנה.
 */
function offsetMinutes(instant: number | Date): number {
  const date = new Date(instant);
  // אותו רגע, פעם אחת כפי שהוא נראה ב-UTC ופעם כפי שהוא נראה בישראל.
  // ההפרש ביניהם הוא ההיסט.
  const asUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const asLocal = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  return Math.round((asLocal.getTime() - asUtc.getTime()) / 60_000);
}

/** תחילת היום (00:00:00.000) בשעון ישראל, כחותמת זמן. */
export function startOfDay(instant: number | Date = Date.now()): number {
  const [y, m, d] = ymd(instant);
  return Date.UTC(y, m - 1, d) - offsetMinutes(instant) * 60_000;
}

/** סוף היום (23:59:59.999) בשעון ישראל, כחותמת זמן. */
export function endOfDay(instant: number | Date = Date.now()): number {
  return startOfDay(instant) + 86_400_000 - 1;
}

/** תחילת החודש בשעון ישראל, כחותמת זמן. */
export function startOfMonth(instant: number | Date = Date.now()): number {
  const [y, m] = ymd(instant);
  return Date.UTC(y, m - 1, 1) - offsetMinutes(instant) * 60_000;
}

/**
 * `YYYY-MM-DD` + שעה ודקה בשעון **ישראל** → חותמת זמן.
 *
 * ⚠️ זו הדרך היחידה לבנות כאן רגע מתוך תאריך שהמשתמש הקליד.
 * `new Date(y, m, d, hh, mm)` בונה את הרגע באזור הזמן של **התהליך** —
 * בדפדפן זה ישראל, ב-Vercel זה UTC. זה בדיוק הבאג שהיה כאן: תאריך חזרה
 * שנבחר ל-09:00 נשמר בייצור כ-09:00Z, כלומר 12:00 בישראל.
 *
 * העוגן הוא צהרי UTC של אותו תאריך — היסט ישראל הוא +2/+3, ולכן צהרי
 * UTC נופלים תמיד באותו יום קלנדרי בישראל. משם `startOfDay` הקיים.
 *
 * מחזיר `null` לתאריך לא חוקי (כולל 31.2, ש-`Date.UTC` היה מגלגל למרץ).
 *
 * מעברי שעון קיץ: ההיסט נלקח מהעוגן (אחרי המעבר, שקורה ב-02:00), וזה
 * גם ההיסט שחל על שעות העבודה — כך ש-09:00 נשאר 09:00 בשני צידי המעבר.
 * השעה 02:00–03:00 של ליל המעבר קדימה אינה קיימת, אך היא מחוץ לחלון
 * השליחה ממילא.
 */
export function instantFromIsraelDateTime(
  dateStr: string,
  hh: number,
  mm: number,
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  if (!Number.isInteger(hh) || hh < 0 || hh > 23) return null;
  if (!Number.isInteger(mm) || mm < 0 || mm > 59) return null;

  const [, y, m, d] = match;
  const anchor = Date.UTC(Number(y), Number(m) - 1, Number(d), 12);

  // גלגול (31.2 → 3.3) מחזיר תאריך אחר מזה שהוקלד — נפילה, לא תיקון שקט
  if (dayKey(anchor) !== dateStr) return null;

  return startOfDay(anchor) + hh * 3_600_000 + mm * 60_000;
}

/**
 * הפרש בימי לוח בשעון ישראל: 0 = אותו יום, 1 = מחר, ‎-1 = אתמול.
 *
 * ⚠️ לא `Math.ceil(ms / 86_400_000)`. חישוב במילישניות עונה על "כמה
 * 24 שעות עברו", וזו שאלה אחרת: תזכורת שנקבעה להיום ב-09:00, כשעכשיו
 * 08:00, מרוחקת שעה אחת — ועיגול כלפי מעלה הפך אותה ל"מחר". המשתמש
 * שואל באיזה *יום* זה נופל, לא כמה שעות נותרו.
 */
export function calendarDaysBetween(
  from: number | Date,
  to: number | Date,
): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}
