import Image from "next/image";
import { CATEGORY_META } from "../catalog/catalog";
import { SERVICE_PAGES } from "../site";

/**
 * הכותרת של עמודי התוכן (שירות וחברה) — גרסה מצומצמת של ההירו בעמוד
 * הבית: אותו לוגו, אותו נייבי, בלי תצלום ובלי פס מחיר.
 *
 * ⚠️ הלוגו מקשר ל-`/` ולא ל-`/lp`: בכתובת של אלירן `/` הוא עמוד הבית
 * (ראה `eliranSite` ב-`proxy.ts`), ו-`/lp` שם מפנה הלאה.
 */
export function SubpageHeader({
  title,
  blurb,
  active,
  children,
}: {
  title: string;
  blurb: string;
  /** ה-`slug` של עמוד השירות הנוכחי, להדגשה בתפריט. */
  active?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="bg-lp-navy-deep text-lp-on-navy">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/*
            ⚠️ `<a>` ולא `<Link>`: בכתובת של אלירן `/` הוא שכתוב של הפרוקסי
            ל-`/lp`, ובאפליקציה עצמה `/` הוא עמוד אחר (הפניה ל-`/leads`).
            ניווט צד-לקוח היה מבקש את ה-RSC של `/` של המערכת.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="flex items-center gap-2.5">
            <Image src="/brand/eliran/icon.png" alt="" width={36} height={36} className="size-9" />
            <span className="text-xl leading-none font-extrabold text-white">
              אלירן <span className="text-lp-brand-bright">תקשורת</span>
            </span>
          </a>
          <nav aria-label="שירותים">
            <ul className="flex flex-wrap gap-2 text-sm">
              {SERVICE_PAGES.map((s) => (
                <li key={s.slug}>
                  <a
                    href={`/${s.slug}`}
                    aria-current={s.slug === active ? "page" : undefined}
                    className={`inline-flex rounded-full px-3.5 py-1.5 font-semibold transition ${
                      s.slug === active
                        ? "bg-white text-lp-ink"
                        : "border border-white/30 text-white hover:bg-white/10"
                    }`}
                  >
                    {CATEGORY_META[s.category].he}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <h1 className="mt-9 text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/80">{blurb}</p>
        {children}
      </div>
    </header>
  );
}
