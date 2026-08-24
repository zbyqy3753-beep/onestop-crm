import type { Lead, StatusTone } from "@/lib/domain/types";

/**
 * שכבות "תור העבודה" — הסדר שבו הלידים כבר ממוינים כברירת מחדל.
 *
 * ⚠️ הקובץ הזה קיים כדי שיהיה **מקור אמת אחד**. הדירוג ישב בתוך ה-`useMemo`
 * של `sorted` ב-`LeadsClient`, כלומר הטבלה שרינדרה את התוצאה לא יכלה לדעת
 * למה שורה יושבת איפה שהיא יושבת. הסדר היה נכון ונראה אקראי — וסדר שנראה
 * אקראי הוא סדר שמבטלים בלחיצה על כותרת עמודה.
 *
 * כאן מוגדר הדירוג פעם אחת, המיון קורא ממנו, והכותרות בטבלה וברשימת
 * הכרטיסים קוראות מאותו מקום. אי אפשר שהם ייפרדו.
 */
export type QueueTier = "late" | "today" | "new" | "rest";

export const QUEUE_TIERS: {
  key: QueueTier;
  label: string;
  tone: StatusTone;
  /**
   * מה השכבה אומרת, במילים. מוצג ליד השם בכותרת המפרידה —
   * "באיחור" לבדו לא מבדיל בין "מועד החזרה עבר" לבין "הליד יושב
   * יותר מדי זמן", ושתי הקריאות סבירות באותה מידה.
   */
  hint: string;
}[] = [
  {
    key: "late",
    label: "באיחור",
    tone: "bad",
    hint: "מועד החזרה עבר",
  },
  {
    key: "today",
    label: "לחזור היום",
    tone: "warn",
    hint: "מועד החזרה הוא היום",
  },
  {
    key: "new",
    label: "חדשים שלא טופלו",
    tone: "info",
    hint: "נכנסו ואיש עוד לא נגע בהם",
  },
  {
    key: "rest",
    label: "השאר",
    tone: "neutral",
    hint: "לפי עדכון אחרון",
  },
];

export const QUEUE_TIER_ORDER: QueueTier[] = QUEUE_TIERS.map((t) => t.key);

export const QUEUE_TIER_META = Object.fromEntries(
  QUEUE_TIERS.map((t) => [t.key, t]),
) as Record<QueueTier, (typeof QUEUE_TIERS)[number]>;

/**
 * מה שהרשימות מקבלות כדי לצייר כותרות הפרדה.
 *
 * ⚠️ `null` הוא מצב תקף ואפילו שכיח: מיון שאינו "תור עבודה", או לפני
 * ההרכבה כשאין שעון לקוח. הרשימה פשוט לא מציירת כותרות.
 */
export interface QueueTiers {
  of: (lead: Lead) => QueueTier;
  /** סך השכבה בתוצאה המסוננת כולה — לא בעמוד המוצג */
  totals: Record<QueueTier, number>;
}

/**
 * לאיזו שכבה שייך הליד.
 *
 * ⚠️ `late` ו-`today` הן **שכבה אחת מבחינת המיון** — שתיהן "מועד החזרה הגיע",
 * וסדר הפנימי בשתיהן זהה (המוקדם ביותר קודם). הפיצול הוא בשמות בלבד, ולכן
 * הוספת הכותרות לא הזיזה אף שורה ממקומה: "באיחור" תמיד קודם ל"היום" כי
 * תאריכו מוקדם יותר, לא כי מישהו מיין לפי השכבה.
 *
 * ⚠️ **חייב שעון לקוח.** `startOfToday`/`endOfToday` נגזרים מ-`useNow()`,
 * שמחזיר `null` עד ההרכבה. הקוראים לא מזמנים את הפונקציה לפני כן — ראה
 * `LeadsClient` › `queueSort`.
 */
export function queueTier(
  lead: Lead,
  startOfToday: number,
  endOfToday: number,
): QueueTier {
  if (lead.followUpAt) {
    const at = Date.parse(lead.followUpAt);
    if (at < startOfToday) return "late";
    if (at <= endOfToday) return "today";
  }
  if (lead.status === "new") return "new";
  return "rest";
}

