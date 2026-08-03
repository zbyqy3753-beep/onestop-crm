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

/** מזהה המופע — מופיע במסך הניהול, כדי ש"שני דפקים" יהיה ניתן לאבחון. */
export const INSTANCE_ID =
  process.env.BOT_INSTANCE_ID?.trim() || `office-${process.pid}`;

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
 * התוצאה הייתה `pair` שמסרב לרוץ ו-`serve` שעולה בלי סשן אמיתי,
 * מתחבר לשום מקום, ומשאיר את הרצועה ענברית בלי הסבר.
 *
 * `registered` נכתב על ידי Baileys רק אחרי צימוד שהצליח.
 */
export function isPaired(): boolean {
  const file = resolve(AUTH_DIR, "creds.json");
  if (!existsSync(file)) return false;

  try {
    const creds: unknown = JSON.parse(readFileSync(file, "utf8"));
    return (
      typeof creds === "object" &&
      creds !== null &&
      (creds as { registered?: unknown }).registered === true
    );
  } catch {
    // קובץ פגום = אין חיבור שאפשר לסמוך עליו
    return false;
  }
}
