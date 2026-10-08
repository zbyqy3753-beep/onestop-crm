import catalogJson from "./packages.json";
import { isElectricity, isHomeSpec } from "./types";
import type { Catalog, Category, Package, Provider } from "./types";

/**
 * ── הקטלוג של דף הנחיתה ────────────────────────────────────────────────
 *
 * ⚠️ **עותק.** המקור הוא פרויקט האתר הציבורי (`onestop-site`), שם
 * `data/packages.json` נשאב מ-`crm.onestopil.co` בכלי נפרד. הקובץ הועתק
 * לכאן במודע כדי שדף הנחיתה יחיה על הדומיין של ה-CRM בלי תלות באתר —
 * וזה אומר שרענון קטלוג צריך לקרות **בשני המקומות**.
 *
 * ⚠️ **בלי שכבת העריכה.** באתר הציבורי הקטלוג ממוזג עם טבלת
 * `PackageOverride` (הסתרה, הצמדה, מחיר מתוקן) לפני שהוא מוצג. כאן אין
 * מסד כזה, ולכן מוצגת שכבת הבסיס בלבד: חבילה שהוסתרה במערכת הניהול של
 * האתר **תופיע** בדף הזה. זו התנהגות מודעת ולא באג — אבל אם מסתירים
 * חבילה שם, צריך לזכור אותה גם כאן.
 *
 * הייבוא הוא build-time ולא קריאת רשת: הקובץ משתנה רק כשמריצים את
 * מחלץ הקטלוג מחדש.
 */
export const catalog = catalogJson as unknown as Catalog;

/**
 * שם חבילה כפי שמציגים אותו לגולש.
 *
 * ⚠️ המחלץ משאיר בשם שאריות שלו, והן עולות לייצור כמות שהן: `[line]`
 * הוא מפריד גולמי שהפך לחלק מהכותרת ("סלקום משפחתי פלוס [line] חבילה
 * זו מיועדת לבעלי כרטיס אשראי בלבד" — וההמשך שאחריו הוא ממילא השורה
 * הראשונה של ה-`description`), `*2*` הוא סימון פנימי של גרסה שנייה
 * לאותה חבילה, ורווח כפול הוא פשוט טקסט שנקטע. כל השאריות האלה נראות
 * היום בדף החי.
 *
 * ⚠️ הניקוי כאן ולא בקובץ ה-JSON: הקובץ נכתב מחדש בכל רענון קטלוג
 * (ובשני מקומות — ראה ההערה למעלה), ולכן תיקון ידני בו נמחק בפעם
 * הבאה. `*IBC*` נשמר בסוגריים ולא נמחק כי IBC הוא שם התשתית ומבדיל
 * בין שתי חבילות סיבים של אותו ספק — רק המספר הוא סימון פנימי.
 *
 * ⚠️ נפילה חזרה למקור כשהניקוי מרוקן את השם: כותרת ריקה גרועה
 * משארית, ושם שכולו סימון פנימי הוא סימן שהנחת היסוד כאן לא מתקיימת.
 */
export function displayName(raw: string): string {
  const cleaned = raw
    .split("[line]")[0]
    .replace(/\*(\d+)\*/g, " ")
    .replace(/\*([^*\s]+)\*/g, " ($1)")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw;
}

/**
 * השם שלוגיקה צריכה לקרוא — הגולמי, לפני ניקוי התצוגה.
 *
 * ⚠️ כל מי שמחפש ראיה בתוך השם — סימון פנימי, מספר קווים,
 * מילה שמעידה על קטגוריה — חייב לעבור דרך כאן ולא לקרוא את
 * `name` ישירות.
 */
export function logicName(p: Package): string {
  return p.rawName ?? p.name;
}

export function basePackages(): Package[] {
  return catalog.packages.map((p) => {
    const name = displayName(p.name);
    return name === p.name ? p : { ...p, name, rawName: p.name };
  });
}