/**
 * ההשוואה של מיון "תור העבודה", מלאה.
 *
 * הוצאה לכאן ולא נשארה ב-`LeadsClient` כדי שהדירוג וההשוואה לא יוכלו לספר
 * שני סיפורים שונים: כותרת שאומרת "באיחור" מעל שורה שממוינת לפי `updatedAt`
 * גרועה מאין כותרת בכלל.
 */
export function compareQueue(
  a: Lead,
  b: Lead,
  startOfToday: number,
  endOfToday: number,
): number {
  const ta = queueTier(a, startOfToday, endOfToday);
  const tb = queueTier(b, startOfToday, endOfToday);

  if (ta !== tb) {
    return QUEUE_TIER_ORDER.indexOf(ta) - QUEUE_TIER_ORDER.indexOf(tb);
  }

  // באיחור / להיום: החזרה המוקדמת ביותר קודם (הכי באיחור למעלה)
  if (ta === "late" || ta === "today") {
    return Date.parse(a.followUpAt!) - Date.parse(b.followUpAt!);
  }
  // חדשים: החדש ביותר קודם
  if (ta === "new") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  // השאר: העדכני ביותר קודם. הכיוון (`dir`) לא חל על התור — "תור הפוך"
  // הוא לא סדר שמישהו מתכוון אליו
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

/** כמה לידים בכל שכבה, על פני התוצאה המסוננת כולה (לא העמוד המוצג). */
export function countByTier(
  leads: Lead[],
  startOfToday: number,
  endOfToday: number,
): Record<QueueTier, number> {
  const out = { late: 0, today: 0, new: 0, rest: 0 };
  for (const lead of leads) out[queueTier(lead, startOfToday, endOfToday)] += 1;
  return out;
}

/**
 * ההשוואה של לשונית "חזרה ללקוח": **לוח זמנים מעכשיו וקדימה.**
 *
 * ⚠️ שונה במתכוון מ-`compareQueue`. שם המוקדם ביותר קודם, כלומר חזרה
 * שנקבעה לפני שבועיים ופוספסה יושבת מעל חזרה שנקבעה לעוד עשר דקות.
 * בתור העבודה הכללי זה נכון — איחור הוא חוב. בלשונית שכולה חזרות
 * מתוזמנות זה הפוך: היא נקראת כלוח זמנים, והשאלה שהיא עונה עליה היא
 * "למי אני חוזר עכשיו ואחר כך", לא "כמה חוב הצטבר".
 *
 * לכן הסדר הוא בשתי שכבות:
 *
 *   1. **מה שעוד לפנינו**, מהקרוב לרחוק — 10:30, 12:00, מחר.
 *   2. **מה שכבר עבר**, מהטרי לישן — קודם מי שפוספס לפני חצי שעה,
 *      אחר כך של אתמול. הם למטה כי שעתם חלפה, ולא בסוף העולם כי
 *      עדיין צריך לחזור אליהם.
 *
 * ⚠️ **המרחק המוחלט מעכשיו לא מספיק כאן.** לפיו חזרה שאיחרה ברבע שעה
 * שווה ברלוונטיות לחזרה שבעוד רבע שעה, ולכן איחור צף לראש הרשימה —
 * בדיוק המצב שהלשונית הזו אמורה למנוע.
 *
 * ⚠️ ליד בלי תאריך חזרה תמיד בסוף — אין לו מקום על ציר השעות.
 */
export function compareByProximity(a: Lead, b: Lead, now: number): number {
  const av = followUpTime(a);
  const bv = followUpTime(b);
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;

  const aPast = av < now;
  const bPast = bv < now;
  // שכבה לפני שעה: עתידי תמיד מעל מה שכבר עבר, גם אם העתידי רחוק יותר
  if (aPast !== bPast) return aPast ? 1 : -1;
  // בתוך העתיד — הקרוב ביותר קודם. בתוך העבר — הטרי ביותר קודם
  return aPast ? bv - av : av - bv;
}

/** מועד החזרה כמספר. `null` = אין מועד, או מועד פגום. */
function followUpTime(lead: Lead): number | null {
  if (!lead.followUpAt) return null;
  const at = Date.parse(lead.followUpAt);
  // תאריך פגום מגיע לכאן כ-NaN, וכל השוואה איתו מחזירה false — כלומר
  // הליד היה נוחת במקום אקראי ברשימה. סופו של הסדר, כמו ליד בלי מועד.
  return Number.isNaN(at) ? null : at;
}
