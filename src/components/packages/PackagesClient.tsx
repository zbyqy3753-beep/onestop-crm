"use client";

import { useMemo, useState } from "react";
import type {
  CategoryKey,
  LeadCategoryKey,
  LeadCostTable,
  Package,
  ProviderKey,
} from "@/lib/domain/types";
import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  COMMISSION_MULTIPLIER,
  PACKAGE_SPEC_FIELDS,
  PROVIDER_CONFIG,
  PROVIDER_ORDER,
} from "@/lib/domain/types";
import { PackagesTable } from "./PackagesTable";

/**
 * עלות ליד ממופתחת לפי קטגוריית ליד (`LeadCategoryKey`), לא קטגוריית
 * חבילה (`CategoryKey`) — שני enum-ים נפרדים (ראה types.ts). כדי להציג
 * "רווח" על כרטיס חבילה צריך למפות בין השניים; "סיבים" (אין ב-לידים)
 * נופל על "אינטרנט" כי זו טכנולוגיית האינטרנט הקרובה ביותר.
 */
const PACKAGE_TO_LEAD_CATEGORY: Record<CategoryKey, LeadCategoryKey> = {
  mobile: "mobile",
  internet: "internet",
  fiber: "internet",
  tv: "tv",
  triple: "triple",
  electricity: "electricity",
};
import { money, number } from "@/lib/format";
import {
  Button,
  EmptyState,
  ToastStack,
  inputClass,
  type Toast,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { LeadCostsModal } from "@/components/settings/LeadCostsModal";

/**
 * קטלוג החבילות.
 *
 * החבילות מקובצות לפי ספק ולא לפי קטגוריה, כי כך סוכן חושב בשיחה:
 * הוא כבר יודע מה הלקוח צריך, והשאלה היא אצל מי לסגור.
 */
export function PackagesClient({
  packages,
  leadCosts,
}: {
  packages: Package[];
  leadCosts: LeadCostTable;
}) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<ProviderKey | "all">("all");
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [costsOpen, setCostsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function notify(message: string, tone: Toast["tone"] = "good") {
    setToasts((t) => [...t, { id: Date.now(), message, tone }]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return packages.filter((p) => {
      if (provider !== "all" && p.provider !== provider) return false;
      if (category !== "all" && p.category !== category) return false;
      if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [packages, query, provider, category]);

  const grouped = useMemo(() => {
    return PROVIDER_ORDER.map((key) => ({
      provider: key,
      items: filtered.filter((p) => p.provider === key),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">חבילות</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {number(filtered.length)} חבילות · העמלה מחושבת במכפיל ×
            {COMMISSION_MULTIPLIER}
          </p>
          <p className="mt-0.5 text-xs text-ink-4">
            ⚠️ ערכי העמלה והרווח משוערים — לא אומתו מול נתוני עמלה אמיתיים.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-line p-0.5">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "cards" ? "bg-brand text-on-brand" : "text-ink-3 hover:bg-surface-2"
              }`}
            >
              כרטיסים
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "table" ? "bg-brand text-on-brand" : "text-ink-3 hover:bg-surface-2"
              }`}
            >
              טבלה
            </button>
          </div>

          <Button icon="admin" onClick={() => setCostsOpen(true)}>
            עלויות לידים
          </Button>
        </div>
      </header>

      {/* מסננים */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ink-4">
            <Icon name="search" size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש חבילה…"
            className={`${inputClass} ps-8`}
            aria-label="חיפוש חבילה"
          />
        </div>

        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderKey | "all")}
          className={`${inputClass} w-auto`}
          aria-label="סינון לפי ספק"
        >
          <option value="all">כל החברות</option>
          {PROVIDER_ORDER.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_CONFIG[p].label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey | "all")}
          className={`${inputClass} w-auto`}
          aria-label="סינון לפי קטגוריה"
        >
          <option value="all">כל הקטגוריות</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_CONFIG[c].label}
            </option>
          ))}
        </select>

        {(query || provider !== "all" || category !== "all") && (
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setProvider("all");
              setCategory("all");
            }}
          >
            ניקוי
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon="packages"
            title="לא נמצאו חבילות"
            body="נסה לשנות את החיפוש או להסיר את המסננים."
          />
        </div>
      ) : view === "table" ? (
        <PackagesTable
          packages={filtered}
          leadCosts={leadCosts}
          packageToLeadCategory={PACKAGE_TO_LEAD_CATEGORY}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ provider: key, items }) => (
            <section key={key}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: PROVIDER_CONFIG[key].accent }}
                />
                {PROVIDER_CONFIG[key].label}
                <span className="text-xs font-normal text-ink-4">
                  {number(items.length)} חבילות
                </span>
              </h2>

              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    leadCost={leadCosts[PACKAGE_TO_LEAD_CATEGORY[pkg.category]]}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <LeadCostsModal
        open={costsOpen}
        costs={leadCosts}
        onClose={() => setCostsOpen(false)}
        onNotify={notify}
      />

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
    </div>
  );
}

