import type { Metadata } from "next";
import { CatalogTabs } from "./ui/CatalogTabs";
import { LeadForm } from "./ui/LeadForm";
import {
  basePackages,
  disclosedRiseCount,
  listable,
  listableCounts,
} from "./catalog/catalog";
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
 * כל ליד שנוצר כאן משויך לעובד שב-`LANDING_ASSIGNEE_EMAIL` — ראה
 * `actions.ts`.
 */

export const metadata: Metadata = {
  title: "ONE STOP | השוואת חבילות סלולר, סיבים, טלוויזיה וחשמל",
  description:
    "כל החבילות של כל החברות במקום אחד — כולל המחיר אחרי תום ההטבה. משאירים פרטים ומקבלים הצעה אישית.",
  robots: { index: false, follow: false },
};

export default function LandingPage() {
  const packages = listable(basePackages());
  const counts = listableCounts(packages);
  const disclosed = disclosedRiseCount(packages);

  return (
    <main className="lp-root">
      {/* ── כותרת ─────────────────────────────────────────────────── */}
      <header className="bg-lp-navy text-lp-on-navy">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="mb-6 text-sm font-extrabold tracking-[0.3em]">ONE STOP</div>

          <h1 className="max-w-3xl text-3xl leading-tight font-extrabold sm:text-4xl">
            כל החבילות של כל החברות — <span className="text-lp-brand-bright">במקום אחד</span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-lp-on-navy-2 sm:text-base">
            סלולר, סיבים, טלוויזיה וחשמל. אנחנו מציגים גם את{" "}
            <span className="font-semibold text-lp-on-navy">המחיר אחרי תום ההטבה</span> — הנתון
            שרוב האתרים משאירים באותיות הקטנות.
          </p>

          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-lp-2xs text-lp-on-navy-3">חבילות בהשוואה</dt>
              <dd className="nums text-xl font-bold">{counts.total}</dd>
            </div>
            <div>
              <dt className="text-lp-2xs text-lp-on-navy-3">סלולר</dt>
              <dd className="nums text-xl font-bold">{counts.cellular}</dd>
            </div>
            <div>
              <dt className="text-lp-2xs text-lp-on-navy-3">אינטרנט וטלוויזיה</dt>
              <dd className="nums text-xl font-bold">{counts.home}</dd>
            </div>
            <div>
              <dt className="text-lp-2xs text-lp-on-navy-3">חשמל</dt>
              <dd className="nums text-xl font-bold">{counts.electricity}</dd>
            </div>
            <div>
              <dt className="text-lp-2xs text-lp-on-navy-3">מגלות מחיר אחרי הטבה</dt>
              <dd className="nums text-xl font-bold">{disclosed}</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ── הקטלוג ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <CatalogTabs packages={packages} />
      </div>

      {/* ── טופס כללי, למי שלא בחר חבילה ──────────────────────────── */}
      <section className="border-t border-lp-line bg-lp-surface-2">
        <div className="mx-auto max-w-2xl px-4 py-10">
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
