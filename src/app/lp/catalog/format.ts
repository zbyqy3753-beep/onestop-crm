import { logicName } from "./catalog";
import type { CellularSpec, ElectricitySpec, HomeSpec, Package } from "./types";

const nf = new Intl.NumberFormat("he-IL");

/*
 * "39" not "39.00"; "39.9" keeps its agora.
 *
 * ⚠️ הבדיקה על `value` אינה מיותרת. `isListable` שומר על `price` ועל
 * `discountPercent` בלבד, בעוד כל **העמלות** מגיעות לכאן בלי שער:
 * `simCost`, `connectionFee`, `transferFee`, `installationCost`,
 * `extraConverterCost`, `extraExtenderCost`, `maxMonthlyBill`,
 * `lineTiers[].price`. הקטלוג נכנס דרך `as unknown as Catalog`, כלומר
 * אין ולידציה בזמן ריצה: עמלה שתישאב פעם אחת כמחרוזת הייתה מפילה כאן
 * `value.toFixed is not a function` — בתוך רינדור שרת, כלומר **כל** דף
 * `/lp` מחזיר 500 במקום שכרטיס אחד יציג פחות. רשומה פגומה מדרדרת
 * לקו מפריד, כמו מחיר חסר ב-`PackageCard`.
 */
export function shekels(value: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `₪${nf.format(Number(value.toFixed(2)))}`;
}

/**
 * סכום ש**המשתמש הקליד**, ולא מחיר מהקטלוג.
 *
 * ⚠️ `shekels` נבנה לקטלוג ("39 ולא 39.00") ולכן הוא מוריד אפס עשרוני
 * נגרר — נכון למחיר חבילה, שגוי למה שהוקלד: הרמז מתחת לשדה מפרסם
 * במפורש `220.50` כפורמט נתמך, ומי שהקליד אותו ראה "אתם משלמים
 * ₪220.5 בחודש" וגם שלח לנציג "משלם היום ₪220.5". האגורה שהוקלדה
 * נשמרת, ולסכום עגול לא נוספות עשרוניות שלא נכתבו.
 */
export function typedShekels(value: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded)
    ? `₪${nf.format(rounded)}`
    : `₪${nf.format(Math.trunc(rounded))}.${String(Math.round(Math.abs(rounded % 1) * 100)).padStart(2, "0")}`;
}

/*
 * ⚠️ כיתובי הכמות נכתבים **בשתי צורות**, יחיד ורבים, בדיוק כמו
 * `ממיר כלול` / `ממירים כלולים` שמתחת. "1 ערוצים" הוא הסוג של שגיאה
 * שרענון קטלוג מכניס בלי שאף אחד ישים לב — אין היום אף רשומה עם 1
 * באחד מהשדות האלה, ולכן אלה שערים לרענון הבא ולא תיקון של מסך חי.
 *
 * ⚠️ רק הכיתוב משתנה, לא הערך — ומכאן גם החובה הנגררת: טבלת ההשוואה
 * מיישרת שורות לפי ה-`caption`, ולכן כל צורת יחיד **חייבת** להופיע
 * ב-`SAME_FACT` מתחת וממופה לצורת הרבים. בלי זה השוואה בין חבילה עם
 * ערוץ אחד לחבילה עם 40 הייתה נפרשת לשתי שורות עם "—" הדדי, כלומר
 * הטבלה מכחישה נתון שהכרטיס עצמו מדפיס.
 */
export const MINUTES_CAPTION = (n: number) => (n === 1 ? "דקת שיחה" : "דקות שיחה");
export const SMS_CAPTION = (n: number) => (n === 1 ? "הודעת SMS" : "הודעות SMS");
export const INTL_MINUTES_CAPTION = (n: number) => (n === 1 ? "דקה לחו״ל" : "דקות לחו״ל");
export const CHANNELS_CAPTION = (n: number) => (n === 1 ? "ערוץ" : "ערוצים");

/*
 * ⚠️ אותו כלל גם למונים שמספרים **חבילות**, ולא רק למפרט שבתוך כרטיס.
 * שורת התוצאות בקטלוג (`CatalogBrowser`) ומוני רצועת השירותים
 * (`page.tsx`) כתבו "חבילות"/"מסלולים" בכל מצב, וזה באג **חי**: הסוג
 * "בסיס" בסלולר נושא חבילה אחת בלבד (וכך גם "קו ביתי" בביתי), ולכן
 * לחיצה אחת על השבב הזה הציגה "1 חבילות מתוך 55" מעל כרטיס בודד.
 */
export const PACKAGES_CAPTION = (n: number) => (n === 1 ? "חבילה" : "חבילות");
export const PLANS_CAPTION = (n: number) => (n === 1 ? "מסלול" : "מסלולים");