/**
 * כרטיס חבילה. מציג את המספר שסוכן באמת רוצה: הרווח נטו אחרי
 * המכפיל ואחרי עלות רכישת הליד — ולא רק את עמלת הבסיס.
 */
function PackageCard({ pkg, leadCost }: { pkg: Package; leadCost: number }) {
  const payable = pkg.commission * COMMISSION_MULTIPLIER;
  const profit = payable - leadCost;
  const isElectricity = pkg.price === null;

  // שדות ה-spec שיש להם ערך בפועל, לפי הקונפיג הרשמי של הקטגוריה — כך
  // הכרטיס לא מניח צורה קבועה אלא מציג בדיוק את מה שקיים בשורה הזו.
  const specFields = PACKAGE_SPEC_FIELDS[pkg.category].filter((f) => {
    const v = pkg.spec[f.key];
    if (isElectricity && f.key === "discountPercent") return false; // כבר מוצג למעלה כתקציר
    return v !== undefined && v !== "" && v !== false;
  });

  return (
    <article
      className="spine rounded-card border border-line bg-surface p-3.5 ps-4 transition-shadow hover:shadow-card"
      style={
        {
          "--spine-c": PROVIDER_CONFIG[pkg.provider].accent,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{pkg.name}</h3>
      </div>

      {pkg.description && (
        <p className="mt-1 text-xs text-ink-3">{pkg.description}</p>
      )}

      <p className="mt-1.5 text-xs text-ink-4">
        {CATEGORY_CONFIG[pkg.category].label}
      </p>

      {isElectricity && (
        <div className="mt-2.5 rounded-md bg-surface-2 px-2.5 py-2 text-center">
          <p className="text-[11px] text-ink-4">אחוז הנחה</p>
          <p className="nums text-lg font-bold text-good">
            {String(pkg.spec.discountPercent ?? "—")}
          </p>
        </div>
      )}

      <dl
        className={`mt-3 grid gap-2 border-t border-line pt-2.5 text-center ${
          isElectricity ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {!isElectricity && (
          <div>
            <dt className="text-[11px] text-ink-4">ללקוח</dt>
            <dd className="nums mt-0.5 text-sm font-semibold">
              {pkg.price === 0 ? "חינם" : money(pkg.price as number)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] text-ink-4">עמלה</dt>
          <dd className="nums mt-0.5 text-sm font-semibold text-ink-1">
            {money(payable)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-4">רווח</dt>
          <dd
            className={`nums mt-0.5 text-sm font-bold ${
              profit >= 0 ? "text-good" : "text-bad"
            }`}
          >
            {money(profit)}
          </dd>
        </div>
      </dl>

      {/* ⚠️ העמלה מסונתזת (מחיר × מכפיל קבוע) — לא קיימת בקטלוג האמיתי
          ולא אומתה מול נתוני עמלה אמיתיים. ראה catalog.ts / types.ts. */}
      <p className="mt-1 text-center text-[10px] text-ink-4">עמלה משוערת · לא מאומתת</p>

      {specFields.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs">
          {specFields.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-[11px] text-ink-4">{f.label}</dt>
              <dd className="truncate text-ink-2" title={String(pkg.spec[f.key])}>
                {String(pkg.spec[f.key])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

