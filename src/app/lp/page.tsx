import type { Metadata } from "next";
import Image from "next/image";
import { CatalogTabs } from "./ui/CatalogTabs";
import { Faq, HOME_FAQ } from "./ui/Faq";
import { LeadForm } from "./ui/LeadForm";
import { PackageCard } from "./ui/PackageCard";
import { ProviderLogo } from "./ui/ProviderLogo";
import { SavingsCalculator } from "./ui/SavingsCalculator";
import { SiteFooter } from "./ui/SiteFooter";
import {
  basePackages,
  byCategory,
  CATEGORY_META,
  CATEGORY_ORDER,
  cheapest,
  highlights,
  isMoney,
  listable,
  phoneCount,
  providers,
  serviceCounts,
} from "./catalog/catalog";
import { heroRiseLine, PACKAGES_CAPTION, PLANS_CAPTION, priceNote, shekels } from "./catalog/format";
import { isComparable } from "./catalog/savings";
import { GOOGLE_BUSINESS } from "./config";
import { servicePath } from "./site";
import "./lp.css";

/**
 * דף הנחיתה הציבורי — אתר השוואת החבילות, על הדומיין של ה-CRM.
 *
 * ⚠️ יושב **מחוץ** לקבוצת `(app)` בכוונה: אין כאן `AppShell`, סרגל
 * תחתון או בדיקת סשן — זה עמוד ללקוחות, לא מסך של המערכת. הנתיב פתוח
 * בשער הגישה (`src/proxy.ts`).
 *
 * ⚠️ **מאונדקס רק ב-eliran.onestopil.co.il** (מ-24.10.2026, יחד עם פרופיל
 * העסק בגוגל). בשאר הכתובות `X-Robots-Tag: noindex` מ-`next.config.ts`
 * עדיין חל, ו-`canonical` שלמטה מפנה את גוגל לכתובת של אלירן.
 *
 * ⚠️ **הקוד הועתק מ-`onestop-site`,** ומכאן שיש שני עותקים שיכולים
 * להיפרד: קטלוג (`catalog/packages.json`), קומפוננטות (`ui/`) ופלטה
 * (`--color-lp-*` ב-globals.css). ראה ההסבר ב-`catalog/catalog.ts`.
 *
 * ⚠️ **עמוד אחד, לא אתר.** המבנה כאן מחקה את עמוד הבית של האתר
 * הציבורי, אבל שם כל סקשן הוא שער לעמוד אחר (`/cellular`, `/p/[slug]`,
 * `/provider/[slug]`). כאן אין עמודים כאלה, ולכן כל מה שהיה קישור הפך
 * לעוגן אל הקטלוג שבתחתית. אל תוסיפו כאן `href` לנתיב שאינו קיים.
 *
 * כל ליד שנוצר כאן משויך לעובד שב-`LANDING_ASSIGNEE_EMAIL` — ראה
 * `actions.ts`.
 */

export const metadata: Metadata = {
  // הדף מוגש ב-eliran.onestopil.co.il (ראה `proxy.ts`), ולכן הלשונית נושאת את השם של אלירן.
  title: "אלירן תקשורת | השוואת חבילות סלולר, סיבים, טלוויזיה וחשמל",
  description:
    "כל החבילות של כל החברות במקום אחד, כולל המחיר אחרי תום ההטבה. משאירים פרטים ומקבלים הצעה אישית.",
  // ⚠️ דורס במפורש את `index: false` של `app/layout.tsx` — בלי השורה הזו הדף יורש אותו.
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eliran.onestopil.co.il/" },
  // ⚠️ אימות הבעלות ב-Google Search Console (נכס `https://eliran.onestopil.co.il/`).
  // הסרת התג מבטלת את האימות — גם אחרי שעבר.
  verification: { google: "KQ3F3qhgUXCR1MfVdJ8DkuK1kPzQDo_JvNvWBCwa8hg" },
};

/*
 * ⚠️ `phone` מורכב כאן ולא מוחזר מ-`serviceCounts`, כדי שהצורה שאותה
 * פונקציה מחזירה תישאר כפי שהיא. `phoneCount` קורא את אותם שערים
 * בדיוק — ראה ההערה שם.
 */
