import type { LeadCategoryKey, ProviderKey } from "./types";
import { PROVIDER_CONFIG, PROVIDER_ORDER, matchLeadCategory } from "./types";

/**
 * פענוח "במה הליד מתעניין" מטקסט חופשי.
 *
 * ⚠️ המודול הזה קיים כי **אותה מחרוזת מגיעה משני מקורות**: שדה `source`
 * ב-`POST /api/leads`, ועמודת "שם חבילה" בקבצי הייבוא של אותו שותף.
 * שני הנתיבים חייבים לפרש אותה זהה — אחרת אותו ליד ייראה אחרת לפי
 * הדרך שבה נכנס, וזה בדיוק סוג ההבדל שאף אחד לא מגלה עד שהוא מבלבל
 * מישהו בטלפון.
 */

/* ── תווי כיווניות ────────────────────────────────────────────────────── */

/**
 * טווחי תווי בקרת הכיווניות (LRM/RLM, embedding, isolates).
 *
 * מערכות שמרכיבות מחרוזות מעורבות עברית-אנגלית מזריקות אותם כדי
 * שהתצוגה שלהן תיראה נכון, והם מגיעים אלינו בתוך הערך — גם ב-JSON וגם
 * בתאי אקסל. הם בלתי נראים אבל אמיתיים: בלי ניקוי הם נשמרים ל-DB,
 * ושוברים כל השוואת מחרוזות (`"‎פלאפון"` אינו `"פלאפון"`).
 *
 * מוגדרים כקודים ולא כתווים בתוך regex בכוונה — תו בלתי נראה בקוד
 * המקור הוא בדיוק הדבר שנעלם בעריכה או בהעתקה ואף אחד לא שם לב.
 */
const BIDI_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];

export function stripBidi(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (BIDI_RANGES.some(([lo, hi]) => code >= lo && code <= hi)) continue;
    out += ch;
  }
  return out;
}

/** ניקוי סטנדרטי לכל ערך טקסט שמגיע מבחוץ. */
export function cleanText(value: unknown): string {
  return typeof value === "string" ? stripBidi(value).trim() : "";
}

/* ── זיהוי ספק ────────────────────────────────────────────────────────── */

/** שם ספק בטקסט חופשי → מפתח ספק מוכר, אם יש התאמה. */
export function matchProvider(raw: string): ProviderKey | undefined {
  const normalized = cleanText(raw).toLowerCase();
  if (!normalized) return undefined;

  return PROVIDER_ORDER.find(
    (key) =>
      key === normalized ||
      PROVIDER_CONFIG[key].label.toLowerCase() === normalized,
  );
}

/* ── פענוח המחרוזת ────────────────────────────────────────────────────── */

export interface Interest {
  category?: LeadCategoryKey;
  provider?: ProviderKey;
  packageName?: string;
}

/**
 * מפענח מחרוזת חופשית לעמודות אמיתיות.
 *
 * ⚠️ זה לא ניחוש. אלה הצורות שנצפו בפועל אצל השותף, בשדה `source`
 * של ה-API ובעמודת "שם חבילה" של קובץ הייבוא:
 *
 * | מה שהגיע                       | מה שהתכוונו |
 * | ------------------------------ | ----------- |
 * | `"ULTIMATE – YES"`             | חבילה + ספק |
 * | `"פלאפון – 300GB Perfect"`     | ספק + חבילה |
 * | `"FIBER YES+ – YES"`           | חבילה + ספק |
 * | `"טריפל – יס"`                 | קטגוריה + ספק |
 * | `"טריפל"`                      | קטגוריה     |
 *
 * **סדר החלקים הפוך בין שורות של אותו שותף**, ולכן אין הנחה על מיקום:
 * מה שמזוהה כספק מוכר הוא הספק, מה שמזוהה כשם קטגוריה הוא הקטגוריה,
 * ומה שנשאר הוא החבילה.
 *
 * כששני החלקים מזוהים כספק, או אף אחד מהם — מוחזר אובייקט ריק. עדיף
 * להשאיר את הערך במקום שהוא בו מאשר להמציא ממנו נתון שנראה אמיתי.
 */
const SPLIT = /\s+[–—|-]\s+/;

export function parseInterest(raw: string): Interest {
  const parts = cleanText(raw)
    .split(SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);

  // ערך יחיד: או שם קטגוריה, או טקסט חופשי שלא נוגעים בו
  if (parts.length === 1) {
    const category = matchLeadCategory(parts[0]);
    return category ? { category } : {};
  }
  if (parts.length !== 2) return {};

  const [first, second] = parts;
  const firstProvider = matchProvider(first);
  const secondProvider = matchProvider(second);

  let provider: ProviderKey;
  let rest: string;
  if (firstProvider && !secondProvider) {
    provider = firstProvider;
    rest = second;
  } else if (secondProvider && !firstProvider) {
    provider = secondProvider;
    rest = first;
  } else {
    return {};
  }

  // `"טריפל – יס"` הוא קטגוריה+ספק, לא חבילה+ספק. בלי הבדיקה הזו
  // "טריפל" היה נרשם כשם חבילה, וזה שקר שנראה כמו נתון.
  const category = matchLeadCategory(rest);
  return category ? { provider, category } : { provider, packageName: rest };
}
