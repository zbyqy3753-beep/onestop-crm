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

/** Big buckets are sold as "unlimited" — say so instead of printing 10000GB. */
export function dataLabel(spec: CellularSpec): string | null {
  if (spec.unlimitedData) return "גלישה חופשית";
  if (spec.dataGb == null || spec.dataGb === 0) return null;
  return `${nf.format(spec.dataGb)}GB`;
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
export function speedLabel(spec: HomeSpec): string | null {
  if (spec.downloadMbps == null) return null;
  const whole = (mbps: number) => mbps >= 1000 && mbps % 1000 === 0;
  const asGb = whole(spec.downloadMbps) && (spec.uploadMbps == null || whole(spec.uploadMbps));
  const unit = asGb ? "Gb" : "Mb";
  const value = (mbps: number) => nf.format(asGb ? mbps / 1000 : mbps);
  return spec.uploadMbps != null
    ? `${value(spec.downloadMbps)}/${value(spec.uploadMbps)}${unit}`
    : `${value(spec.downloadMbps)}${unit}`;
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
    const data = dataLabel(spec);
    if (data) out.push({ value: data, caption: "גלישה בישראל" });
    if (spec.minutes) out.push({ value: nf.format(spec.minutes), caption: MINUTES_CAPTION(spec.minutes) });
    if (spec.sms) out.push({ value: nf.format(spec.sms), caption: SMS_CAPTION(spec.sms) });
    if (out.length < 3 && spec.intlMinutes) {
      out.push({ value: nf.format(spec.intlMinutes), caption: INTL_MINUTES_CAPTION(spec.intlMinutes) });
    }
    return out.slice(0, 3);
  }

  if (pkg.category === "home") {
    const spec = pkg.spec as HomeSpec;
    const out: Stat[] = [];
    const speed = speedLabel(spec);
    if (speed) out.push({ value: speed, caption: "מהירות גלישה" });
    if (spec.channels) out.push({ value: nf.format(spec.channels), caption: CHANNELS_CAPTION(spec.channels) });
    // ⚠️ אותה שגיאה שהערה על `lineTiers` מזהירה מפניה, רק שכאן היא
    // **חיה**: id 70 הוא ממיר אחד, והכרטיס הכריז "1 ממירים".
    if (spec.converters) {
      out.push({
        value: nf.format(spec.converters),
        // ⚠️ רק הכיתוב משתנה, לא הערך: טבלת ההשוואה מיישרת לפי ה-`caption`,
        // ושני ניסוחים לאותה עובדה היו נפרשים לשתי שורות עם "—" הדדי.
        caption: spec.converters === 1 ? "ממיר כלול" : "ממירים כלולים",
      });
    }
    if (out.length < 3 && spec.installationCost != null) {
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
    if (s.intlMinutes && !tiled.has(INTL_MINUTES_CAPTION(s.intlMinutes))) {
      rows.push({ label: INTL_MINUTES_CAPTION(s.intlMinutes), value: nf.format(s.intlMinutes) });
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
    const speed = speedLabel(s);
    if (speed) rows.push({ label: "מהירות (הורדה/העלאה)", value: speed });
    if (!tiled.has("התקנה")) fee("עלות התקנה", s.installationCost);
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
    if (s.maxMonthlyBill) rows.push({ label: "תקרת חשבונית חודשית", value: shekels(s.maxMonthlyBill) });
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
const SAME_FACT: Record<string, string> = {
  "מהירות גלישה": "מהירות (הורדה/העלאה)",
  התקנה: "עלות התקנה",
  "ממיר כלול": "ממירים כלולים",
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
  const canon = (label: string) => SAME_FACT[label] ?? label;
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