/**
 * האם הפרוזה של הרשומה מצהירה על **המספר הזה** כתקרה ("עד 600").
 *
 * ⚠️ המקבילה המדויקת של `discountIsCapped`, שחסרה למהירות ולנפח.
 * `discountIsCapped` נבנתה כדי שהכרטיס לא יבטיח שיעור קבוע כשהרשומה
 * אמרה "עד", ואותה הבטחה בדיוק נשארה פתוחה בצד השני של הכרטיס:
 * id 85 נקרא "Partner Fiber במהירות **עד** 600/100" והאריח הדפיס
 * "600/100Mbps" כעובדה; id 124 ("עד 1000Mb") הדפיס "1,000/250Mbps";
 * ids 26, 27 ו-69 מבטיחים "עד 500GB"/"עד 1500GB"/"עד 5,000 דקות"
 * והאריח הדפיס את המספר שטוח. הכרטיס הכריז יותר ממה שהחבילה מוכרת.
 *
 * ⚠️ אותם שני שערים של `discountIsCapped`, מאותם טעמים: `logicName`
 * ולא `displayName` (שקוטעת אחרי `[line]`), ו-`עד` כמילה ולא כתת-מחרוזת
 * (כדי ש-"ועד בית" לא ייקרא כתקרה). ובנוסף — התאמה **לאותו מספר**,
 * ולא לעצם קיום המילה, כדי שהשער יצמצם הבטחה ולא ירחיב אותה.
 *
 * ⚠️ היחידה מותרת **לפני** המספר. הקטלוג כותב את אותה תקרה
 * בשני הסדרים: id 69 אומר "עד 3000GB" ונתפס, ואילו ids 54,
 * 65 ו-66 אומרים "עד GB800" / "עד GB2500" — אותה הצהרה בדיוק,
 * והאריח הדפיס "800GB" שטוח על שלושתן. ההתנהגות לא רק
 * חסרה — היא הייתה **לא עקבית** בין שתי רשומות של אותו ספק.
 * רק אותיות לטיניות, כלומר יחידה (GB/MB/Mbps) ולא מילה בעברית.
 *
 * ⚠️ מספר שאחריו `%` או `:` נדחה. `%` הוא תחומה של `discountIsCapped`,
 * ו-`:` הוא שעה — "ההנחה חלה עד 7:00" אינה הצהרה על נפח או מהירות,
 * ובלי השער הזה כל שדה שערכו 7 היה נקרא ממנה כתקרה.
 */
function proseCapsAt(pkg: Package, value: number): boolean {
  const prose = [logicName(pkg), pkg.description, pkg.benefits].filter(Boolean).join(" ");
  for (const m of prose.matchAll(/(?<![א-ת])עד\s*(?:[A-Za-z]{1,5}\s*)?(\d[\d,]*(?:\.\d+)?)\s*(.?)/g)) {
    if (m[2] === "%" || m[2] === ":") continue;
    if (Number(String(m[1]).replace(/,/g, "")) === value) return true;
  }
  return false;
}

/** `"עד "` כשהרשומה מצהירה על המספר הזה כתקרה, אחרת מחרוזת ריקה. */
const upTo = (pkg: Package, ...values: (number | null | undefined)[]) =>
  values.some((v) => typeof v === "number" && proseCapsAt(pkg, v)) ? "עד " : "";

/**
 * Big buckets are sold as "unlimited" — say so instead of printing 10000GB.
 *
 * ⚠️ `pkg` ולא `spec` לבדו: ה-"עד" חי בפרוזה של הרשומה, לא במפרט.
 */
export function dataLabel(pkg: Package, spec: CellularSpec): string | null {
  if (spec.unlimitedData) return "גלישה חופשית";
  if (spec.dataGb == null || spec.dataGb === 0) return null;
  return `${upTo(pkg, spec.dataGb)}${nf.format(spec.dataGb)}GB`;
}

/*
 * ⚠️ שתי המהירויות באותה יחידה. ההורדה הומרה ל-Gb בעוד ההעלאה נשארה
 * ב-Mb **ובלי יחידה כלל**: `{5000, 500}` הוצג כ-"5Gb/500" מתחת לכיתוב
 * "מהירות גלישה" — הגולש קורא 5 מול 500 ואין לו שום דרך לדעת שמדובר
 * ב-5000 מול 500. היחידה נקבעת פעם אחת, ושתיהן מוצגות בה.
 *
 * ⚠️ היחידה נקבעת לפי **שתיהן**, לא לפי ההורדה בלבד. `{1000, 100}` —
 * החבילה הנפוצה ביותר בקטלוג הביתי (15 מתוך 33) — הוצג כ-"1/0.1Gb":
 * נכון אריתמטית, אבל "0.1" הוא דרך גרועה לומר 100, והמספר הגדול מבין
 * השניים נקרא כקטן משמעותית. יחידת Gb נבחרת רק כששתי המהירויות
 * נשארות שלמות בה; אחרת שתיהן ב-Mb.
 */
