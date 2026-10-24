import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  basePackages,
  byCategory,
  CATEGORY_META,
  disclosedRiseCount,
  highlights,
  listable,
  providers,
} from "../catalog/catalog";
import { GOOGLE_BUSINESS } from "../config";
import { INDEXABLE, providerPath, servicePage, SERVICE_PAGES, SITE_ORIGIN } from "../site";
import { CatalogBrowser } from "../ui/CatalogBrowser";
import { Faq, HOME_FAQ } from "../ui/Faq";
import { LeadForm } from "../ui/LeadForm";
import { PackageCard } from "../ui/PackageCard";
import { ProviderLogo } from "../ui/ProviderLogo";
import { SiteFooter } from "../ui/SiteFooter";
import { SubpageHeader } from "../ui/SubpageHeader";
import "../lp.css";

/**
 * עמוד שירות באתר של אלירן — `/cellular`, `/internet-tv`, `/electricity`.
 *
 * ⚠️ עמוד לכל קטגוריה ולא לשונית בעמוד הבית, בשביל גוגל: מי שמחפש
 * "השוואת חבילות סלולר" צריך לנחות על עמוד שזו הכותרת שלו. הלשוניות
 * בעמוד הבית נשארות — הן משרתות את מי שכבר בדף.
 *
 * הכתובת הציבורית היא בלי `/lp`; ראה `site.ts` ו-`eliranSite` ב-`proxy.ts`.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICE_PAGES.map((s) => ({ service: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lp/[service]">): Promise<Metadata> {
  const page = servicePage((await params).service);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    robots: INDEXABLE,
    alternates: { canonical: `${SITE_ORIGIN}/${page.slug}` },
  };
}

export default async function ServicePage({ params }: PageProps<"/lp/[service]">) {
  const page = servicePage((await params).service);
  if (!page) notFound();

  const packages = listable(byCategory(basePackages(), page.category));
  const picks = highlights(packages, page.category, 3);
  const companies = providers(packages);
  const disclosed = disclosedRiseCount(packages);
  const meta = CATEGORY_META[page.category];

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: GOOGLE_BUSINESS.name, item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: page.h1, item: `${SITE_ORIGIN}/${page.slug}` },
    ],
  };

  return (
    <main className="lp-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <SubpageHeader title={page.h1} blurb={meta.blurb} active={page.slug}>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <dt className="nums text-2xl font-bold text-lp-brand-bright">{packages.length}</dt>
            <dd className="text-xs text-lp-on-navy-3">חבילות להשוואה</dd>
          </div>
          <div>
            <dt className="nums text-2xl font-bold text-lp-brand-bright">{companies.length}</dt>
            <dd className="text-xs text-lp-on-navy-3">חברות</dd>
          </div>
          {disclosed > 0 && (
            <div>
              <dt className="nums text-2xl font-bold text-lp-brand-bright">{disclosed}</dt>
              <dd className="text-xs text-lp-on-navy-3">מציגות מחיר אחרי ההטבה</dd>
            </div>
          )}
        </dl>
      </SubpageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <section className="max-w-3xl space-y-3 text-base leading-relaxed text-lp-ink-2">
          {page.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        {companies.length > 1 && (
          <nav aria-label="לפי חברה" className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-lp-ink">לפי חברה</h2>
            <ul className="flex flex-wrap gap-2">
              {companies.map((p) => (
                <li key={p.slug}>
                  <a
                    href={providerPath(p.slug)}
                    title={`חבילות ${p.name}`}
                    className="flex h-14 w-24 items-center justify-center rounded-lp-card border border-lp-line bg-lp-surface px-3 shadow-lp-card transition hover:border-lp-brand"
                  >
                    <ProviderLogo logo={p.logo} name={p.name} size={26} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {picks.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold text-lp-ink">החבילות הבולטות ב{meta.he}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {picks.map((p) => (
                <PackageCard key={p.id} pkg={p} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-lp-ink">כל החבילות</h2>
          <CatalogBrowser packages={packages} category={page.category} />
        </section>
      </div>

      <section className="border-t border-lp-line bg-lp-surface-2">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 text-xl font-bold text-lp-ink sm:text-2xl">שאלות נפוצות</h2>
          <Faq items={HOME_FAQ} />
        </div>
      </section>

      <section id="lead" className="border-t border-lp-line bg-lp-surface">
        <div className="mx-auto max-w-2xl px-4 py-14">
          <h2 className="text-xl font-bold text-lp-ink">רוצים שאבדוק לכם?</h2>
          <p className="mt-2 mb-5 text-sm text-lp-ink-2">
            השאירו פרטים ואחזור אליכם עם ההצעה המשתלמת ביותר ב{meta.he} — בלי עלות ובלי התחייבות.
          </p>
          <div className="rounded-lp-card border border-lp-line bg-lp-surface p-5 shadow-lp-card">
            <LeadForm category={page.lead} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