/**
 * ⚠️ `hash` ולא `path`, בשונה מהאתר הציבורי.
 *
 * שם לכל קטגוריה יש עמוד משלה (`/cellular`, `/home`, `/electricity`).
 * כאן הכול עמוד אחד, והקטלוג מחליף קטגוריה בצד הלקוח — ראה
 * `CatalogTabs`, שמאזין לעוגן הזה. נתיב אמיתי כאן היה קישור מת.
 */
export const CATEGORY_META: Record<Category, { he: string; blurb: string; hash: string }> = {
  cellular: {
    he: "סלולר",
    blurb: "חבילות סלולר מכל החברות — כולל המחיר אחרי תום ההטבה",
    hash: "#cellular",
  },
  home: {
    he: "אינטרנט וטלוויזיה",
    blurb: "סיבים, טריפל, טלוויזיה וקו ביתי — מחיר, מהירות ועלות התקנה",
    hash: "#home",
  },
  electricity: {
    he: "חשמל",
    blurb: "מסלולי הנחה על חשבון החשמל, לבית ולעסק",
    hash: "#electricity",
  },
};

export const CATEGORY_ORDER: Category[] = ["cellular", "home", "electricity"];

export function byCategory(packages: Package[], category: Category): Package[] {
  return packages.filter((p) => p.category === category);
}

/**
 * מספר שאפשר להציג כמחיר (או כאחוז הנחה) — ולא מחרוזת שנראית כמו אחד,
 * לא `0` ולא ערך שלילי.
 *
 * ⚠️ אותה פונקציה בדיוק כמו `isMoney` ב-`savings.ts`, ומאותו טעם:
 * הקטלוג נכנס דרך `as unknown as Catalog`, כלומר אין ולידציה בזמן ריצה.
 * כאן היא מרוכזת כדי ששלושת השערים שמתחתיה (`isListable`, `afterPrice`
 * ו-`byPrice`) יקראו את אותה הגדרה של "מספר שמותר לדרג לפיו" — שתי
 * הגדרות שונות לאותו שדה הן בדיוק המלכודת שההערות כאן מתריעות עליה.
 */
function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * חבילה שאפשר להציג. חבילת חשמל נמדדת באחוז הנחה ולא במחיר, ולכן
 * לשתיהן תנאי משלהן.
 *
 * ⚠️ `editorial?.hidden` נשמר בבדיקה למרות שאין כאן שכבת עריכה: השדה
 * קיים בטיפוס, וקובץ קטלוג שיועתק בעתיד מגרסה שכן נשמרה איתו יכובד
 * מעצמו במקום להציג בשקט חבילה שהוסתרה.
 */
/**
 * ⚠️ `typeof === "number"` ולא `!= null`.
 *
 * הקטלוג נכנס לקוד דרך `as unknown as Catalog`, כלומר **אין ולידציה
 * בזמן ריצה** — הטיפוסים נבדקים על הקובץ שקיים היום, לא על הקובץ
 * שהרענון הבא יכתוב. הנתונים הנוכחיים נקיים (כל 90 המחירים מספריים),
 * אבל `"39.9" != null` הוא `true` וגם `"39.9" > 0` הוא `true`: מחיר
 * שיישאב פעם אחת כמחרוזת יעבור את השער הזה, יגיע ל-`shekels()` ול-
 * `perLinePrice`, ויוצג לגולש כ-`NaN`. השער הוא המקום היחיד שכל
 * החבילות עוברות בו, ולכן כאן נעצרת רשומה פגומה — בשקט ומראש.
 */