/*
 * ⚠️ "נשארות שלמות" נבדק כחלוקה ב-1000 ולא כ-`>= 1000`. התנאי הקודם
 * עצר את `{1000, 100}` אבל לא את `{1500, 1000}`, שהוצג כ-"1.5/1Gb" —
 * בדיוק הניסוח שההערה שמעל פוסלת, רק מהצד השני: המספר הגדול נכתב
 * כשבר. וגרוע מכך, `nf` מוגבל לשלוש ספרות אחרי הנקודה בברירת מחדל,
 * ולכן `{1000.5, 1000.5}` הודפס כ-"1.001/1.001Gb" — **אובדן דיוק**
 * בעקבות חלוקה, על מספר שהקטלוג מסר במדויק. יחידה שאינה מחלקת את שתי
 * המהירויות בשלמות נשארת Mb, שם שום חלוקה לא מתבצעת.
 */
export function speedLabel(pkg: Package, spec: HomeSpec): string | null {
  if (spec.downloadMbps == null) return null;
  const whole = (mbps: number) => mbps >= 1000 && mbps % 1000 === 0;
  /*
   * ⚠️ יחידת Gb רק כששתי המהירויות נמסרו, ולא על מהירות בודדת.
   *
   * היחידה נבחרה לכל חבילה בנפרד, והכרטיסים יושבים זה ליד זה: ברצועת
   * ההיילייטס של הבית id 92 (`{1000, null}`) הודפס "1Gb" **בשורה
   * שמעל** id 73 (`{1000, 100}`) שהודפס "1,000/100Mb" — אותה מהירות
   * הורדה, אותו מחיר ₪109, ושני מספרים שנראים כמו 1 מול 1,000. זו
   * בדיוק הקריאה השגויה שההערות שמעל פוסלות, רק שהיא עברה מתוך ערך
   * בודד אל הפער בין שני ערכים.
   */
  const asGb = spec.uploadMbps != null && whole(spec.downloadMbps) && whole(spec.uploadMbps);
  /*
   * ⚠️ `Mbps`/`Gbps` ולא `Mb`/`Gb`. הנתון הוא `downloadMbps` — מגהביט
   * **לשנייה** — והאריח הדפיס "5,000/500Mb", כלומר יחידת נפח במקום
   * יחידת מהירות, על כל 23 החבילות הביתיות שמסרו מהירות. לא כותרת
   * האריח ("מהירות גלישה") ולא שורת הפירוט ("מהירות (הורדה/העלאה)")
   * משלימות את "לשנייה", ולכן המספר עצמו חייב לשאת אותה — על אותו
   * כרטיס יושב "100GB" של נפח גלישה, ושתי יחידות שנראות זהות על
   * שני דברים שונים הן בדיוק הקריאה השגויה שהקובץ הזה נלחם בה.
   */
  const unit = asGb ? "Gbps" : "Mbps";
  const value = (mbps: number) => nf.format(asGb ? mbps / 1000 : mbps);
  /*
   * ⚠️ תחילית אחת לזוג כולו, ולא "עד" לכל מהירות בנפרד. הרשומות
   * שמצהירות על תקרה מצהירות עליה על שתיהן (id 85: "עד 600 Mb"
   * ו-"עד 100 Mb"), ו-"עד 600/עד 100" קורא כשתי עובדות ולא כזוג.
   */
  const cap = upTo(pkg, spec.downloadMbps, spec.uploadMbps);
  return spec.uploadMbps != null
    ? `${cap}${value(spec.downloadMbps)}/${value(spec.uploadMbps)}${unit}`
    : `${cap}${value(spec.downloadMbps)}${unit}`;
}

/*
 * ⚠️ `discountIsCapped` עברה ל-`catalog.ts` ומיוצאת כאן מחדש, כדי
 * ש-`electricityRank` תוכל להשתמש בה בלי מעגל ייבוא (`format.ts`
 * מייבאת `logicName` מ-`catalog.ts`, ולא להפך). הצרכנים — הכרטיס
 * וטבלת ההשוואה — ממשיכים לייבא מכאן, כמו קודם.
 */
export { discountIsCapped } from "./catalog";

/**
 * עלות התקנה שהרשומה מתנה ב**סוג הבית**, והמספר שבמפרט הוא צד אחד שלה בלבד.
 *
 * ⚠️ `installationCost` הוא שדה אחד, והפרוזה של הקטלוג הביתי מוכרת שני
 * מחירים: 21 מתוך 33 החבילות הביתיות אומרות "בבניין X / בית פרטי Y".
 * `installationCost === 0` תורגם ל-"ללא עלות" כעובדה גורפת — id 115
 * ("עלות התקנה : בבנין0 שח בית פרטי 499שח"), id 73 ("0 ש"ח לבניין לזמן
 * מוגבל , 125 ש"ח לבית פרטי") ו-id 3 ("התקנה ללא עלות בבניין בית פרטי
 * 499") כולן הדפיסו "התקנה: ללא עלות" מול תשלום חד-פעמי של מאות
 * שקלים. זה הפער הכספי הגדול ביותר שכרטיס בדף הזה יכול להסתיר, והוא
 * אותה מחלקת פגם שכבר נסגרה ב-`discountIsCapped` ו-`proseCapsAt`:
 * הפרוזה מתנה, והמפרט שכח את התנאי.
 *
 * ⚠️ המספר של הבית הפרטי נקרא בשני סדרים — "125 ש"ח **ל**בית פרטי"
 * (לפני) ו-"בית פרטי 499שח" (אחרי) — והצורה שלפני דורשת את ה-`ל`:
 * בלעדיו "בבנין0 שח בית פרטי" נקרא כ-0 לבית פרטי, כלומר השער היה
 * מדפיס את ההפוך מהרשומה. הצורה שאחרי דורשת סימן מטבע, מאותו טעם.
 */
