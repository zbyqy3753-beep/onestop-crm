import { toE164 } from "@/lib/format";

/**
 * חילוץ פרטי לקוח מטקסט של מסמך חידוש.
 *
 * ⚠️⚠️ **הפרסר הזה נכתב מול מסמך בדיקה שאנחנו בנינו, לא מול חשבונית
 * אמיתית של ספק.** הוא עובד על התוויות שאנחנו בחרנו ("שם הלקוח",
 * "טלפון נייד", "מחיר חודשי לאחר סיום ההטבה"). חשבונית אמיתית של
 * פרטנר או סלקום תיראה אחרת לגמרי, וכשתגיע אחת צריך להוסיף כאן
 * דפוסי תוויות — לא לשכתב.
 *
 * זו הסיבה ש-`rawText` נשמר על כל איש קשר: אפשר לתקן את הפרסר
 * ולהריץ מחדש בלי להעלות שום דבר.
 *
 * שתי תכונות של הטקסט שיוצא מ-PDF, ששתיהן משפיעות על הדפוסים כאן:
 *
 *  1. **תאי טבלה נדבקים בלי רווח**: `שם הלקוחצביקי`. לכן הדפוס הוא
 *     "תווית ואז מיד הערך", בלי לצפות למפריד.
 *  2. **שורות שמערבבות עברית ולטינית מתהפכות**: `סלקום TV + אינטרנט`
 *     יצא כ-`מגה 1000 + אינטרנט TV סלקום`. ערך כזה נשמר כמו שהוא —
 *     הוא לתצוגה בלבד ואף החלטה לא נשענת עליו.
 */

export interface ParsedContact {
  name: string;
  /// E.164 בלי הפלוס
  phone: string;
  city?: string;
  email?: string;
  provider?: string;
  packageName?: string;
  serviceType?: string;
  currentPrice?: number;
  futurePrice?: number;
  contractEndsAt?: Date;
  rawText: string;
}

/**
 * הערך שצמוד לתווית — **בשני הכיוונים**.
 *
 * ה-flag `m` הכרחי: בלעדיו `$` תופס את סוף המחרוזת כולה ולא את סוף
 * השורה, וכל ערך היה בולע את שאר המסמך.
 *
 * ⚠️⚠️ **שורה שמערבבת עברית וספרות מתהפכת בחילוץ, ולכן חייבים שני
 * דפוסים.** באותו מסמך בדיוק יוצאות שתי הצורות:
 *
 * ```
 * שם הלקוח: צביקי             ← עברית טהורה, סדר רגיל
 * 052-316-6990 טלפון נייד:    ← ספרות, והשורה התהפכה
 * ```
 *
 * הסיבה: הטקסט נשמר לפי מיקום הגלִיפים על העמוד, והחילוץ קורא
 * משמאל לימין. בפסקה RTL רצף הספרות יושב **משמאל** לתווית, ולכן הוא
 * יוצא ראשון. זה חל על כל שדה שערכו אינו עברי — טלפון, מייל, מחיר,
 * תאריך ושם חבילה באנגלית, כלומר על רוב השדות שבאמת חשובים.
 *
 * הגרסה הקודמת חיפשה רק "תווית ואז ערך", ולכן כל עמוד עם טלפון נדחה
 * כ"חסר טלפון" — המסמך נראה תקין לחלוטין והחילוץ החזיר אפס.
 */
/*
 * ⚠️ רווח **אופקי בלבד** — לא `\s`.
 *
 * `\s` כולל `\n`, ולכן דפוס כמו `(.+?)\s*תווית` יכול להתחיל בשורה
 * אחת, לבלוע את ירידת השורה, ולמצוא את התווית בשורה אחרת לגמרי. זה
 * לא תיאורטי: הוא החזיר את הערך של "יישוב" עבור התווית "טלפון נייד",
 * כלומר שדה מלא ותקין למראה שנשאב מהשורה הלא נכונה. ערך שגוי גרוע
 * בהרבה מערך חסר — חסר מדווח, שגוי נשלח ללקוח.
 */
const H = "[ \\t]";

/*
 * ⚠️ הערך חייב להתחיל בתו שאינו רווח **ואינו נקודתיים**.
 *
 * בלי זה הנקודתיים ב-`:?` נסוגות: על השורה `052-316-6990 טלפון נייד:`
 * המנוע מנסה להתאים `:` כמפריד, נכשל כי לא נשאר ערך, ואז מוותר על
 * המפריד ולוקח את הנקודתיים **עצמן** כערך. `after` החזיר `":"` — ערך
 * לא ריק, ולכן גם נחשב הצלחה וגם מנע את ניסיון הכיוון ההפוך.
 *
 * זה היה הבאג המקורי: כל עמוד עם טלפון חולץ כ-`":"`, נדחה ב-`phoneIn`,
 * והמסמך דווח כ"עמוד שדולג" בלי שום רמז לסיבה.
 */
const VALUE = `([^\\s:][^\\n]*?)`;