/*
 * ⚠️ `> 0` **בשני** הענפים.
 *
 * הענף החודשי דרש מחיר חיובי ("מחיר 0 מייצר חיסכון של מלוא החשבון"),
 * ואילו ענף החשמל הסתפק במספר סופי — כלומר `discountPercent: 0` עבר
 * את השער ועלה לדף כמסלול הנחה אמיתי, עם הכותרת "0% הנחה". גרוע
 * מזה: `afterPrice` ו-`byPrice` מדרגות חשמל כ-`-discountPercent`,
 * ולכן מסלול של 0% (או שלילי, שגם הוא עבר) מדורג כ**זול ביותר**
 * בקטגוריה ונכנס ל-`highlights` ול-`cheapest`. הקטלוג של היום נקי —
 * אין אף רשומה עם `discountPercent <= 0` — ולכן זה שער לרענון הבא,
 * בדיוק מאותו טעם שהענף החודשי נכתב כך.
 */
export function isListable(p: Package): boolean {
  if (p.editorial?.hidden) return false;
  return p.category === "electricity"
    ? isMoney(p.discountPercent)
    : isMoney(p.price);
}

export function listable(packages: Package[]): Package[] {
  return packages.filter(isListable);
}

/**
 * האם אחוז ההנחה שהרשומה מצהירה עליו הוא **תקרה** ולא שיעור קבוע.
 *
 * ⚠️ הכרטיס הדפיס "10% הנחה" במספר הגדול ביותר שלו על ids 135 ו-142,
 * שתיהן הנחה מדורגת לפי גובה החשבון (10% עד ₪149, ואז 8%/7%/6%/5%) —
 * כלומר לקוח בצריכה של ₪300 ומעלה מקבל חצי ממה שהכרטיס הכריז. ב-135
 * הכותרת שעל אותו כרטיס אומרת "עד 10% הנחה", כך ששתי אמירות סותרות
 * ישבו זו מעל זו. "לא יודעים — לא מבטיחים" הוא אותו כלל שחל בענף
 * החודשי על המחיר שאחרי ההטבה; לענף החשמל לא היה לו מקביל.
 *
 * ⚠️ נדרשת התאמה **לאותו מספר** שהרשומה מצהירה עליו, ולא עצם הימצאות
 * המילה "עד" בפרוזה: רק כך השער מצמצם הבטחה ולא מרחיב אותה.
 *
 * ⚠️ הפונקציה יושבת כאן ולא ב-`format.ts`, למרות שהצרכנים שלה הם
 * כרטיס וטבלה: `electricityRank` שמתחתיה חייבת אותה, `format.ts` כבר
 * מייבא מכאן (`logicName`), וייבוא בכיוון ההפוך היה סוגר מעגל.
 * `format.ts` מייצאת אותה מחדש, כך שאף צרכן לא ידע על ההעברה.
 */
export function discountIsCapped(p: Package): boolean {
  if (p.category !== "electricity" || typeof p.discountPercent !== "number") return false;
  /*
   * ⚠️ `logicName` ולא `p.name`. זו לוגיקה שמחפשת ראיה בתוך השם, ולכן
   * היא כפופה לאינווריאנט ב-`catalog.ts:51-58`. `displayName` **קוטעת
   * כל מה שאחרי `[line]`** (קורה בפועל ב-id 36), ולכן רשומת חשמל
   * שמשפט התקרה שלה נופל אחרי הסימן הייתה מפסיקה להיזהות כתקרה
   * והכרטיס היה מבטיח שיעור קבוע במקום "עד".
   */
  const prose = [logicName(p), p.description, p.benefits].filter(Boolean).join(" ");
  /*
   * ⚠️ `עד` כמילה ולא כתת-מחרוזת: שתיים מ-19 רשומות החשמל הן מסלולי
   * **ועד בית** (142, 145), ו-"ועד 10%" אינו הצהרת תקרה.
   */
  for (const m of prose.matchAll(/(?<![א-ת])עד\s*(\d+(?:[.,]\d+)?)\s*%/g)) {
    if (Number(String(m[1]).replace(",", ".")) === p.discountPercent) return true;
  }
  return false;
}

/**
 * ⚠️ קבוע ולא מקדם. מסלול חלקי-שעות יורד **קבוצה שלמה**, ולא אחוז
 * מוכפל — ראה ההסבר ב-`electricityRank`. 1000 גדול מכל אחוז אפשרי
 * (0-100) ולכן אף אחוז אינו יכול להעלות מסלול חלקי מעל מסלול מלא.
 */
