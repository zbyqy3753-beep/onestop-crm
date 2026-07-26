"use client";

import { useEffect, useState } from "react";
import {
  LIVE_DASHBOARD_SNAPSHOT,
  SNAPSHOT_GENERATED_AT,
  type LiveDashboardCategory,
} from "@/lib/domain/live-dashboard";
import { number, relative } from "@/lib/format";
import { useNow } from "@/lib/clock";

const TICK_INTERVAL_MS = 4000;

/**
 * דשבורד עסקאות LIVE — ווידג'ט "פעימת שוק" קוסמטי, לא מבוסס על
 * נתוני הארגון (ראה `live-dashboard.ts`). מציג תג LIVE, חותמת
 * רעננות, ופירוט קטגוריה → חברה עם ספירות היום/החודש.
 *
 * הטיק הקוסמטי (הגדלה מדורגת של מספר אקראי) מופעל רק אחרי mount,
 * דרך useEffect שמחכה ל-`useNow() !== null` — כך שהוא לעולם לא
 * נוגע במספרים שהשרת רינדר, ולא נוצרת שגיאת הידרציה.
 */
export function LiveDashboardClient() {
  const now = useNow();
  const [snapshot, setSnapshot] = useState<LiveDashboardCategory[]>(
    LIVE_DASHBOARD_SNAPSHOT,
  );

  useEffect(() => {
    if (now === null) return;
    const timer = setInterval(() => {
      setSnapshot((prev) => bumpRandomCompany(prev));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [now]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">
            דשבורד עסקאות
          </h1>
          <p className="mt-0.5 text-sm text-ink-3">
            פעימת שוק חוצה-ספקים — תצוגה מדומה, לא מבוססת על נתוני הארגון
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-bad opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-bad" />
          </span>
          <span className="text-xs font-bold tracking-wide text-bad">LIVE</span>
          <span className="text-xs text-ink-4">
            {now === null
              ? "טוען…"
              : `עודכן ${relative(new Date(SNAPSHOT_GENERATED_AT).toISOString(), now)}`}
          </span>
        </div>
      </header>

      <div className="space-y-5">
        {snapshot.map((category) => (
          <CategorySection key={category.key} category={category} />
        ))}
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: LiveDashboardCategory }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
        <h2 className="font-display text-lg font-bold">{category.label}</h2>
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="text-ink-4">היום </span>
            <span className="nums font-semibold text-brand">
              {number(category.today)}
            </span>
          </span>
          <span>
            <span className="text-ink-4">החודש </span>
            <span className="nums font-semibold">{number(category.month)}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {category.companies.map((company) => (
          <div
            key={company.name}
            className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-sm"
          >
            <span className="font-medium">{company.name}</span>
            <span className="nums text-ink-3">
              <span className="font-semibold text-ink-1">{number(company.today)}</span>
              {" / "}
              {number(company.month)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * מגדיל בעדינות מונה של חברה אחת אקראית — מדמה עסקה חדשה שנכנסת.
 * `Math.random` מותר כאן (בניגוד ל-`live-dashboard.ts`) כי זה קורה
 * אך ורק בתוך אפקט שמופעל אחרי mount, על מצב קליינט טהור.
 */
function bumpRandomCompany(
  categories: LiveDashboardCategory[],
): LiveDashboardCategory[] {
  const catIndex = Math.floor(Math.random() * categories.length);

  return categories.map((cat, ci) => {
    if (ci !== catIndex) return cat;

    const companyIndex = Math.floor(Math.random() * cat.companies.length);
    const companies = cat.companies.map((company, wi) =>
      wi === companyIndex
        ? { ...company, today: company.today + 1, month: company.month + 1 }
        : company,
    );

    return {
      ...cat,
      companies,
      today: cat.today + 1,
      month: cat.month + 1,
    };
  });
}