function installationProse(pkg: Package): string {
  return [logicName(pkg), pkg.description, pkg.benefits].filter(Boolean).join(" ");
}

function privateHomeInstallation(pkg: Package): number | null {
  const prose = installationProse(pkg);
  const before = prose.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:ש"ח|שח|₪)\s*לבית\s*פרטי/);
  if (before) return Number(before[1].replace(/,/g, ""));
  const after = prose.match(/בית\s*פרטי[^\d%]{0,40}?(\d[\d,]*(?:\.\d+)?)\s*(?:ש"ח|שח|₪)/);
  if (after) return Number(after[1].replace(/,/g, ""));
  return null;
}

/** הרשומה מתנה את ההתקנה בסוג הבית — גם כשלא נקרא ממנה מספר. */
function installationIsConditional(pkg: Package): boolean {
  const prose = installationProse(pkg);
  return /התקנ/.test(prose) && /בית\s*פרטי/.test(prose);
}

/**
 * שורת הפירוט: שני הצדדים, כל אחד עם מי שהוא חל עליו.
 *
 * ⚠️ כששני המספרים זהים, המפרט החזיק את מחיר הבית הפרטי ולא את זה של
 * הבניין (id 70: "עלות התקנה חד פעמי: , 125 ש"ח לבית פרטי" — המחלץ
 * איבד את הראשון). אין לנו מחיר לבניין, ולכן לא נאמר עליו דבר.
 *
 * ⚠️ וכשהמספר של הבית הפרטי לא נקרא (id 3 — "בית פרטי 499" בלי יחידה)
 * הרשומה נשארת מותנית בלי מספר. "לא יודעים — לא מבטיחים": עדיף לומר
 * על מה המחיר חל מאשר להדפיס אותו כאילו הוא חל על כולם.
 */
function installationDetail(pkg: Package, cost: number): string {
  const flat = cost === 0 ? "ללא עלות" : shekels(cost);
  if (!installationIsConditional(pkg)) return flat;
  const priv = privateHomeInstallation(pkg);
  const parts: string[] = [];
  if (priv !== cost) parts.push(`${flat} בבניין`);
  if (priv != null) parts.push(`${shekels(priv)} לבית פרטי`);
  return parts.join(" · ");
}

export const CUSTOMER_TYPE_HE: Record<ElectricitySpec["customerType"], string> = {
  private: "לקוח פרטי",
  business: "לקוח עסקי",
  house_committee: "ועד בית",
};

/**
 * The three headline figures on a card. Value + caption reads far faster on
 * mobile than a spec table, which is why every card uses this shape.
 */
export interface Stat {
  value: string;
  caption: string;
}

export function cardStats(pkg: Package): Stat[] {
  if (pkg.category === "cellular") {
    const spec = pkg.spec as CellularSpec;
    const out: Stat[] = [];
  /*
   * ⚠️ `typeof === "number"` ולא טרות'יניס. `0` מפורש הוא **נתון**, ולא
   * היעדר נתון: רשומה שאומרת "0 SMS" או "0 ממירים" לא ייצרה אריח, ואז
   * `compareRows` הדפיסה עליה "—" — כלומר הטבלה הצהירה שאין נתון בזמן
   * שהקטלוג יודע שהתשובה היא אפס. זו אותה מחלקת פגם שכבר תוקנה בשדות
   * התלת-מצביים (`included()`), ואותה אמת-מידה שבנתה את שערי
   * `isListable`. אין היום אף `0` באף אחד מהשדות האלה — זה שער לרענון.
   */
    const data = dataLabel(pkg, spec);
    if (data) out.push({ value: data, caption: "גלישה בישראל" });
    // ⚠️ אותו שער "עד" גם על דקות ו-SMS: ids 26, 27 ו-69 מבטיחים
    // "עד 5,000 דקות" בפרוזה, והאריח הדפיס 5,000 כעובדה.
    if (typeof spec.minutes === "number")
      out.push({ value: `${upTo(pkg, spec.minutes)}${nf.format(spec.minutes)}`, caption: MINUTES_CAPTION(spec.minutes) });
    if (typeof spec.sms === "number")
      out.push({ value: `${upTo(pkg, spec.sms)}${nf.format(spec.sms)}`, caption: SMS_CAPTION(spec.sms) });
    // ⚠️ גם דקות לחו״ל. זה היה השדה היחיד שנשאר בלי השער: id 110
    // אומר "עד 100 דקות שיחה מישראל ל-27 יעדים בחו\"ל (אופציונלי)"
    // והאריח הדפיס "100" כעובדה, וכך גם ids 42, 54, 64, 65, 66 ו-69.
    if (out.length < 3 && typeof spec.intlMinutes === "number") {
      out.push({
        value: `${upTo(pkg, spec.intlMinutes)}${nf.format(spec.intlMinutes)}`,
        caption: INTL_MINUTES_CAPTION(spec.intlMinutes),
      });
    }
    return out.slice(0, 3);
  }

  if (pkg.category === "home") {
    const spec = pkg.spec as HomeSpec;
    const out: Stat[] = [];
    const speed = speedLabel(pkg, spec);
    if (speed) out.push({ value: speed, caption: "מהירות גלישה" });
    if (typeof spec.channels === "number") out.push({ value: nf.format(spec.channels), caption: CHANNELS_CAPTION(spec.channels) });
    // ⚠️ אותה שגיאה שהערה על `lineTiers` מזהירה מפניה, רק שכאן היא
    // **חיה**: id 70 הוא ממיר אחד, והכרטיס הכריז "1 ממירים".
    /*
     * ⚠️ מספר שהרשומה מצהירה עליו כ**מקסימום** אינו מספר הממירים
     * הכלולים. id 89 אומר "ממיר ראשון ללא עלות , כל ממיר נוסף עוד 15
     * שח/ממיר , מקסימום עד 7 ממירים ללקוח", והאריח הדפיס "7 ממירים
     * כלולים" — בזמן ששורת "ממיר נוסף ₪15" יושבת על אותו כרטיס עצמו.
     * שתי אמירות סותרות, והיקרה מהן אינה נכונה: כלול אחד, לא שבעה.
     * אותו שער `upTo` שחל כבר על הנפח, הדקות וה-SMS, ועוד תווית שאינה
     * אומרת "כלולים" על מה שאינו כלול.
     */
    if (typeof spec.converters === "number") {
      const cap = upTo(pkg, spec.converters);
      out.push({
        value: `${cap}${nf.format(spec.converters)}`,
        // ⚠️ רק הכיתוב משתנה, לא הערך: טבלת ההשוואה מיישרת לפי ה-`caption`,
        // ושני ניסוחים לאותה עובדה היו נפרשים לשתי שורות עם "—" הדדי.
        // שלוש הצורות ממופות לעובדה אחת ב-`SAME_FACT`.
        caption: cap ? "ממירים (מקסימום)" : spec.converters === 1 ? "ממיר כלול" : "ממירים כלולים",
      });
    }
    /*
     * ⚠️ אריח רק כשהעלות אינה מותנית. אריח מחזיק מספר אחד, ועלות
     * מותנית היא שני מספרים — ראה `installationDetail`. אריח "ללא
     * עלות בבניין" ושורה שאומרת גם את הצד השני הם אותו נושא בשני
     * מקומות, וזה בדיוק מה ששתי בדיקות התצוגה אוסרות. כשהעלות מותנית
     * העובדה נאמרת במקום אחד — בשורת הפירוט — ושם היא שלמה.
     */
    if (out.length < 3 && typeof spec.installationCost === "number" && !installationIsConditional(pkg)) {
      out.push({
        value: spec.installationCost === 0 ? "ללא עלות" : shekels(spec.installationCost),
        caption: "התקנה",
      });
    }
    return out.slice(0, 3);
  }

  const spec = pkg.spec as ElectricitySpec;
  const out: Stat[] = [];
  if (spec.allHours) out.push({ value: "כל השעות", caption: "מתי ההנחה חלה" });
  else if (spec.hoursText) out.push({ value: spec.hoursText, caption: "שעות ההנחה" });
  /*
   * ⚠️ עם שער, מאותה סיבה ש-`shekels` מדרדר ל-"—": הקטלוג נכנס דרך
   * `as unknown as Catalog` ואין ולידציה בזמן ריצה. ערך רביעי ברענון
   * (למשל `municipal`) היה מייצר אריח עם כיתוב ובלי ערך, ובטבלת
   * ההשוואה `undefined` נופל ל-"—" — כלומר הדף מכחיש נתון שהחבילה
   * כן נושאת. עדיף להשמיט את האריח מאשר להדפיס חור.
   */
  const customerType = CUSTOMER_TYPE_HE[spec.customerType];
  if (customerType) out.push({ value: customerType, caption: "מיועד ל" });
  if (spec.smartMeterRequired === true) out.push({ value: "מונה חכם", caption: "נדרש" });
  else if (spec.smartMeterRequired === false) out.push({ value: "כל המונים", caption: "מתאים ל" });
  return out.slice(0, 3);
}

/*
 * Extra facts worth surfacing under the fold; nulls are dropped, never guessed.
 *
 * ⚠️ שורה שכבר עלתה לשלישיית הכותרות **לא נכתבת שוב**. שלושה שדות
 * נכנסים לשלישייה רק כשנשאר בה מקום (`דקות לחו״ל`, `התקנה`) או תמיד
 * (`שעות ההנחה` כשההנחה אינה כל היום), וכשהם שם — "פרטים מלאים" חזר
 * ואמר את אותו הדבר באותו ניסוח: 43 מתוך 106 הכרטיסים הדפיסו עובדה
 * אחת פעמיים.
 *
 * ⚠️ `מהירות (הורדה/העלאה)` **נשארה** למרות שערכה זהה לאריח: האריח
 * אומר "1000/100" ורק התווית הזו אומרת מי מהם ההורדה.
 */
export function detailRows(pkg: Package): { label: string; value: string }[] {
  const tiled = new Set(cardStats(pkg).map((s) => s.caption));
  const rows: { label: string; value: string }[] = [];
  const fee = (label: string, v: number | null | undefined) => {
    if (v == null) return;
    rows.push({ label, value: v === 0 ? "ללא עלות" : shekels(v) });
  };

  if (pkg.category === "cellular") {
    const s = pkg.spec as CellularSpec;
    /*
     * ⚠️ גם השער וגם התווית נגזרים מאותה פונקציה שהאריח השתמש בה.
     * שער שקורא תווית קבועה ("דקות לחו״ל") היה מפספס את האריח של
     * חבילה עם דקה אחת, ואותה עובדה הייתה מודפסת פעמיים.
     */
    if (typeof s.intlMinutes === "number" && !tiled.has(INTL_MINUTES_CAPTION(s.intlMinutes))) {
      rows.push({
        label: INTL_MINUTES_CAPTION(s.intlMinutes),
        value: `${upTo(pkg, s.intlMinutes)}${nf.format(s.intlMinutes)}`,
      });
    }
    fee("עלות SIM", s.simCost);
    fee("דמי חיבור", s.connectionFee);
    fee("דמי מעבר", s.transferFee);
    if (s.esim) rows.push({ label: "eSIM", value: "נתמך" });
    if (s.lineTiers?.length) {
      rows.push({
        label: "מחיר לפי מספר קווים",
        // מדרגה של קו אחד אינה קיימת בקטלוג היום, אבל "1 קווים" הוא
        // בדיוק הסוג של שגיאה שרענון קטלוג מכניס בלי שאף אחד ישים לב.
        value: s.lineTiers
          .map((t) => `${t.lines === 1 ? "קו אחד" : `${t.lines} קווים`} ${shekels(t.price)}`)
          .join(" · "),
      });
    }
  }

  if (pkg.category === "home") {
    const s = pkg.spec as HomeSpec;
    const speed = speedLabel(pkg, s);
    /*
     * ⚠️ רק כששתי המהירויות נמסרו. ההחרגה של התווית הזו מבדיקת "אותה
     * עובדה פעמיים" נשענת על כך שהיא אומרת מי מהן ההורדה; על ערך בודד
     * (ids 3, 81, 92, 104) היא לא אומרת דבר — השורה הופכת לשכפול
     * מדויק של האריח שמעליה, ומבטיחה זוג שהנתון לא מסר.
     */
    if (speed && s.uploadMbps != null) {
      rows.push({ label: "מהירות (הורדה/העלאה)", value: speed });
    }
    // ⚠️ עלות מותנית אינה מקבלת אריח (ראה `cardStats`), ולכן `tiled`
    // לעולם אינו חוסם אותה כאן — השורה היא המקום היחיד שאומר אותה.
    if (!tiled.has("התקנה")) {
      if (typeof s.installationCost === "number") {
        rows.push({ label: "עלות התקנה", value: installationDetail(pkg, s.installationCost) });
      } else {
        fee("עלות התקנה", s.installationCost);
      }
    }
    /*
     * ⚠️ שלושת השדות האלה הם `boolean | null` — תלת-מצביים — והגרסה
     * הקודמת דחפה שורה רק במצב החיובי. לכן `false` — שהקטלוג יודע
     * עליו במפורש — נראה בטבלת ההשוואה בדיוק כמו `null`: "—",
     * כלומר "אין לנו נתון". בדף השוואת מחירים ההבדל הוא כסףי:
     * נתב בתשלום נפרד הוא תוספת חודשית אמיתית — `savings.ts` אפילו
     * מחזיקה `ROUTER_PRICED_SEPARATELY` בשבילה.
     */
    const included = (label: string, v: boolean | null | undefined) => {
      if (v == null) return;
      rows.push({ label, value: v ? "כלול במחיר" : "אינו כלול במחיר" });
    };
    included("נתב", s.routerIncluded);
    included("מגדיל טווח", s.extenderIncluded);
    fee("ממיר נוסף", s.extraConverterCost);
    fee("מגדיל טווח נוסף", s.extraExtenderCost);
    included("VOD", s.vodIncluded);
  }

  if (pkg.category === "electricity") {
    const s = pkg.spec as ElectricitySpec;
    /*
     * ⚠️ השער בודק את **שתי** התוויות, כמו `meterTiled` שמתחת. `cardStats`
     * בוחר בין "שעות ההנחה" (כשיש `hoursText`) ל-"מתי ההנחה חלה"
     * (כש-`allHours` דלוק), והשער הקודם הכיר רק בראשונה. רשומה שנושאת
     * `allHours: true` **וגם** `hoursText` קיבלה אריח "כל השעות" ומתחתיו
     * שורה "שעות ההנחה: 23:00-07:00" — אותה עובדה פעמיים, ובשתי תשובות
     * שסותרות זו את זו, בדיוק מה שה-`SUBJECTS` בבדיקה כבר אוסר. אין
     * רשומה כזו בקטלוג של היום; זה שער לרענון הבא.
     */
    const hoursTiled = tiled.has("שעות ההנחה") || tiled.has("מתי ההנחה חלה");
    if (s.hoursText && !hoursTiled) rows.push({ label: "שעות ההנחה", value: s.hoursText });
    if (typeof s.maxMonthlyBill === "number") rows.push({ label: "תקרת חשבונית חודשית", value: shekels(s.maxMonthlyBill) });
    // אותה תלת-מצביות כמו למעלה, בכיוון ההפוך: רק השלילי נכתב,
    // ולכן מסלול עם התחייבות מוצהרת נראה כמו מסלול שלא ידוע עליו דבר.
    // 0 רשומות בקטלוג הנוכחי נושאות `true`, ולכן זו הגנה על הרענון הבא.
    if (s.commitment === false) rows.push({ label: "התחייבות", value: "ללא התחייבות" });
    if (s.commitment === true) rows.push({ label: "התחייבות", value: "בהתחייבות" });
    /*
     * ⚠️ אותו שער כמו ב-`שעות ההנחה` שמעל. האריח כבר אמר "מונה חכם /
     * נדרש" או "כל המונים / מתאים ל", והשורה כאן חזרה על אותה עובדה
     * בניסוח ארוך יותר — 7 מתוך 18 מסלולי החשמל הדפיסו אותה פעמיים.
     * הבדיקה הקיימת לא תפסה אותן כי היא משווה מחרוזות, והמחרוזות
     * באמת שונות; מה שזהה הוא העובדה.
     */
    const meterTiled = tiled.has("נדרש") || tiled.has("מתאים ל");
    if (s.smartMeterRequired === true && !meterTiled) {
      rows.push({ label: "סוג מונה", value: "מונה חכם בלבד" });
    }
    if (s.smartMeterRequired === false && !meterTiled) {
      rows.push({ label: "סוג מונה", value: "מתאים לכל סוגי המונים" });
    }
  }

  return rows;
}

export interface CompareRow {
  label: string;
  values: string[];
}

/**
 * ⚠️ שתי תוויות לאותה עובדה. `cardStats` ו-`detailRows` מתארים את אותו
 * נתון בשמות שונים, והטבלה הציגה את שניהם כשתי שורות נפרדות. התווית
 * הנבחרת היא **המפורטת מביניהן**: "1000/100" בלי לומר מי ההורדה אינו
 * שווה הרבה.
 */
/**
 * ⚠️ תווית המהירות **אינה** כאן, כי היא תלויה בנתון ולא רק בשם.
 *
 * `detailRows` מדפיסה "מהירות (הורדה/העלאה)" רק כששתי המהירויות
 * נמסרו (ראה ההערה בשורה 248) — ומיפוי קבוע של כיתוב האריח
 * "מהירות גלישה" לאותה תווית ביטל בדיוק את השער הזה דווקא בטבלה:
 * `compareRows([104, 92])` הדפיס `מהירות (הורדה/העלאה) | 1,000Mb || 1,000Mb`
 * — שורה שלמה שמבטיחה זוג שלאף אחת מהשתיים אין (ids 3, 81, 92, 104
 * נושאות `uploadMbps: null`). מחיקת הערך לבדה הייתה פורשת שוב שתי
 * שורות עם "—" הדדי, ולכן השם נבחר ב-`speedFactLabel` לפי הנתון.
 */
export const SPEED_TILE_CAPTION = "מהירות גלישה";
export const SPEED_PAIR_LABEL = "מהירות (הורדה/העלאה)";

const SAME_FACT: Record<string, string> = {
  התקנה: "עלות התקנה",
  // ⚠️ שלוש הצורות מתאחדות לעובדה אחת, והתווית הקנונית נקייה משתיהן:
  // "ממירים (מקסימום)" (ראה `cardStats`) מול "ממירים כלולים" היו
  // נפרשות לשתי שורות עם "—" הדדי, כלומר הטבלה מכחישה נתון ששני
  // הכרטיסים מדפיסים. הערך ("2" מול "עד 7") הוא שמבדיל ביניהן.
  "ממיר כלול": "ממירים",
  "ממירים כלולים": "ממירים",
  "ממירים (מקסימום)": "ממירים",
  // צורות היחיד של כיתובי הכמות — ראה ההערה על `MINUTES_CAPTION` למעלה.
  "דקת שיחה": "דקות שיחה",
  "הודעת SMS": "הודעות SMS",
  "דקה לחו״ל": "דקות לחו״ל",
  ערוץ: "ערוצים",
  נדרש: "סוג מונה",
  "מתאים ל": "סוג מונה",
  // ⚠️ `cardStats` בוחר בין שתי התוויות האלה לפי `allHours`, ולכן
  // הן לעולם לא מופיעות יחד באותה חבילה — אבל הן כן מופיעות
  // זו לצד זו בהשוואה בין שני מסלולי חשמל, ושם הן נפרשו לשתי
  // שורות עם "—" הדדי: הטבלה הכריזה שלמסלול עם שעות מפורשות
  // אין נתון על מתי ההנחה חלה, בזמן שהכרטיס שלו מדפיס אותן.
  "מתי ההנחה חלה": "שעות ההנחה",
};

/**
 * שורות ההשוואה, מיושרות לפי **העובדה** ולא לפי המקור שלה.
 *
 * ⚠️ היישור היה לפי ה-`caption` של `cardStats` בלבד. `cardStats` דוחף
 * רק שדות שקיימים, ולכן אותו אינדקס מייצג נתון אחר בכל חבילה: השוואה
 * בין חבילה עם גלישה+דקות+SMS לחבילה כשרה (דקות+SMS בלבד) הציגה את
 * **דקות** השיחה של הכשרה תחת הכותרת "גלישה בישראל". היישור הוא לפי שם.
 *
 * ⚠️ ושם אחד אינו מספיק: `דקות לחו״ל` נכנס לשלישיית הכותרות רק כשנשאר
 * בה מקום, ואחרת הוא יושב ב-`detailRows`. שורת הכותרות סימנה "—"
 * לחבילה שהשלישייה שלה מלאה, ומחיקת השורה הכפולה לפי תווית הקפיאה את
 * ה-"—" במקומו: הטבלה הצהירה **שאין** לחבילה דקות לחו״ל, בעוד
 * "פרטים מלאים" של אותו כרטיס הראה 300. אותו דבר ל-"התקנה" מול
 * "עלות התקנה", שם שתי התוויות אפילו לא היו זהות ולכן הוצגו שתי שורות
 * סותרות זו לצד זו — "—" ו-"₪125" לאותה חבילה.
 *
 * שתי המקורות ממוזגים לכן למפה אחת לכל חבילה, והכותרות גוברות על
 * הפירוט (אותו ערך, ניסוח קצר יותר). "—" נשאר רק למי שבאמת חסר הנתון.
 *
 * ⚠️ אין כאן יותר מחיקה לפי **צירוף ערכים**. היא נועדה להפיל שם נרדף,
 * אבל הפילה כל שתי שורות שבמקרה נשאו אותם ערכים: "דמי חיבור" מחקה את
 * "דמי מעבר". שמות נרדפים מטופלים ב-`SAME_FACT`, במפורש.
 */
export function compareRows(items: Package[]): CompareRow[] {
  /*
   * ⚠️ שתי התוויות של המהירות מתאחדות לשורה אחת, והשם נבחר לפי הנתון:
   * התווית הזוגית רק אם **כל** מי שמסר מהירות מסר גם העלאה. כך השורה
   * נשארת אחת (אותה עובדה, בלי "—" הדדי) ולעולם אינה מבטיחה זוג שהנתון
   * לא מסר. ראה `SPEED_TILE_CAPTION`.
   */
  const speedFactLabel = items.every(
    (p) => p.category !== "home" || (p.spec as HomeSpec).uploadMbps != null,
  )
    ? SPEED_PAIR_LABEL
    : SPEED_TILE_CAPTION;
  const canon = (label: string) =>
    label === SPEED_TILE_CAPTION || label === SPEED_PAIR_LABEL
      ? speedFactLabel
      : (SAME_FACT[label] ?? label);
  const facts = items.map((p) => {
    const m = new Map<string, string>();
    for (const s of cardStats(p)) m.set(canon(s.caption), s.value);
    for (const r of detailRows(p)) if (!m.has(canon(r.label))) m.set(canon(r.label), r.value);
    return m;
  });

  // הסדר נשמר: כל הכותרות קודם, הפירוט אחריהן.
  const labels: string[] = [];
  const add = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };
  for (const p of items) for (const s of cardStats(p)) add(canon(s.caption));
  for (const p of items) for (const r of detailRows(p)) add(canon(r.label));

  return labels.map((label) => ({ label, values: facts.map((m) => m.get(label) ?? "—") }));
}