type ServiceCounts = ReturnType<typeof serviceCounts> & { phone: number };

/**
 * ששת השירותים, בסדר שבו הם מוצגים אחרי ההירו.
 *
 * ⚠️ הכיתוב של החשמל הוא "הנחה בחשבון" ולא "חבילות חשמל", ולכן גם
 * המונה שלו סופר מסלולים ולא מחירים.
 *
 * ⚠️ ארבעת הכרטיסים של הבית מובילים כולם לאותו עוגן (`#home`) — זה
 * אותו דלי בקטלוג, עם מסננים בצד הלקוח. אל תמציאו כאן עוגנים
 * (`#tv`, `#triple`) שהקטלוג אינו מכיר.
 *
 * ⚠️ "קו טלפון ביתי" הוא האריח הרביעי של הבית, ולא קישוט. חמשת
 * האריחים הראשונים כיסו 105 מ-106 החבילות שהדף מציג: id 83 ("בזק
 * טלפון - מדברים 50 דקות") אינה אינטרנט, אינה טלוויזיה ואינה משולבת,
 * ולכן הופיעה בקטלוג בזמן שרצועת "מה אנחנו משווקים" לא הצהירה עליה
 * באף מונה. אריח שמונה שלו 0 פשוט ייעלם ברענון הבא — ראה התנאי
 * שמתחת — ולכן זו לא הבטחה לחבילה שאינה קיימת.
 *
 * ⚠️ שש כריכות ולא חמש, ולכן `lg:grid-cols-3` ולא `grid-cols-5`:
 * שישה אריחים מתחלקים בדיוק לשתי שורות של שלוש בדסקטופ ולשלוש שורות
 * של שתיים בנייד, ולכן ה-`max-lg:last:col-span-2` — שהיה שם רק כדי
 * למלא את החור שמספר אי-זוגי משאיר — מיותר.
 */
const SERVICES: {
  title: string;
  blurb: string;
  hash: string;
  /*
   * ⚠️ המונה מופרד לערך ולכיתוב, ולא מוחזר כמחרוזת אחת: רק כך הרצועה
   * יכולה **להשמיט** אריח שאין מאחוריו חבילה. אריח עם "0 חבילות"
   * שמקשר לקטלוג הוא בדיוק הסתירה בין מספר מוצהר לרשימה מוצגת שהדף
   * הזה מתוקן ממנה שוב ושוב, רק בגודל 0 — ו-`highlights` בסקשן
   * "חבילות נבחרות" כבר נוהג כך (`picks.length === 0` → `null`).
   */
  n: (c: ServiceCounts) => number;
  caption: (n: number) => string;
}[] = [
  {
    title: "קווי סלולר",
    blurb: "קו בודד או חבילה משפחתית מכל החברות, כולל ניוד וסים.",
    hash: "#cellular",
    n: (c) => c.cellular,
    caption: PACKAGES_CAPTION,
  },
  {
    title: "אינטרנט וסיבים",
    blurb: "סיבים ואינטרנט ביתי: מהירות, ראוטר ועלות התקנה.",
    hash: "#home",
    n: (c) => c.internet,
    caption: PACKAGES_CAPTION,
  },
  {
    title: "חבילות טלוויזיה",
    blurb: "yes, HOT, סטינג TV ועוד. ערוצים, ממירים ו-VOD.",
    hash: "#home",
    n: (c) => c.tv,
    caption: PACKAGES_CAPTION,
  },
  {
    title: "טלוויזיה + אינטרנט",
    blurb: "חבילות משולבות וטריפל, הכול בחשבון אחד ובמחיר אחד.",
    hash: "#home",
    n: (c) => c.bundle,
    caption: PACKAGES_CAPTION,
  },
  {
    title: "קו טלפון ביתי",
    blurb: "קו בזק או קו על גבי הסיבים. דקות שיחה, בנפרד או בתוך החבילה.",
    hash: "#home",
    n: (c) => c.phone,
    caption: PACKAGES_CAPTION,
  },
  {
    title: "הנחה בחשמל",
    blurb: "אחוז הנחה על חשבון החשמל, לבית ולעסק, בלי להחליף ספק תשתית.",
    hash: "#electricity",
    n: (c) => c.electricity,
    caption: PLANS_CAPTION,
  },
];