const PARTIAL_HOURS_GROUP = 1000;

/**
 * ערך הדירוג של מסלול חשמל — אחוז ההנחה **אחרי** מה שהוא לא מבטיח.
 *
 * ⚠️ עד כה דורג כל מסלול לפי `-discountPercent` בלבד, ושני שדות
 * שהרשומה כן מסרה לא השתתפו בדירוג: `spec.allHours` ו-`discountIsCapped`.
 * התוצאה הייתה ששלושת המסלולים שהדף הכריז עליהם כמובילים
 * (ids 150, 147, 137 — כולם 20%) הם מסלולי **שעות לילה בלבד**
 * ("23:00 עד 7:00"), בזמן שכל מסלול שההנחה שלו חלה על החשבון כולו
 * (5%-6%) דורג מתחת לשלושתם. 20% על צריכת לילה שווה לרוב משק בית
 * פחות מ-6% על החשבון כולו, ולכן הדף המליץ בדיוק על המסלולים
 * הפחות טובים עבור המבקר הטיפוסי.
 *
 * ⚠️ האחוז החלקי **אינו** מוכפל במקדם. חלקו של הלילה בחשבון אינו
 * בקטלוג, וכל מקדם היה הופך ניחוש למספר שנראה מחושב. במקום זאת
 * "כל השעות" מדורג לפני כל מסלול חלקי-שעות, והאחוז מכריע רק בתוך
 * הקבוצה — אותה כנות של "לא יודעים, לא מבטיחים". המסלולים החלקיים
 * נשארים גלויים בקטלוג, עם אריח השעות שלהם לידם.
 *
 * ⚠️ תקרה ("עד 10%") מדורגת אחרי שיעור קבוע באותו אחוז, מאותו טעם.
 */
export function electricityRank(p: Package): number {
  if (!isElectricity(p) || !isMoney(p.discountPercent)) return Infinity;
  const partialHours = !p.spec.allHours;
  return (
    (partialHours ? PARTIAL_HOURS_GROUP : 0) - p.discountPercent + (discountIsCapped(p) ? 0.5 : 0)
  );
}

/**
 * ערך הדירוג של "כמה תשלמו כשההטבה נגמרת".
 *
 * ⚠️ משותף למיון ב-`CatalogBrowser` — פונקציה אחת. חשמל הוא אחוז הנחה
 * ולכן מדורג בשלילה (הנחה גדולה = "זול יותר"); חבילה שלא דיווחה על
 * עלייה שומרת על מחירה, כי הקריאה הכנה של "לא פורסמה עלייה" היא "אותו
 * מחיר" ולא "לא ידוע, לסוף הרשימה".
 */
export function afterPrice(p: Package): number {
  // ⚠️ `-Infinity` ולא `0`, כדי להסכים עם `byPrice`. שתי הפונקציות
  // מדרגות את אותו שדה, והשתיקה של `?? 0` הייתה ממקמת רשומה פגומה
  // כזולה ביותר בעמוד בעוד `byPrice` שולח אותה לסוף. אף אחת מהן אינה
  // ניתנת להגעה היום (`isListable` פוסל `discountPercent` ריק), אבל
  // שתי ברירות מחדל הפוכות לאותו שדה הן מלכודת לרענון הבא.
  if (p.category === "electricity") {
    return electricityRank(p);
  }
  return isMoney(p.priceAfterPromo)
    ? p.priceAfterPromo
    : isMoney(p.price)
      ? p.price
      : Infinity;
}

/** כמה חבילות מציג הדף בפועל, לפי קטגוריה. */
export function listableCounts(packages: Package[]) {
  const shown = listable(packages);
  return {
    total: shown.length,
    cellular: shown.filter((p) => p.category === "cellular").length,
    home: shown.filter((p) => p.category === "home").length,
    electricity: shown.filter((p) => p.category === "electricity").length,
  };
}

