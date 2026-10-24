import { basePackages, CATEGORY_META, providers } from "../catalog/catalog";
import { GOOGLE_BUSINESS } from "../config";
import { providerPath, SERVICE_PAGES } from "../site";

/**
 * הפוטר של כל עמודי האתר של אלירן.
 *
 * ⚠️ רשימת הקישורים לעמודי השירות והחברות היא לא קישוט: זו הדרך שבה
 * גוגל מגיעה מעמוד הבית לכל עמוד תוכן. עמוד שאין אליו קישור פנימי
 * נסרק רק דרך מפת האתר, ומדורג חלש יותר.
 */
export function SiteFooter() {
  const companies = providers(basePackages());

  return (
    <footer className="bg-lp-navy py-10 text-center text-lp-on-navy-3">
      <div className="mx-auto max-w-4xl px-4">
        <nav aria-label="עמודי האתר" className="mb-8 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-2 font-bold text-lp-on-navy">השוואה לפי שירות</h2>
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
              {SERVICE_PAGES.map((s) => (
                <li key={s.slug}>
                  <a href={`/${s.slug}`} className="hover:text-lp-on-navy hover:underline">
                    {CATEGORY_META[s.category].he}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 font-bold text-lp-on-navy">השוואה לפי חברה</h2>
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
              {companies.map((p) => (
                <li key={p.slug}>
                  <a href={providerPath(p.slug)} className="hover:text-lp-on-navy hover:underline">
                    {p.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* ⚠️ כפתור הדירוג מוצג רק כשיש קישור — ראה `GOOGLE_BUSINESS.reviewUrl`. */}
        {GOOGLE_BUSINESS.reviewUrl && (
          <a
            href={GOOGLE_BUSINESS.reviewUrl}
            target="_blank"
            rel="noopener"
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-lp-navy"
          >
            <span aria-hidden className="text-amber-500">★★★★★</span>
            דרגו אותנו בגוגל
          </a>
        )}
        <p className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-lp-on-navy">
          <a href={GOOGLE_BUSINESS.whatsappUrl} target="_blank" rel="noopener" className="underline">
            וואטסאפ
          </a>
          <a href={GOOGLE_BUSINESS.instagramUrl} target="_blank" rel="noopener" className="underline">
            אינסטגרם
          </a>
        </p>
        {/*
          ⚠️ הגילוי הזה אינו קישוט. ONE STOP הוא משווק מורשה שמקבל
          עמלה, והצגת האתר כ"משווה אובייקטיבי" בלי לומר זאת היא בדיוק
          מה שהרגולציה בתחום אוסרת. אותו נוסח מופיע באתר הציבורי.
        */}
        <p className="mx-auto max-w-2xl text-lp-2xs leading-relaxed">
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
  );
}
