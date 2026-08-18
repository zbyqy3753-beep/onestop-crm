import "server-only";

/**
 * מפתחות API לשותפים חיצוניים ששולחים לידים למערכת.
 *
 * הרישום חי ב-env ולא ב-DB: מספר השותפים קטן, וכך אפשר לבטל מפתח
 * שדלף בלי מיגרציה ובלי פריסת קוד — משנים משתנה סביבה ומפעילים מחדש.
 *
 * פורמט `LEADS_API_KEYS` — זוגות `מפתח:שם`, מופרדים בפסיק:
 *
 *   LEADS_API_KEYS="os_moshe_a1b2c3d4e5:משה,os_dana_9f8e7d:דנה"
 *
 * השם הוא מה שיירשם בשדה "מקור" של הליד כשהשותף לא שולח `source`
 * משלו — כך רואים בטבלה מי הביא כל ליד.
 *
 * ⚠️ בלי `LEADS_API_KEYS` הרשימה ריקה וכל בקשה נדחית ב-401. זו
 * ברירת המחדל הבטוחה: נקודת קצה ציבורית בלי מפתחות מוגדרים היא
 * דלת פתוחה, ולכן היא סגורה.
 */

export interface ApiPartner {
  /** שם השותף לתצוגה — נכנס ל-`sourceDetail` של הליד */
  name: string;
}

interface Registered extends ApiPartner {
  key: string;
}

function registry(envVar: string): Registered[] {
  const raw = process.env[envVar]?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => {
      // רק המפריד הראשון נחשב — שם שותף יכול להכיל נקודתיים
      const separator = entry.indexOf(":");
      if (separator === -1) return null;

      const key = entry.slice(0, separator).trim();
      const name = entry.slice(separator + 1).trim();
      if (!key || !name) return null;

      return { key, name };
    })
    .filter((p): p is Registered => p !== null);
}

/**
 * השוואה בזמן קבוע. מונעת דליפת המפתח דרך מדידת זמן התגובה.
 * מימוש ידני ולא `crypto.timingSafeEqual` כדי שהקוד יעבוד גם אם
 * הנתיב ירוץ יום אחד ב-Edge runtime, שבו `node:crypto` לא זמין.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * מזהה את השותף מהמפתח שנשלח, או `null` אם הוא חסר/לא מוכר.
 *
 * הלולאה עוברת על **כל** המפתחות גם אחרי התאמה, כדי שזמן התשובה
 * לא יסגיר כמה מפתחות רשומים ואיפה ברשימה נמצא המפתח שנשלח.
 */
export function partnerFromKey(provided: string | null): ApiPartner | null {
  return fromKey(provided, "LEADS_API_KEYS");
}

/** שם השדה/הפרמטר שנושא את המפתח מחוץ לכותרת. */
export const API_KEY_FIELD = "api_key";

/**
 * המפתח מתוך הבקשה — כותרת `x-api-key` תחילה, ואם אין, `?api_key=`.
 *
 * ⚠️ **הכותרת קודמת, וזה לא סדר שרירותי.** מפתח ב-query string נרשם
 * ב-URL המלא בלוגי הגישה של Vercel ובכל פרוקסי בדרך, ועלול לדלוף גם
 * דרך `Referer`. הכותרת לא. מי ששולח את שניהם מקבל את הנתיב הבטוח.
 *
 * הפרמטר קיים משום ששותפים מריצים קרון שלא תמיד יודע להרכיב כותרות,
 * והחלופה — שהם ישלחו לידים בלי אימות בכלל — גרועה יותר. **התיעוד
 * לשותפים מציע קודם את הגוף** (`api_key` בתוך ה-JSON), שפותר את אותה
 * מגבלה בלי שהמפתח יגיע לשום לוג. ראה docs/leads-api.md.
 */
export function apiKeyFromRequest(request: {
  headers: { get(name: string): string | null };
  nextUrl: { searchParams: URLSearchParams };
}): string | null {
  const header = request.headers.get("x-api-key");
  if (header) return header;

  return request.nextUrl.searchParams.get(API_KEY_FIELD);
}

/**
 * המפתח מתוך גוף בקשה גולמי, אם הוא שם.
 *
 * ⚠️ סלחני בכוונה: גוף שאינו JSON תקין מחזיר `null` ולא זורק, כדי
 * שבקשה לא מאומתת תיפול על 401 ולא על 400. 400 היה מאשר לכל מי
 * שמנחש שהנקודה קיימת ומה החוזה שלה.
 */
export function apiKeyFromBody(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const value = (parsed as Record<string, unknown>)[API_KEY_FIELD];
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

/**
 * מזהה את בוט הוואטסאפ מכותרת `x-api-key`.
 *
 * ⚠️ רישום **נפרד** מ-`LEADS_API_KEYS` בכוונה. הבוט רץ על מחשב לא
 * מאובטח במשרד, ואין שום סיבה שמפתח שיושב שם יוכל גם ליצור לידים.
 * הפרדה כאן היא ההבדל בין "המחשב במשרד נפרץ" ל"אפשר להזריק לידים".
 *
 *   WHATSAPP_API_KEYS="os_bot_a1b2c3d4:בוט המשרד"
 */
export function botFromKey(provided: string | null): ApiPartner | null {
  return fromKey(provided, "WHATSAPP_API_KEYS");
}

function fromKey(provided: string | null, envVar: string): ApiPartner | null {
  if (!provided) return null;

  let match: ApiPartner | null = null;
  for (const partner of registry(envVar)) {
    if (safeEqual(provided, partner.key)) match = { name: partner.name };
  }
  return match;
}