/**
 * המספרים שמאחורי רצועת "מה אנחנו משווקים".
 *
 * ⚠️ `internet`, `tv` ו-`bundle` **חופפים בכוונה**: חבילת טריפל נספרת
 * בשלושתם, כי כל אחד מהם עונה על שאלה אחרת שהמבקר שואל ("יש לכם
 * טלוויזיה?"). לכן אין לחבר אותם — הסכום גדול מ-`home`.
 */
export function serviceCounts(packages: Package[]) {
  const shown = listable(packages);
  // ⚠️ `isHomeSpec` ולא `p.category === "home"` עם `as HomeSpec`: ההמרה
  // הכריזה `HomeSpec` על פרמטר מטיפוס `Package`, כלומר גם על רשומת
  // חשמל. היא נכונה היום רק מפני שהיא מוחלת על מערך שכבר סונן — שער
  // שאין לו שום דבר בטיפוסים שמחזיק אותו במקום.
  const home = shown.filter(isHomeSpec);
  /*
   * ⚠️ אותו תיקון בדיוק כמו ב-`isComparable` ב-`savings.ts`, ומאותו
   * טעם: סטינג "החבילה המושלמת" (id 4) רשומה `hasInternet: true`
   * למרות שהיא שירות סטרימינג בלבד — המחלץ קרא את המילה "אינטרנט"
   * בתיאור. המחשבון כבר מסרב להתייחס אליה כאינטרנט, ובלי השורה הזו
   * אותה שכבה הצהירה שני דברים סותרים על אותה רשומה: הכרטיס
   * "אינטרנט וסיבים" ספר 30 והמחשבון ספר 29.
   *
   * ⚠️ הסינון חל על אינטרנט ועל החבילה המשולבת בלבד. `tv` דווקא
   * **כן** אמור לספור אותה — היא באמת טלוויזיה.
   */
  const realInternet = home.filter((p) => p.spec.hasInternet && p.type !== "TV");
  return {
    cellular: shown.filter((p) => p.category === "cellular").length,
    internet: realInternet.length,
    tv: home.filter((p) => p.spec.hasTv).length,
    bundle: realInternet.filter((p) => p.spec.hasTv).length,
    electricity: shown.filter((p) => p.category === "electricity").length,
  };
}

/**
 * ערך הדירוג של "כמה זה עולה היום".
 *
 * ⚠️ מסלול חשמל מדורג לפי אחוז ההנחה בסימן שלילי — כלומר **כל** מסלול
 * חשמל קטן מכל מחיר חודשי. זו הסיבה שכל מי שקורא ל-`cheapest` חייב
 * לסנן לקטגוריה קודם.
 */
export function byPrice(a: Package, b: Package): number {
  // ⚠️ אותם שערים בדיוק כמו ב-`afterPrice`, ולא `?? Infinity` לבדו:
  // `price: 0` (הצורה שהמחלץ מייצר כשהוא לא קרא מחיר — ראה ids 18/22)
  // דורג כזול ביותר בעמוד בזמן ש-`afterPrice` שלחה אותו לסוף.
  // ⚠️ `electricityRank` ולא `-discountPercent` כאן גם: שתי הפונקציות
  // מדרגות את אותו שדה, וההערה שמעל `afterPrice` דורשת שיסכימו. שעות
  // חלקיות שהיו משתתפות באחת ולא בשנייה היו מחזירות בדיוק את חוסר
  // ההסכמה שהקובץ הזה כבר תיקן פעם אחת.
  const value = (p: Package) =>
    p.category === "electricity"
      ? electricityRank(p)
      : isMoney(p.price)
        ? p.price
        : Infinity;
  // ⚠️ השוואה ולא חיסור. שתי רשומות בלי מחיר שמיש מקבלות שתיהן
  // `Infinity` (ids 18 ו-22 בקטלוג של היום), ו-`Infinity - Infinity`
  // הוא `NaN` — קומפרטור שמחזיר NaN נותן סדר שתלוי בסדר הקלט, דווקא
  // בשער שכל תפקידו לשלוח רשומה פגומה לסוף.
  const va = value(a);
  const vb = value(b);
  return va === vb ? 0 : va < vb ? -1 : 1;
}

