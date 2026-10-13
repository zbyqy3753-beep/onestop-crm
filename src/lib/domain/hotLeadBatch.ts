/**
 * ── מקבץ לידים חמים ───────────────────────────────────────────────────
 *
 * ⚠️ **מודול טהור, בלי שום ייבוא** — אותו שיקול כמו ב-`alerts.ts`:
 * רק מודול שעומד בפני עצמו נפתר על ידי מריץ הבדיקות של Node.
 *
 * ⚠️⚠️ **למה בכלל לאחד.** התבנית `lead_hot_he` רשומה במטא כ-MARKETING,
 * ולכן היא כפופה למגבלת ההודעות השיווקיות **לנמען**. עובד שמקבל הרבה
 * לידים ביום חוצה את המכסה האישית שלו, ומטא מפילה את השאר בשקט
 * ב-"This message was not delivered to maintain healthy ecosystem
 * engagement". המכסה גם נשחקת ככל שנשלח יותר ובפרט כשהנמען לא עונה —
 * וההתראות האלה חד-כיווניות מעצם טבען.
 *
 * הסיווג עצמו אינו ניתן לתיקון מהקוד: מטא מסרבת לשנות קטגוריה של
 * תבנית מאושרת, ושלוש תבניות חדשות בניסוחים שונים סווגו מחדש
 * ל-MARKETING אוטומטית. מה שכן בשליטתנו הוא **מספר ההודעות**.
 *
 * על 30 יום של נתוני ייצור: חלון של חמש דקות מכווץ 153 הודעות ל-77,
 * והמקסימום שנצפה בחלון אחד הוא שישה לידים.
 */

/**
 * כמה זמן מקבץ נשאר פתוח.
 *
 * ⚠️ חמש דקות, וזו פשרה מכוונת בין שני כשלים: חלון קצר מדי כמעט לא
 * מאחד, וחלון ארוך פוגע בדיוק בערך של ליד חם — אדם שממש עכשיו מילא
 * טופס ועדיין ליד המכשיר. עשר דקות היו מאחדות יותר ומחזירות את
 * העובד לשיחה שכבר התקררה.
 */
export const HOT_BATCH_WINDOW_MS = 5 * 60_000;

/** כמה לידים נכנסים לרשימה עצמה לפני "ועוד N". */
export const HOT_BATCH_LIST_MAX = 10;

/**
 * ⚠️ הכותרת היא גם הסימן שהגוף הוא מקבץ. חילוץ שלא מזהה אותה מחזיר
 * פרמטרים בטוחים במקום לזרוק על שורה שכבר נשמרה.
 */
const HEAD = "לידים חמים חדשים";
const SEP = " | ";

/**
 * ניקוי ערך שנכנס לגוף המצטבר.
 *
 * ⚠️⚠️ **שתי סיבות, ושתיהן אמיתיות.**
 *
 * `|` הוא המפריד, ושם שמכיל אותו היה מזיז כל ערך אחריו. אותו באג
 * היה גם בנתיב ההתראה הבודדת (`fields()` ב-`alerts.ts`) ותוקן שם
 * ב-`cleanParam`; שם הוא פגע בהודעה אחת, וכאן היה הורס מקבץ שלם.
 *
 * ירידת שורה, טאב וארבעה רווחים רצופים **נדחים על ידי מטא** בפרמטר
 * תבנית. בייצור יש שמות עם רווחים כפולים, וייבוא מאקסל מביא גם
 * ירידות שורה בתוך תא. `normalizeBroadcastText` עושה בדיוק את זה
 * בנתיב הדיוור, ו-`cleanParam` בנתיב ההתראה הבודדת.
 */