function after(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    // תווית ואז ערך
    const forward = new RegExp(
      `${label}${H}*:?${H}*${VALUE}${H}*$`,
      "m",
    ).exec(text);
    const ahead = forward?.[1]?.trim();
    if (ahead) return ahead;

    /*
     * ערך ואז תווית.
     *
     * ⚠️ מעוגן ב-`$` מיד אחרי התווית (ונקודתיים אופציונלית), ולכן
     * תווית שהיא תחילית של תווית ארוכה יותר לא תיתפס בטעות:
     * "תאריך סיום" לא מתאים לשורה שנגמרת ב"תאריך סיום תקופת ההטבה:".
     */
    const behind = new RegExp(
      `^${VALUE}${H}*${label}${H}*:?${H}*$`,
      "m",
    ).exec(text);
    const before = behind?.[1]?.trim();
    if (before) return before;
  }
  return undefined;
}

/** מספר עשרוני מתוך ערך שעשוי לכלול ₪, פסיקים ורווחים. */
function money(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = /(\d[\d,]*\.?\d*)/.exec(raw.replace(/,/g, ""));
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `DD/MM/YYYY` → תאריך.
 *
 * ⚠️ נבנה כצהריים UTC ולא כחצות. חצות בתאריך ישראלי הוא 21:00 או
 * 22:00 UTC של היום הקודם, ולכן כל הצגה שמסתמכת על `getDate` הייתה
 * מציגה יום אחד אחורה בחלק מהשנה. עוגן הצהריים חסין להפרשי אזור זמן.
 */
function israeliDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const m = /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(raw);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** מספר טלפון ישראלי כלשהו בתוך מחרוזת. */
function phoneIn(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  const m = /(0\d{8,9})/.exec(digits);
  return m ? toE164(m[1]) : undefined;
}

/**
 * שמות הספקים שאנחנו מזהים בכותרת העמוד.
 *
 * מחפשים בשורות הראשונות בלבד — "סלקום" מופיע גם בשם החבילה ובטקסט
 * המשפטי, וחיפוש בכל העמוד היה מחזיר התאמה שרירותית.
 */
const PROVIDERS = [
  "פרטנר",
  "סלקום",
  "פלאפון",
  "בזק",
  "HOT",
  "הוט",
  "YES",
  "גולן",
  "רמי לוי",
  "012",
  "019",
];

function providerIn(text: string): string | undefined {
  const head = text.split("\n").slice(0, 4).join("\n");
  return PROVIDERS.find((p) => head.includes(p));
}

/**
 * מפצל את הטקסט של המסמך לעמודים.
 *
 * ⚠️ `extractText` עם `mergePages` מחבר עמודים ב-`\n` ולא משאיר שום
 * סימן גבול. הכותרת "הודעה על סיום תקופת הטבה" היא מה שמסמן תחילת
 * עמוד — בחשבונית אמיתית זו תהיה כותרת אחרת, וזו עוד נקודה שתצטרך
 * התאמה כשיגיע מסמך אמיתי.
 */
const PAGE_MARKER = /^.*הודעה על סיום תקופת הטבה.*$/m;

export function splitPages(text: string): string[] {
  const lines = text.split("\n");
  const starts: number[] = [];

  lines.forEach((line, i) => {
    if (PAGE_MARKER.test(line)) {
      // הכותרת מופיעה אחרי שם הספק ופרטי החשבונית — מתחילים כמה
      // שורות קודם כדי שהספק ייכנס לעמוד שלו
      starts.push(Math.max(0, i - 4));
    }
  });

  if (starts.length === 0) return [text];

  return starts
    .map((start, i) => lines.slice(start, starts[i + 1] ?? lines.length).join("\n"))
    .filter((p) => p.trim().length > 0);
}

/**
 * חילוץ עמוד יחיד.
 *
 * מחזיר `null` כשאין שם או אין טלפון תקין — שניהם חובה, כי בלעדיהם
 * אין למי לשלוח ואין מה לכתוב בהודעה. עמוד כזה מדולג ומדווח, ולא
 * נשמר כאיש קשר שבור.
 */
export function parseContact(pageText: string): ParsedContact | null {
  const name = after(pageText, ["שם הלקוח", "שם המנוי", "לכבוד"]);
  const phone = phoneIn(after(pageText, ["טלפון נייד", "טלפון", "נייד"]));

  if (!name || !phone) return null;

  return {
    name,
    phone,
    city: after(pageText, ["יישוב", "ישוב", "עיר"]),
    email: after(pageText, ["דואר אלקטרוני", "אימייל", "מייל"])?.match(
      /[^\s@]+@[^\s@]+\.[^\s@]+/,
    )?.[0],
    provider: providerIn(pageText),
    packageName: after(pageText, ["שם החבילה", "החבילה", "מסלול"]),
    serviceType: after(pageText, ["סוג שירות", "סוג השירות"]),
    currentPrice: money(after(pageText, ["מחיר חודשי בתקופת ההטבה"])),
    futurePrice: money(after(pageText, ["מחיר חודשי לאחר סיום ההטבה"])),
    contractEndsAt: israeliDate(
      after(pageText, ["תאריך סיום תקופת ההטבה", "תאריך סיום"]),
    ),
    rawText: pageText,
  };
}

export interface ParseOutcome {
  contacts: ParsedContact[];
  /** עמודים שלא הצליחו — מספר העמוד (1-based) */
  skippedPages: number[];
}

export function parseDocument(text: string): ParseOutcome {
  const pages = splitPages(text);
  const contacts: ParsedContact[] = [];
  const skippedPages: number[] = [];

  pages.forEach((page, i) => {
    const parsed = parseContact(page);
    if (parsed) contacts.push(parsed);
    else skippedPages.push(i + 1);
  });

  return { contacts, skippedPages };
}