/** הזולה ביותר לפי המחיר שמוצג היום. */
export function cheapest(packages: Package[], limit = 3): Package[] {
  return listable(packages).slice().sort(byPrice).slice(0, limit);
}

/**
 * הבחירה של הדף לקטגוריה: מוצמד ידנית קודם, אחריו הדגל "מומלץ" שהגיע
 * מהחברה, ורק אז מחיר.
 *
 * ⚠️ באתר הציבורי המיון הזה מגיע משכבת העריכה (`byEditorialThen`).
 * כאן אין מסד כזה, ולכן הסדר משוחזר מהשדות שקיימים בקטלוג עצמו. אם
 * יום אחד תיכנס לכאן שכבת עריכה — זו הפונקציה שצריכה להיעלם לטובתה.
 */
export function highlights(packages: Package[], category: Category, limit = 3): Package[] {
  const rank = (p: Package) => (p.editorial?.featured ? 0 : p.recommended ? 1 : 2);
  return listable(byCategory(packages, category))
    .slice()
    .sort((a, b) => rank(a) - rank(b) || byPrice(a, b))
    .slice(0, limit);
}

/**
 * הספקים שיש להם בפועל חבילה גלויה, לפי עומק הקטלוג.
 *
 * ⚠️ המונה נספר מהרשימה שנמסרה ולא מ-`provider.count` שהגיע מהחילוץ:
 * ספק שכל חבילותיו נפלו ב-`isListable` חייב להיעלם מהרצועה, ולא
 * להישאר כלוגו שאין מאחוריו כלום.
 */
/*
 * ⚠️ הרשימה נבנית מ-`packages` ולא מ-`catalog.providers` לבדו.
 *
 * הפונקציה קיבלה מערך חבילות, ספרה ממנו — ואז הרכיבה את הרשימה
 * מ-`catalog.providers`, כלומר ספק שיש לו חבילה **במערך שנמסר** אך
 * אינו רשום ברשימת הספקים של הקטלוג נעלם מהרצועה בשקט. היום 12 מתוך
 * 12 הספקים מופיעים בשני המקומות ולכן הבאג רדום, אבל `providers` היא
 * המספר שהדף מצהיר עליו ("אנחנו עובדים עם N חברות"), ורענון שיוסיף
 * חבילה של ספק חדש בלי להוסיף אותו ל-`providers` של הקטלוג מוריד את
 * המספר במקום להעלות אותו. `catalog.providers` נשאר **מקור המטא-דאטה
 * והסדר** (לוגו, שם, קטגוריות); מי שחסר שם נבנה מה-`ProviderRef`
 * שעל החבילה עצמה.
 */
export function providers(packages: Package[]): Provider[] {
  const shown = listable(packages);
  const counts = new Map<string, number>();
  const refs = new Map<string, Package[]>();
  for (const p of shown) {
    counts.set(p.provider.slug, (counts.get(p.provider.slug) ?? 0) + 1);
    const bucket = refs.get(p.provider.slug);
    if (bucket) bucket.push(p);
    else refs.set(p.provider.slug, [p]);
  }

  const known = new Set(catalog.providers.map((p) => p.slug));
  const fromCatalog: Provider[] = catalog.providers
    .filter((p) => (counts.get(p.slug) ?? 0) > 0)
    .map((p) => ({ ...p, count: counts.get(p.slug)! }));
  const fromPackages: Provider[] = [...refs.entries()]
    .filter(([slug]) => !known.has(slug))
    .map(([slug, own]) => ({
      slug,
      name: own[0].provider.name,
      logo: own[0].provider.logo,
      categories: [...new Set(own.map((p) => p.category))],
      count: own.length,
    }));

  return [...fromCatalog, ...fromPackages].sort((a, b) => b.count - a.count);
}

