import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * תצורת הבוט. הכול מ-`bot/.env` — הקובץ הזה לא נכנס ל-git.
 *
 * ⚠️ הבוט **לא** מחזיק את פרטי החיבור למסד הנתונים, בכוונה. הוא רץ
 * על מחשב לא מאובטח במשרד, ומפתח API מוגבל לשתי נקודות קצה הוא נזק
 * קטן בהרבה מגישת קריאה־כתיבה לכל הטבלאות.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** `bot/` — שורש הפרויקט של הבוט, לא של ה-CRM. */
export const BOT_ROOT = resolve(here, "..");

/** תיקיית הסשן של וואטסאפ. מחיקתה = ניתוק והתחלה מחדש מסריקת QR. */
export const AUTH_DIR = resolve(BOT_ROOT, "auth");

export const QR_PATH = resolve(BOT_ROOT, "qr.png");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\n✗ חסר ${name} בקובץ bot/.env`);
    console.error(`  העתק את bot/.env.example ל-bot/.env ומלא אותו.\n`);
    process.exit(1);
  }
  return value;
}

export const CRM_BASE_URL = () => required("CRM_BASE_URL").replace(/\/$/, "");
export const WA_API_KEY = () => required("WA_API_KEY");

/**
 * גרסת הבוט.
 *
 * ⚠️ **להעלות ידנית בכל שינוי בקוד הבוט.** המחשב במשרד הוא clone
 * נפרד של המאגר, ואין שום דבר שמכריח אותו להיות מעודכן. בלי המספר
 * הזה "הבוט לא עושה X" ו"הבוט מריץ קוד מלפני שבוע" נראים בדיוק
 * אותו דבר — וזה בדיוק הבלבול שעלה שעה שלמה לאבחן.
 *
 * מופיע בלוג בהפעלה ובמסך הבוטים ליד מזהה המופע.
 */
export const BOT_VERSION = "4";

/** מה נוסף בגרסה הזו, לקריאה מהירה בלוג. */
export const BOT_FEATURES = "ממפה @lid למספר טלפון — תשובות משויכות ללקוח";

/** מזהה המופע — מופיע במסך הניהול, כדי ש"שני דפקים" יהיה ניתן לאבחון. */
/**
 * ⚠️ הגרסה חלק מהמזהה, ולא שדה נפרד.
 *
 * המזהה כבר נשלח בכל דופק ומוצג במסך הבוטים, ולכן זו הדרך להפוך את
 * "איזה קוד רץ במשרד" לשאלה שנענית מהדפדפן — בלי שינוי סכימה ובלי
 * לנסוע למשרד.
 */
export const INSTANCE_ID = `${
  process.env.BOT_INSTANCE_ID?.trim() || `office-${process.pid}`
} v${BOT_VERSION}`;

/** כל כמה זמן לשאול את ה-CRM מה יש לשלוח. */
export const POLL_INTERVAL_MS = 60_000;

/** ריווח אנושי בין הודעות — שליחה ברצף מהיר היא דפוס של בוט. */
export const SEND_GAP_MIN_MS = 3_000;
export const SEND_GAP_MAX_MS = 8_000;

/**
 * האם הצימוד באמת הושלם.
 *
 * ⚠️ **לא** מספיק לבדוק שהקובץ קיים. Baileys כותב `creds.json` כבר
 * ברגע יצירת החיבור, לפני שמישהו סרק משהו — כך שניסיון צימוד שנקטע
 * באמצע (סגירת החלון, Ctrl+C) משאיר קובץ שנראה כמו חיבור תקין.
 *
 * ⚠️⚠️ וגם **לא** `registered`. השדה הזה נראה כמו התשובה הנכונה והוא
 * מלכודת: הוא נקבע ל-true רק בזרימת קוד-הצימוד הטלפוני
 * (`messages-recv.js`), ובצימוד QR הוא נשאר `false` לנצח. הסימן
 * האמיתי הוא `me.id`, שנכתב ב-`configureSuccessfulPairing` בדיוק
 * כשהצימוד מצליח. שתי הזרימות נתמכות כאן.
 */
export function isPaired(): boolean {
  const file = resolve(AUTH_DIR, "creds.json");
  if (!existsSync(file)) return false;

  try {
    const creds = JSON.parse(readFileSync(file, "utf8")) as {
      registered?: unknown;
      me?: { id?: unknown };
    } | null;
    if (typeof creds !== "object" || creds === null) return false;

    return creds.registered === true || typeof creds.me?.id === "string";
  } catch {
    // קובץ פגום = אין חיבור שאפשר לסמוך עליו
    return false;
  }
}