function clean(value: string): string {
  return value.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

/** רשומה אחת בגוף: שם ואחריו טלפון. */
/**
 * שם תצוגה של הלקוח, בלי הזבל שהייבוא משאיר.
 *
 * ⚠️ "None"/"null" הם ערך ריק שעבר דרך Python או JSON ונשמר כמחרוזת.
 * ⚠️ "ליד 0528744556" — הייבוא ממלא שם חסר בטלפון, וההודעה הציגה את
 * המספר פעמיים ברצף. שם שמכיל את ספרות הטלפון אינו מוסיף מידע.
 */
function displayName(leadName: string, leadPhone: string): string {
  const name = clean(leadName);
  if (!name || /^(none|null|undefined)$/i.test(name)) return "לקוח";
  const digits = leadPhone.replace(/\D/g, "");
  if (digits.length >= 9 && name.replace(/\D/g, "").includes(digits)) {
    return "לקוח";
  }
  return name;
}

function entry(leadName: string, leadPhone: string): string {
  const name = displayName(leadName, leadPhone);
  const phone = clean(leadPhone) || "—";
  return `${name} ${phone}`;
}

/** הגוף ההתחלתי, כשנפתח מקבץ חדש. */
export function hotBatchBody(leadName: string, leadPhone: string): string {
  return `${HEAD}${SEP}${entry(leadName, leadPhone)}`;
}

/**
 * מוסיפה ליד לגוף קיים.
 *
 * ⚠️ מחזירה גוף חדש ואינה משנה את הקיים — הכתיבה למסד היא של הקורא,
 * והיא זו שמותנית על `status = 'queued'`.
 */
export function hotBatchAppend(
  body: string,
  leadName: string,
  leadPhone: string,
): string {
  return `${body}${SEP}${entry(leadName, leadPhone)}`;
}

/** הרשומות שבגוף, או רשימה ריקה אם הוא אינו מקבץ. */
function entries(body: string): string[] {
  const parts = body.split("|").map((p) => p.trim());
  if (parts.length < 2 || parts[0] !== HEAD) return [];
  return parts.slice(1).filter(Boolean);
}

/** כמה לידים יש במקבץ. */
export function hotBatchCount(body: string): number {
  return entries(body).length;
}

/**
 * הפרמטרים של התבנית — מספר הלידים, והרשימה.
 *
 * ⚠️ הרשימה היא **שורה אחת מופרדת בפסיקים**, ולא שורות נפרדות: פרמטר
 * תבנית לא יכול להכיל ירידת שורה.
 *
 * ⚠️ הספירה היא של הכול, גם של מה שנחתך מהרשימה. עובד שרואה "סה״כ 12"
 * ורשימה של עשרה מבין שיש עוד; רשימה חתוכה בלי המספר היא שקר שקט.
 */
export function hotBatchParams(body: string): string[] {
  const all = entries(body);
  if (all.length === 0) return ["0", "—"];

  const shown = all.slice(0, HOT_BATCH_LIST_MAX);
  const extra = all.length - shown.length;
  const list = extra > 0
    ? `${shown.join(", ")}, ועוד ${extra}`
    : shown.join(", ");

  return [String(all.length), list];
}

/**
 * מפתח המקבץ. הזמן בתוכו הוא **מועד פתיחת המקבץ**, לא מועד השליחה.
 *
 * ⚠️ המפתח מזהה מקבץ אחד ויחיד, ולכן הוא כולל חותמת זמן: שני מקבצים
 * של אותו עובד באותו יום הם שתי הודעות נפרדות. החיפוש אחר מקבץ פתוח
 * נעשה לפי **התחילית** (`hotBatchKeyPrefix`) ולא לפי המפתח המלא.
 */
export function hotBatchDedupeKey(userId: string, openedAt: number): string {
  return `hotbatch:${userId}:${openedAt}`;
}

/** התחילית שלפיה מחפשים מקבץ פתוח של אותו עובד. */
export function hotBatchKeyPrefix(userId: string): string {
  return `hotbatch:${userId}:`;
}

/* ── טקסט חופשי בתוך חלון 24 השעות ─────────────────────────────────── */

/**
 * כמה לידים נכנסים לטקסט החופשי לפני "ועוד N".
 *
 * ⚠️ מטא חותכת הודעת טקסט ב-4,096 תווים. שורה היא ~30 תווים, אז 60
 * שורות משאירות מרווח גדול — ומעבר לזה רשימה בוואטסאפ ממילא לא
 * נקראת; המסך הוא המקום לעבור עליה.
 */
export const HOT_TEXT_LIST_MAX = 60;

/**
 * המקבץ כהודעת טקסט רגילה — לשליחה בתוך חלון השירות, בלי תבנית.
 *
 * ⚠️ אותו גוף שמור בדיוק כמו לתבנית; רק הרינדור שונה. כך ההחלטה
 * "תבנית או טקסט" נשארת ברגע השליחה, כשידוע אם החלון פתוח.
 */
export function hotBatchText(body: string): string {
  const all = entries(body);
  if (all.length === 0) return "🔥 ליד חם חדש — פרטים במסך הלידים";
  const shown = all.slice(0, HOT_TEXT_LIST_MAX);
  const extra = all.length - shown.length;
  const head =
    all.length === 1 ? "🔥 ליד חם חדש אצלך" : `🔥 ${all.length} לידים חמים חדשים אצלך`;
  const lines = shown.map((e, i) => `${i + 1}. ${e}`);
  if (extra > 0) lines.push(`…ועוד ${extra} — כולם במסך הלידים`);
  return `${head}\n\n${lines.join("\n")}`;
}
