import type { Metadata } from "next";
import Image from "next/image";
import { CatalogTabs } from "./ui/CatalogTabs";
import { Faq, HOME_FAQ } from "./ui/Faq";
import { LeadForm } from "./ui/LeadForm";
import { PackageCard } from "./ui/PackageCard";
import { ProviderLogo } from "./ui/ProviderLogo";
import { SavingsCalculator } from "./ui/SavingsCalculator";
import {
  basePackages,
  byCategory,
  CATEGORY_META,
  CATEGORY_ORDER,
  cheapest,
  highlights,
  listable,
  providers,
  serviceCounts,
} from "./catalog/catalog";
import { shekels } from "./catalog/format";
import "./lp.css";

/**
 * דף הנחיתה הציבורי — אתר השוואת החבילות, על הדומיין של ה-CRM.
 *
 * ⚠️ יושב **מחוץ** לקבוצת `(app)` בכוונה: אין כאן `AppShell`, סרגל
 * תחתון או בדיקת סשן — זה עמוד ללקוחות, לא מסך של המערכת. הנתיב פתוח
 * בשער הגישה (`src/proxy.ts`).
 *
 * ⚠️ **לא מאונדקס.** הכותרת `X-Robots-Tag: noindex` מ-`next.config.ts`
 * חלה על כל הנתיבים, וכאן זה מכוון: הדף מופץ בקישור ישיר בלבד.
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
  title: "ONE STOP | השוואת חבילות סלולר, סיבים, טלוויזיה וחשמל",
  description:
    "כל החבילות של כל החברות במקום אחד — כולל המחיר אחרי תום ההטבה. משאירים פרטים ומקבלים הצעה אישית.",
  robots: { index: false, follow: false },
};

/**
 * ⚠️ אייקוני קו משורטטים ולא אמוג׳י.
 *
 * אמוג׳י נראה שונה בכל מערכת הפעלה, לא מקבל את צבע המותג, ומוסיף
 * לעמוד השוואת מחירים מראה של הודעת וואטסאפ. חמשת הגליפים כאן חולקים
 * עובי קו אחד (1.6) ו-viewBox אחד, ולכן נקראים כסט.
 */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-7"
      aria-hidden
    >
      {children}
    </svg>
  );
}

type ServiceCounts = ReturnType<typeof serviceCounts>;

/**
 * חמשת השירותים, בסדר שבו הם מוצגים אחרי ההירו.
 *
 * ⚠️ הכיתוב של החשמל הוא "הנחה בחשבון" ולא "חבילות חשמל", ולכן גם
 * המונה שלו סופר מסלולים ולא מחירים.
 *
 * ⚠️ שלושת הכרטיסים של הבית מובילים כולם לאותו עוגן (`#home`) — זה
 * אותו דלי בקטלוג, עם מסננים בצד הלקוח. אל תמציאו כאן עוגנים
 * (`#tv`, `#triple`) שהקטלוג אינו מכיר.
 */
const SERVICES: {
  title: string;
  blurb: string;
  hash: string;
  icon: React.ReactNode;
  count: (c: ServiceCounts) => string;
}[] = [
  {
    title: "קווי סלולר",
    blurb: "קו בודד או חבילה משפחתית, מכל החברות — כולל ניוד וסים.",
    hash: "#cellular",
    icon: (
      <Glyph>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M10.5 5.5h3M12 18.5h.01" />
      </Glyph>
    ),
    count: (c) => `${c.cellular} חבילות`,
  },
  {
    title: "אינטרנט וסיבים",
    blurb: "תשתית סיבים ואינטרנט ביתי — מהירות, ראוטר ועלות התקנה.",
    hash: "#home",
    icon: (
      <Glyph>
        <path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a10 10 0 0 1 13 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01" />
      </Glyph>
    ),
    count: (c) => `${c.internet} חבילות`,
  },
  {
    title: "חבילות טלוויזיה",
    blurb: "yes, HOT, סטינג TV ועוד — ערוצים, ממירים ו-VOD.",
    hash: "#home",
    icon: (
      <Glyph>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M8.5 21.5h7M10 10.5l4 2.5-4 2.5z" />
      </Glyph>
    ),
    count: (c) => `${c.tv} חבילות`,
  },
  {
    title: "טלוויזיה + אינטרנט",
    blurb: "חבילות משולבות וטריפל — הכול בחשבון אחד ובמחיר אחד.",
    hash: "#home",
    icon: (
      <Glyph>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M8.5 21.5h7M8.5 13.5a5 5 0 0 1 7 0M10.5 10.8a8.5 8.5 0 0 1 3 0M12 15.8h.01" />
      </Glyph>
    ),
    count: (c) => `${c.bundle} חבילות`,
  },
  {
    title: "הנחה בחשמל",
    blurb: "אחוז הנחה על חשבון החשמל, לבית ולעסק — בלי להחליף ספק תשתית.",
    hash: "#electricity",
    icon: (
      <Glyph>
        <path d="M13.5 2.5 5 13.5h6l-.5 8L19 10.5h-6z" />
      </Glyph>
    ),
    count: (c) => `${c.electricity} מסלולים`,
  },
];