/** כמה חבילות מגלות את המחיר שאחרי ההטבה — נתון האמון של הדף. */
export function disclosedRiseCount(packages: Package[]): number {
  return listable(packages).filter(
    (p) =>
      p.category !== "electricity" &&
      // ⚠️ `isMoney` ולא `!= null`: `priceAfterPromo: 0` אינו הצהרה על
      // עליית מחיר אלא שדה שלא נקרא, ו"נתון האמון" של הדף אינו יכול
      // להיות מנופח על ידי בדיוק הרשומות שלא דיווחו כלום.
      (isMoney(p.priceAfterPromo) || p.priceAfterPromoNote != null),
  ).length;
}

/**
 * האם `afterPrice` באמת יודעת מה יעלה החבילה אחרי ההטבה.
 *
 * ⚠️ `priceAfterPromo` הוא השדה המספרי, אבל 11 חבילות בקטלוג מצהירות
 * על העלייה **בטקסט חופשי בלבד** (`priceAfterPromoNote`) ומשאירות את
 * המספר ריק — למשל "פקיעה אחרי שנה וחצי, מחיר לאחר פקיעה 44.9 ש״ח"
 * על חבילה שמחירה 29.9. `afterPrice` נופלת במקרה הזה ל-`price`, כלומר
 * למחיר ההטבה, ומדרגת את החבילה כאילו 29.9 הוא מחיר הקבע שלה.
 *
 * למיון בקטלוג זו טעות נסבלת — המחיר וההערה מוצגים זה לצד זה והקורא
 * רואה את שניהם. במחשבון החיסכון זו טעות שלא ניתן לעמוד מאחוריה: הוא
 * מבטיח במפורש "המחיר שנשאר גם אחרי תום ההטבה", ובלי הבדיקה הזו הוא
 * מתגמל בדיוק את החבילות שמסתירות את העלייה — חבילה שמצהירה על
 * `priceAfterPromo` מספרי נענשת ולעולם לא תנצח, וחבילה שקוברת את
 * אותה עלייה בהערה חופשית עולה לראש. פירסור ההערה עצמה לא נעשה כאן
 * בכוונה: הנוסח חופשי לגמרי (יש בו "+ 10 ₪ נתב" שצריך חיבור, "מ-100 ₪"
 * שהוא רצפה ולא מחיר), וניחוש שגוי היה מחזיר אותנו בדיוק לכותרת
 * המומצאת שהמחשבון נבנה כדי למנוע.
 */
/*
 * ⚠️ גם שדה מספרי **פגום** הוא "לא יודעים", ולא רק שדה ריק עם הערה.
 *
 * הבדיקה המקורית שאלה רק `priceAfterPromo == null`, כלומר `0` (או
 * מחרוזת, או מספר שלילי) נחשב מחיר-אחרי-הטבה ידוע לגמרי. זו בדיוק
 * הצורה שהמחלץ מייצר כשהוא לא הצליח לקרוא מספר — `price: 0` בשתי
 * רשומות קיימות הוא אותו פגם באותו קובץ — והתוצאה חמורה פעמיים:
 * המיון "מחיר אחרי ההטבה: מהזול ליקר" שם את הרשומה הזו **בראש**
 * הרשימה (`afterPrice` החזירה 0), והכרטיס מדפיס "אחרי ההטבה ₪0" על
 * חבילה שמחירה 39.9. `isComparable` ב-`savings.ts` כבר פוסל אותה
 * דרך `isMoney`; כאן השער היה חסר.
 */
export function hasKnownAfterPrice(p: Package): boolean {
  if (p.priceAfterPromo != null && !isMoney(p.priceAfterPromo)) return false;
  return !(p.priceAfterPromoNote && p.priceAfterPromo == null);
}