export default function LandingPage() {
  const packages = listable(basePackages());
  const services: ServiceCounts = { ...serviceCounts(packages), phone: phoneCount(packages) };
  // ⚠️ ראה ההערה על `n`/`caption` ב-`SERVICES`: אריח בלי חבילה אחת
  // מאחוריו נשמט, ולא מצהיר "0 חבילות" מעל קישור לקטלוג.
  const shownServices = SERVICES.filter((s) => s.n(services) > 0);
  /*
   * החבילה שפס המחיר בהירו מצטט.
   *
   * ⚠️ מסננים לקטגוריה **לפני** `cheapest`, משתי סיבות נפרדות:
   *   1. `byPrice` מדרג מסלול חשמל לפי אחוז ההנחה בסימן שלילי, כלומר
   *      כל מסלול חשמל קטן מכל מחיר — ולמסלול חשמל אין `price`.
   *   2. הזול המוחלט בקטלוג הוא קו טלפון ביתי. נכון טכנית ומטעה
   *      שיווקית: ראש הדף היה מפרסם קו טלפון כאילו זו ההצעה המובילה.
   *      הכיתוב אומר "סלולר" כי זה מה שנספר.
   */
  /*
   * ⚠️ וגם `isComparable` — השער שהמנוע שמתה בדף כבר נושא.
   *
   * שתי השורות מתחת מוסיפות לפס הזה את ההסתייגות על המחיר
   * (`priceNote`) ואת מה שיקרה אחרי ההטבה (`heroRiseLine`), והשאלה
   * הראשונה — "האם זה בכלל תחליף לקו סלולר רגיל" — נשארה
   * מחוץ. המנוע שואל אותה שלוש פעמים בענף הסלולרי של
   * `isComparable` — לא כשר, יש גלישה, ולפחות 1000 דקות — והפס,
   * המספר הגדול בדף והיחיד שמי שגולל חצי מסך רואה, לא שאל אותה
   * אף פעם. ההערה שם מנמקת את שער הכשרות במילים "חיסכון
   * שמוצג מול מוצר שאינו תחליף לקו רגיל" — והפס אינו מציג
   * חיסכון אלא מוציא את אותה הצהרה צעד אחד קודם: זהו המחיר
   * שממנו מתחיל הסלולר בדף הזה.
   *
   * המספר שעל המסך אינו זז (₪21.90, id 91), וזה בדיוק ההיקף:
   * הזולה בקטלוג עוברת את השער בליווי. אבל היא רשומה **אחת**,
   * ואחריה הבאות בתור הן דווקא אלה שהמנוע מסרב לתמחר: שלוש
   * רשומות כשר (ids 23 ב-₪25, 46 ב-₪26, 24 ב-₪27.9) ומיד אחריהן
   * id 15, `DATA ONLY` ב-₪29 — חבילת גלישה בלי דקות שיחה כלל.
   * אומת בהרצה: בלי השער, רענון שמסיר רשומה אחת מפרסם
   * "סלולר — החל מ־₪25 לחודש" מעל קו כשר; עם השער הוא מפרסם
   * ₪29.90 של id 90 — קו עם 3000 דקות ו-300GB.
   */
  const lead =
    cheapest(
      byCategory(packages, "cellular").filter((p) => isComparable(p, "cellular")),
      1,
    )[0] ?? null;
  /*
   * ⚠️ `heroRiseLine` ולא שרשרת תנאים כאן. השורה הזו נבנתה ב-JSX עם
   * `priceAfterPromo != null` — השער הרופף מבין שלושת המקומות בדף
   * שמדפיסים את השדה (ראה `promoRise` ב-`format.ts`): `0` היה מודפס
   * כ-"ואחרי ההטבה ₪0" ובולע את ההערה המילולית שהרשומה כן מסרה.
   */
  const riseLine = lead ? heroRiseLine(lead) : null;
  /*
   * ⚠️ וגם ההסתייגות על המחיר עצמו, ולא רק על מה שיקרה אחרי ההטבה.
   *
   * `priceNote` הוא השער המשותף שאומר מתי המספר אינו מחיר חודשי שטוח
   * — "המחיר מותנה בכמות המנויים בחבילה", "מחיר למנוי במסלול משפחתי",
   * "המחיר הוא מחיר התחלתי ולא מחיר אחיד" — והוא הוצא ל-`format.ts`
   * בדיוק כדי שלא יישאר על משטח אחד (ההערה שם מתעדת שזו הייתה הפעם
   * הרביעית). הכרטיס קורא אותו, `compareRows` קורא אותו, והפס הזה —
   * ההצהרה הגדולה ביותר בדף, שאותה חבילה מצוטטת בה בגודל 4xl —
   * נשאר מחוץ לשלישייה, בדיוק כפי שקרה ל-`priceAfterPromo` עד
   * ש-`heroRiseLine` נכתב שורה מעל.
   *
   * ⚠️ `cheapest` מדרג לפי `price` הגולמי, בלי לדעת שהמחיר מותנה
   * (זה ממצא פתוח על `byPrice`), ולכן הפס יצטט חבילה כזו ברגע שהיא
   * תהיה הזולה: היום הזולה היא id 91 (₪21.9, בלי הסתייגות), אבל שש
   * חבילות סלולר נושאות הסתייגות ומתחילות ב-id 117 ב-₪29.9 — חמישית
   * ברשימה. רענון שמסיר שלוש מהזולות מפרסם ₪35 של id 110 כמחיר לקו
   * יחיד, בזמן שהכרטיס שלו מתחת מודה שהמחיר מותנה בשני מנויים.
   */
  const leadNote = lead ? priceNote(lead) : null;

  /*
   * סימון מובנה לגוגל — אותם פרטים כמו בפרופיל העסק (`GOOGLE_BUSINESS`),
   * כדי שגוגל תקשר בין האתר לפרופיל.
   */
  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: GOOGLE_BUSINESS.name,
    url: GOOGLE_BUSINESS.url,
    telephone: GOOGLE_BUSINESS.phone,
    image: `${GOOGLE_BUSINESS.url}/brand/eliran/icon.png`,
    areaServed: { "@type": "Country", name: "ישראל" },
    sameAs: [GOOGLE_BUSINESS.instagramUrl],
  };

  return (
    <main className="lp-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      {/* ── הירו ──────────────────────────────────────────────────── */}
      {/*
        ⚠️ הרקע כאן הוא **תצלום אמיתי**, ולא גרפיקה שנוצרה בקוד. אותו
        קובץ ואותה החלטה כמו באתר הציבורי: ארבע גרסאות של רקע מצויר
        נפסלו שם כ"נראה מיוצר", וצילום של אנשים אמיתיים בחדר אמיתי הוא
        מה שפתר את זה. אל תחליפו אותו בגרדיאנט.

        הקובץ: `public/brand/hero.jpg`, צילום Ron Lach מ-Pexels
        (רישיון Pexels — מסחרי, ללא חובת ייחוס).

        ⚠️ `priority` הוא חובה: זה ה-LCP של הדף. בלעדיו הצילום נטען
        אחרון והמבקר רואה מלבן כהה ריק בשנייה הראשונה.
      */}
      <section className="relative overflow-hidden bg-lp-navy-deep text-lp-on-navy">
        <Image
          src="/brand/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[38%_45%]"
        />
        {/* ⚠️ ראה `.lp-hero-scrim` ב-lp.css — אנכית בנייד, אופקית בדסקטופ. */}
        <div aria-hidden className="lp-hero-scrim absolute inset-0" />

        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-14 sm:pt-16 lg:min-h-[34rem] lg:pt-24 lg:pb-24">
          {/*
            ⚠️ הלוגו של "אלירן תקשורת" ולא ONE STOP: הדף מוגש כאתר של אלירן
            (ראה `proxy.ts`). ONE STOP נשאר רק במקומות שמזהים את הגוף
            המשפטי — הגילוי הנאות והשאלות. הסכמת הטופס היא לפנייה של
            אלירן (החלטת בעל המערכת, 24.10.2026).
            ⚠️ שם המותג כטקסט, בלי סמל. לאלירן אין לוגו רשמי: הסמל הקודם (אריח
            Wi-Fi מבריק) נפסל ב-11.2026 כ-AI slop, ולפי antislop R-23 לא
            ממציאים לוגו במקומו בלי אישור. כשיהיה לוגו אמיתי, הוא נכנס כאן.
          */}
          <div className="mb-8">
            <div className="leading-none">
              <div className="text-2xl font-extrabold text-white">אלירן תקשורת</div>
              <div className="mt-1.5 text-xs font-medium text-white/70">ייעוץ תקשורת סלולרית וביתית</div>
            </div>
          </div>

          <div className="max-w-xl">
            <h1 className="text-lp-hero font-extrabold text-white [text-shadow:0_2px_18px_rgb(3_8_16/0.6)]">
              כל חשבונות התקשורת.
              <span className="block">מקום אחד.</span>
              <span className="block text-lp-brand-bright">מחיר אחד קטן.</span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
              סלולר, אינטרנט, טלוויזיה והנחה בחשבון החשמל. משווים מחירים של כל החברות,
              ומציגים גם את המחיר שאחרי תקופת המבצע.
            </p>

            {/*
              ⚠️ פס המחיר לקוח מהפוסטרים של המותג, אבל המספר בתוכו נשלף
              מהקטלוג דרך `cheapest` — הוא תמיד מחיר של חבילה שקיימת.
              אל תקבעו כאן מספר ידני.

              ⚠️ באתר הציבורי הפס הוא קישור לעמוד החבילה. כאן אין עמוד
              כזה, ולכן הוא עוגן אל הקטלוג — לא `<Link>` לשום מקום.
            */}
            {/*
              ⚠️ `isMoney` ולא `!= null`, כמו `headlineValue` על הכרטיס:
              אותה הגדרה של "מספר שמותר להדפיס" בכל מקום בדף. `lead`
              עובר היום דרך `listable`, ולכן זו עקביות ולא תיקון באג.
            */}
            {lead && isMoney(lead.price) && (
              <a
                href="#cellular"
                className="group mt-7 inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1"
              >
                {/*
                  ⚠️ שורת מחיר ולא כפתור, ובלי פס צבעוני בצד. עד 11.2026 זה היה
                  "כפתור" בגרדיאנט עם צל, ואחר כך שורה עם פס כחול; שניהם נפסלו
                  כ-AI slop. המספר הגדול הוא הדבר הבולט, ולא צריך יותר מזה.
                */}
                <span className="text-base font-semibold text-white/80 sm:text-lg">סלולר החל מ־</span>
                <span dir="ltr" className="nums text-3xl leading-none font-extrabold text-white sm:text-4xl">
                  {shekels(lead.price)}
                </span>
                <span className="text-base font-semibold text-white/80 group-hover:text-white sm:text-lg">לחודש</span>
                {/*
                  ⚠️ המחיר שאחרי ההטבה נמצא כאן כי הפסקה שלוש שורות מעליו
                  מבטיחה במפורש "ומציגים גם את המחיר שאחרי תקופת המבצע".
                  `cheapest` מדרג לפי `price` — מחיר ההטבה — ולכן החבילה
                  שהפס מצטט היא HOT mobile Synergy 150GB ב-₪21.9, שעולה
                  ל-₪57.9: פי 2.64. הפס הראשי של הדף פרסם את מלכודת המבצע
                  הגדולה בקטלוג והכחיש את ההבטחה שמעליו. 17 מ-55 חבילות
                  הסלולר נושאות עלייה כזו — 13 עם `priceAfterPromo` מספרי
                  ועוד 4 שמצהירות עליה בטקסט בלבד — כלומר זה לא מקרה קצה.
                  `heroRiseLine` קוראת את שתיהן (מספר והערה מילולית),
                  ולכן הספירה כאן חייבת לכלול את שתיהן.
                */}
                {leadNote && (
                  <span className="basis-full text-xs font-medium text-white/70 sm:text-sm">
                    {leadNote.value}
                  </span>
                )}
                {riseLine && (
                  <span className="basis-full text-xs font-medium text-white/70 sm:text-sm">
                    {riseLine}
                  </span>
                )}
              </a>
            )}

            {/*
              ⚠️ אותה צורה כמו `btnPrimary` בשאר הדף (פינות `rounded-lg`, בלי
              צל), ולא "גלולות". כפתור אחד מלא ואחד מתאר — לא שני ראשיים.
            */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="inline-flex h-12 items-center rounded-lg bg-white px-6 text-base font-bold text-lp-ink transition hover:bg-lp-surface-3"
              >
                בואו נשווה
              </a>
              <a
                href="#lead"
                className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 text-base font-bold text-white transition hover:border-white hover:bg-white/5"
              >
                שיחזרו אליי
              </a>
            </div>
          </div>

          {/*
            ⚠️ מוסתר מתחת ל-lg. האריה עומד בצד השמאלי של הצילום, ובנייד
            אין שם צד שמאל — הוא היה נוחת על הטקסט.
          */}
          <Image
            src="/brand/lion.png"
            alt=""
            width={420}
            height={426}
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-2 hidden h-72 w-auto lg:block xl:h-80"
          />
        </div>

        {/*
          רצועת החברות — יושבת **בתוך** ההירו ולא כסקשן נפרד מתחתיו.
          ⚠️ הרשימה נספרת מ-`providers(packages)`, כלומר רק חברות שיש
          להן חבילה גלויה. אל תקבעו כאן רשימה ידנית.

          ⚠️ הלוגואים אינם לחיצים כאן, בשונה מהאתר. שם כל אחד מוביל
          ל-`/provider/[slug]`; בדף הזה אין עמוד ספק, וכפתור שמזיז את
          הקטלוג בלי לסנן לפי הספק הוא הבטחה שלא מתקיימת.
        */}
        <div className="relative border-t border-white/15 bg-lp-navy-deep/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            {/* תווית שקטה ולא "תג" עם נקודה זוהרת. */}
            <span className="shrink-0 text-xs font-semibold text-white/70">משווקים מורשים</span>
            <ul className="flex flex-1 flex-wrap items-center gap-3 sm:flex-nowrap sm:overflow-x-auto">
              {providers(packages).map((p) => (
                <li key={p.slug} className="shrink-0">
                  <span
                    title={`חבילות ${p.name}`}
                    className="flex size-11 items-center justify-center rounded-lg bg-white"
                  >
                    <ProviderLogo logo={p.logo} name={p.name} size={18} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── מה אנחנו משווקים ──────────────────────────────────────── */}
      {/*
        ⚠️ לבן על רקע בהיר ולא כרטיסים כהים בתוך ההירו. השבירה מנייבי
        ללבן בדיוק בגבול הסקשן היא מה שגורם לחמשת הכרטיסים לקפוץ לעין.

        ⚠️ **בלי שוליים שליליים.** ההירו נגמר ברצועת הלוגואים, ומשיכה
        כלפי מעלה פשוט מכסה אותה.
      */}
      <section className="relative border-b border-lp-line bg-lp-surface">
        <nav aria-labelledby="services-heading" className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="services-heading" className="text-xl font-bold text-lp-ink sm:text-2xl">
            מה אני משווה
          </h2>
          <ul className="mt-4 grid border-t border-lp-line sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
            {/*
              ⚠️ רשימה ולא שישה כרטיסים זהים עם אייקון. הכרטיסים (אריח אייקון,
              צל, "קפיצה" בריחוף, חץ בכל אחד) נפסלו ב-11.2026 כ-AI slop.
              המידע כאן הוא שם, שורה ומונה, ורשימה מראה אותו בלי שש קופסאות.
              המונה בצבע המותג הוא מה שמסמן שהשורה לחיצה.
            */}
            {shownServices.map((s) => (
              <li key={s.title} className="border-b border-lp-line">
                <a
                  href={s.hash}
                  className="group flex min-h-11 items-baseline justify-between gap-4 py-4"
                >
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold text-lp-ink transition group-hover:text-lp-brand sm:text-lg">
                      {s.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-lp-ink-2">{s.blurb}</span>
                  </span>
                  <span className="nums shrink-0 text-sm font-bold text-lp-brand group-hover:underline">
                    {s.n(services)} {s.caption(s.n(services))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {/* ── מחשבון החיסכון ────────────────────────────────────────── */}
      {/*
        ⚠️ מעל הקטלוג ולא מתחתיו, בכוונה. מי שנוחת כאן לא יודע איזו
        חבילה הוא רוצה — הוא יודע כמה הוא משלם. המחשבון הופך את הסכום
        הזה לתשובה מול הקטלוג האמיתי, והוא גם מציג את החיסכון **לפני**
        שהוא מבקש טלפון: מחשבון שמסתיר מספר שכבר חושב הוא מלכודת.
      */}
      <section className="border-b border-lp-line bg-lp-surface" aria-labelledby="lp-calc-heading">
        <div className="mx-auto max-w-3xl px-4 py-12">
          {/* כותרת לסקשן, כדי שכותרות השלבים (h3) לא ייכנסו תחת "מה אנחנו משווקים". */}
          <h2 id="lp-calc-heading" className="sr-only">
            מחשבון חיסכון
          </h2>
          <SavingsCalculator packages={packages} />
        </div>
      </section>

      {/* ── חבילות נבחרות ─────────────────────────────────────────── */}
      {CATEGORY_ORDER.map((category) => {
        const picks = highlights(packages, category, 3);
        if (picks.length === 0) return null;
        const meta = CATEGORY_META[category];
        return (
          <section key={category} className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-lp-ink sm:text-2xl">{meta.he}</h2>
                <p className="mt-1 text-sm text-lp-ink-2">{meta.blurb}</p>
              </div>
              <a
                href={servicePath(category)}
                className="rounded-lg border border-lp-line bg-lp-surface px-4 py-2 text-sm font-medium text-lp-brand transition hover:border-lp-brand"
              >
                לכל החבילות
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {picks.map((p) => (
                <PackageCard key={p.id} pkg={p} />
              ))}
            </div>
          </section>
        );
      })}

      {/* ── איך זה עובד ───────────────────────────────────────────── */}
      <section className="border-y border-lp-line bg-lp-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-8 text-xl font-bold text-lp-ink sm:text-2xl">איך זה עובד</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              ["01", "בוחרים חבילה", "משווים לפי מחיר, מפרט, וגם לפי המחיר אחרי תום ההטבה."],
              ["02", "משאירים פרטים", "טופס קצר על הכרטיס עצמו, או המחשבון למעלה. ללא עלות."],
              ["03", "נציג סוגר לכם", "בודקים זמינות ותנאים מול החברה, ומטפלים בניוד מקצה לקצה."],
            ].map(([n, title, body]) => (
              <li key={n}>
                <span className="nums text-sm font-bold text-lp-brand-bright">{n}</span>
                <h3 className="mt-1 font-semibold text-lp-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-lp-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── הקטלוג ────────────────────────────────────────────────── */}
      {/*
        ⚠️ `id="catalog"` הוא היעד שכל העוגנים בדף גוללים אליו, ו-
        `CatalogTabs` מחפש אותו בשם הזה. שינוי שם כאן שובר את חמשת
        כרטיסי השירות, את פס המחיר ואת כל "לכל החבילות" — בשקט.
      */}
      <div id="catalog" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-12">
        <CatalogTabs packages={packages} />
      </div>

      {/* ── שאלות נפוצות ──────────────────────────────────────────── */}
      <section className="border-t border-lp-line bg-lp-surface-2">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 text-xl font-bold text-lp-ink sm:text-2xl">שאלות נפוצות</h2>
          <Faq items={HOME_FAQ} />
        </div>
      </section>

      {/* ── טופס כללי, למי שלא בחר חבילה ──────────────────────────── */}
      <section id="lead" className="border-t border-lp-line bg-lp-surface">
        <div className="mx-auto max-w-2xl px-4 py-14">
          <h2 className="text-xl font-bold text-lp-ink">לא בטוחים מה מתאים?</h2>
          <p className="mt-2 mb-5 text-sm text-lp-ink-2">
            השאירו פרטים ונחזור אליכם עם ההצעה המשתלמת ביותר עבורכם, בלי עלות ובלי התחייבות.
          </p>

          <div className="rounded-lp-card border border-lp-line bg-lp-surface p-5 shadow-lp-card">
            <LeadForm />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-lp-ink-3">
            <span>ללא עלות · ללא התחייבות · מענה מהיר</span>
          </div>
        </div>
      </section>

      {/* ── פוטר ──────────────────────────────────────────────────── */}
      <SiteFooter />
    </main>
  );
}