export default function LandingPage() {
  const packages = listable(basePackages());
  const services = serviceCounts(packages);
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
  const lead = cheapest(byCategory(packages, "cellular"), 1)[0] ?? null;

  return (
    <main className="lp-root">
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
          <div className="mb-6 text-sm font-extrabold tracking-[0.3em] text-white">ONE STOP</div>

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
            {lead?.price != null && (
              <a
                href="#cellular"
                className="group mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-lp-brand-bright to-lp-brand px-6 py-4 shadow-lp-pop transition hover:from-lp-brand-glow sm:px-9 sm:py-5"
              >
                <span className="text-lg font-extrabold text-white sm:text-2xl">סלולר — החל מ־</span>
                <span dir="ltr" className="nums text-2xl leading-none font-extrabold text-white sm:text-4xl">
                  {shekels(lead.price)}
                </span>
                <span className="text-lg font-extrabold text-white sm:text-2xl">לחודש</span>
              </a>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="group inline-flex h-13 items-center gap-1 rounded-full bg-white px-7 text-base font-bold text-lp-ink shadow-lp-lift transition hover:bg-lp-surface-2"
              >
                בואו נשווה
                <span aria-hidden className="transition group-hover:-translate-x-1">
                  ←
                </span>
              </a>
              <a
                href="#lead"
                className="inline-flex h-13 items-center rounded-full border-[1.5px] border-white/55 px-6 text-base font-bold text-white transition hover:bg-white/10"
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
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/35 bg-lp-navy-deep/60 px-4 py-2 text-xs font-bold text-white">
              <span aria-hidden className="size-1.5 rounded-full bg-lp-brand-bright shadow-lp-glow" />
              משווקים מורשים
            </span>
            <ul className="flex flex-1 items-center gap-3 overflow-x-auto">
              {providers(packages).map((p) => (
                <li key={p.slug} className="shrink-0">
                  <span
                    title={`חבילות ${p.name}`}
                    className="flex size-11 items-center justify-center rounded-full bg-white"
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
      <section className="relative border-b border-lp-line bg-lp-surface-2">
        <nav aria-labelledby="services-heading" className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="services-heading" className="sr-only">
            מה אנחנו משווקים
          </h2>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            {SERVICES.map((s) => (
              <li key={s.title} className="max-lg:last:col-span-2">
                <a
                  href={s.hash}
                  className="group flex h-full flex-col rounded-lp-card border border-lp-line bg-lp-surface p-4 shadow-lp-lift transition hover:-translate-y-0.5 hover:border-lp-brand hover:shadow-lp-pop sm:p-5"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-lp-brand text-lp-ink-invert shadow-lp-glow transition group-hover:bg-lp-brand-bright">
                    {s.icon}
                  </span>
                  <span className="mt-4 text-base leading-snug font-extrabold text-lp-ink sm:text-lg">
                    {s.title}
                  </span>
                  <span className="mt-1.5 flex-1 text-xs leading-relaxed text-lp-ink-2 sm:text-sm">
                    {s.blurb}
                  </span>
                  <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-lp-brand">
                    <span className="nums">{s.count(services)}</span>
                    <span aria-hidden className="transition group-hover:-translate-x-1">
                      ←
                    </span>
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
      <section className="border-b border-lp-line bg-lp-surface">
        <div className="mx-auto max-w-3xl px-4 py-12">
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
                href={meta.hash}
                className="rounded-lg border border-lp-line bg-lp-surface px-4 py-2 text-sm font-medium text-lp-brand transition hover:border-lp-brand"
              >
                לכל החבילות ←
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
            השאירו פרטים ונחזור אליכם עם ההצעה המשתלמת ביותר עבורכם — בלי עלות ובלי התחייבות.
          </p>

          <div className="rounded-lp-card border border-lp-line bg-lp-surface p-5 shadow-lp-card">
            <LeadForm />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-lp-ink-3">
            <span>✓ ללא עלות</span>
            <span>✓ ללא התחייבות</span>
            <span>✓ מענה מהיר</span>
          </div>
        </div>
      </section>

      {/* ── פוטר ──────────────────────────────────────────────────── */}
      <footer className="bg-lp-navy py-8 text-center text-lp-on-navy-3">
        <div className="mx-auto max-w-2xl px-4">
          {/*
            ⚠️ הגילוי הזה אינו קישוט. ONE STOP הוא משווק מורשה שמקבל
            עמלה, והצגת האתר כ"משווה אובייקטיבי" בלי לומר זאת היא בדיוק
            מה שהרגולציה בתחום אוסרת. אותו נוסח מופיע באתר הציבורי.
          */}
          <p className="text-lp-2xs leading-relaxed">
            ONE STOP הוא משווק מורשה של חברות התקשורת והחשמל ומקבל מהן עמלה. המחירים והתנאים
            המחייבים הם אלה של החברה המפעילה, וייתכנו שינויים ותנאי סף.
          </p>
          <p className="mt-3 text-lp-2xs">
            <a href="/privacy" className="underline">
              מדיניות הפרטיות
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
