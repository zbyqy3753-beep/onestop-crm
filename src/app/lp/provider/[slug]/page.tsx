import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  basePackages,
  byCategory,
  CATEGORY_META,
  CATEGORY_ORDER,
  listable,
  providers,
  providerSlug,
} from "../../catalog/catalog";
import { GOOGLE_BUSINESS } from "../../config";
import { INDEXABLE, providerPath, SERVICE_PAGES, servicePath, SITE_ORIGIN } from "../../site";
import { CatalogBrowser } from "../../ui/CatalogBrowser";
import { LeadForm } from "../../ui/LeadForm";
import { ProviderLogo } from "../../ui/ProviderLogo";
import { SiteFooter } from "../../ui/SiteFooter";
import { SubpageHeader } from "../../ui/SubpageHeader";
import "../../lp.css";

/**
 * עמוד חברה באתר של אלירן — `/provider/cellcom` וכדומה.
 *
 * ⚠️ **קטלוג נפרד לכל קטגוריה, ולא רשימה מעורבת אחת.** `byPrice` מדרג
 * מסלול חשמל לפי אחוז ההנחה בסימן שלילי, כלומר ברשימה מעורבת של סלקום
 * שלוש הנחות חשמל היו עולות לראש לפני כל חבילת סלולר. זה הבאג שתוקן
 * באתר הציבורי (`ProviderPageBody` ב-`onestop-site`); כאן הוא נמנע
 * מראש בכך שאין רשימה מעורבת.
 */

export const dynamicParams = false;

function companyOf(slug: string) {
  return providers(basePackages()).find((p) => p.slug === slug);
}

export function generateStaticParams() {
  return providers(basePackages()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lp/provider/[slug]">): Promise<Metadata> {
  const company = companyOf((await params).slug);
  if (!company) return {};
  const cats = CATEGORY_ORDER.filter((c) => company.categories.includes(c))
    .map((c) => CATEGORY_META[c].he)
    .join(", ");
  return {
    title: `חבילות ${company.name} — השוואת מחירים | אלירן תקשורת`,
    description: `כל חבילות ${company.name} (${cats}) במקום אחד: מחיר, מפרט והמחיר אחרי תום ההטבה, מול שאר החברות. ייעוץ אישי ללא עלות.`,
    robots: INDEXABLE,
    alternates: { canonical: `${SITE_ORIGIN}${providerPath(company.slug)}` },
  };
}

export default async function ProviderPage({ params }: PageProps<"/lp/provider/[slug]">) {
  const company = companyOf((await params).slug);
  if (!company) notFound();

  const all = listable(basePackages());
  const own = all.filter((p) => providerSlug(p) === company.slug);
  const sections = CATEGORY_ORDER.map((c) => ({ category: c, packages: byCategory(own, c) })).filter(
    (s) => s.packages.length > 0,
  );
  if (sections.length === 0) notFound();

  // חברות אחרות באותן קטגוריות — למי שמשווה, הצעד הבא הוא המתחרה.
  const rivals = providers(all).filter(
    (p) => p.slug !== company.slug && p.categories.some((c) => company.categories.includes(c)),
  );
  const single = sections.length === 1 ? SERVICE_PAGES.find((s) => s.category === sections[0].category) : null;

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: GOOGLE_BUSINESS.name, item: `${SITE_ORIGIN}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: `חבילות ${company.name}`,
        item: `${SITE_ORIGIN}${providerPath(company.slug)}`,
      },
    ],
  };

  return (
    <main className="lp-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <SubpageHeader
        title={`חבילות ${company.name}`}
        blurb={`${sections.map((s) => CATEGORY_META[s.category].he).join(" · ")} — כל החבילות של ${company.name} שאני משווה, עם המחיר אחרי תום ההטבה.`}
      >
        <div className="mt-6 inline-flex rounded-lp-card bg-lp-surface p-3 shadow-lp-pop">
          <ProviderLogo logo={company.logo} name={company.name} size={40} />
        </div>
      </SubpageHeader>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {sections.length > 1 && (
          <nav aria-label="קטגוריות" className="mb-8 flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.category}
                href={`#${s.category}`}
                className="inline-flex items-center gap-2 rounded-full border border-lp-line bg-lp-surface px-4 py-2 text-sm font-medium text-lp-ink-2 transition hover:border-lp-brand"
              >
                {CATEGORY_META[s.category].he}
                <span className="nums text-xs opacity-70">{s.packages.length}</span>
              </a>
            ))}
          </nav>
        )}

        {sections.map((s) => (
          <section key={s.category} id={s.category} className="mb-12 scroll-mt-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-bold text-lp-ink">
                {CATEGORY_META[s.category].he} של {company.name}
              </h2>
              <a
                href={servicePath(s.category)}
                className="rounded-lg border border-lp-line bg-lp-surface px-4 py-2 text-sm font-medium text-lp-brand transition hover:border-lp-brand"
              >
                להשוואה מול כל החברות ←
              </a>
            </div>
            <CatalogBrowser packages={s.packages} category={s.category} />
          </section>
        ))}

        {rivals.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-bold text-lp-ink">להשוות מול חברה אחרת</h2>
            <ul className="flex flex-wrap gap-2">
              {rivals.map((p) => (
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
          </section>
        )}
      </div>

      <section id="lead" className="border-t border-lp-line bg-lp-surface">
        <div className="mx-auto max-w-2xl px-4 py-14">
          <h2 className="text-xl font-bold text-lp-ink">רוצים חבילה של {company.name}?</h2>
          <p className="mt-2 mb-5 text-sm text-lp-ink-2">
            השאירו פרטים ואבדוק לכם את ההצעה המשתלמת ביותר — גם מול החברות האחרות. בלי עלות ובלי
            התחייבות.
          </p>
          <div className="rounded-lp-card border border-lp-line bg-lp-surface p-5 shadow-lp-card">
            <LeadForm category={single?.lead} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
