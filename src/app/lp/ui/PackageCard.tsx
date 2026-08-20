"use client";

import { useState } from "react";
import { Card } from "./Card";
import { ProviderLogo } from "./ProviderLogo";
import { LeadForm } from "./LeadForm";
import { cardStats, detailRows, shekels } from "../catalog/format";
import type { Package } from "../catalog/types";

/*
 * ⚠️ שני דברים ירדו מהעותק של האתר הציבורי, ושניהם לא "ניקוי":
 *
 * 1. `<Link href={`/p/${pkg.slug}`}>` על שם החבילה. עמודי החבילה
 *    (`/p/[slug]`) קיימים רק באתר הציבורי; כאן הם 404. שם החבילה נשאר
 *    טקסט — "פרטים מלאים" למטה כבר פותח את מה שהקישור היה מראה.
 * 2. כפתור הוואטסאפ, שנשען על `ContactProvider` עם המספר של המוקד.
 *    לדף הזה אין מספר מוגדר, וכפתור שמוביל למספר שגוי גרוע מכפתור
 *    שאינו קיים. הליד נשאר הערוץ היחיד — וזה גם מה שמבטיח שכל פנייה
 *    מהדף מגיעה לאלירן ולא לתיבה כללית.
 */

interface Props {
  pkg: Package;
  compareChecked?: boolean;
  onCompareToggle?: (pkg: Package) => void;
  /** Detail pages already show everything, so they render the card expanded. */
  defaultOpen?: boolean;
}

export function PackageCard({ pkg, compareChecked, onCompareToggle, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [formOpen, setFormOpen] = useState(false);

  const stats = cardStats(pkg);
  const rows = detailRows(pkg);
  const isElectric = pkg.category === "electricity";

  // The whole point of the site: when the price jumps after the promo, say so
  // on the card rather than in the small print.
  const rise = !isElectric && pkg.priceAfterPromo != null ? pkg.priceAfterPromo : null;
  const riseNote = !isElectric ? pkg.priceAfterPromoNote : null;

  return (
    <Card as="article" interactive className="flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-lp-line p-4">
        <ProviderLogo logo={pkg.provider.logo} name={pkg.provider.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {pkg.recommended && (
              <span className="rounded-full bg-lp-brand/10 px-2 py-0.5 text-lp-2xs font-semibold text-lp-brand">
                מומלץ
              </span>
            )}
            {pkg.badges.map((b) => (
              <span key={b} className="rounded-full bg-lp-surface-3 px-2 py-0.5 text-lp-2xs font-medium text-lp-ink-2">
                {b}
              </span>
            ))}
            {pkg.type && !pkg.badges.includes(pkg.type) && (
              <span className="rounded-full bg-lp-surface-3 px-2 py-0.5 text-lp-2xs font-medium text-lp-ink-2">
                {pkg.type}
              </span>
            )}
          </div>
          <h3 className="text-sm leading-snug font-semibold text-lp-ink">{pkg.name}</h3>
          <p className="text-xs text-lp-ink-3">{pkg.provider.name}</p>
        </div>

        {onCompareToggle && (
          <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1 text-lp-2xs text-lp-ink-3">
            <input
              type="checkbox"
              checked={!!compareChecked}
              onChange={() => onCompareToggle(pkg)}
              className="h-4 w-4 accent-lp-brand"
              aria-label={`הוסף את ${pkg.name} להשוואה`}
            />
            השוואה
          </label>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {stats.length > 0 && (
          <ul className="mb-4 grid grid-cols-3 gap-2 text-center">
            {stats.map((s) => (
              <li key={s.caption} className="rounded-lg bg-lp-surface-2 px-1 py-2">
                <div className="nums text-sm font-bold text-lp-ink">{s.value}</div>
                <div className="mt-0.5 text-lp-2xs leading-tight text-lp-ink-3">{s.caption}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto">
          <div className="flex items-end justify-between gap-2">
            {isElectric ? (
              <div>
                <span className="nums text-3xl font-extrabold text-lp-ink">{pkg.discountPercent}%</span>
                <span className="ms-1 text-sm text-lp-ink-2">הנחה</span>
              </div>
            ) : (
              <div>
                <span className="nums text-3xl font-extrabold text-lp-ink">
                  {pkg.price != null ? shekels(pkg.price) : "—"}
                </span>
                <span className="ms-1 text-sm text-lp-ink-2">לחודש</span>
              </div>
            )}
          </div>

          {rise != null && (
            <p className="mt-2 rounded-lg bg-lp-rise-soft px-3 py-2 text-xs text-lp-rise">
              <span className="font-semibold">אחרי תום ההטבה: {shekels(rise)} לחודש</span>
            </p>
          )}
          {rise == null && riseNote && (
            <p className="crm-text mt-2 rounded-lg bg-lp-surface-2 px-3 py-2 text-xs text-lp-ink-2">
              <span className="font-semibold">בתום ההטבה:</span> {riseNote}
            </p>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            className="w-full rounded-lg bg-lp-brand px-3 py-2.5 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright"
          >
            {formOpen ? "סגירה" : "שיחזרו אליי"}
          </button>
        </div>

        {formOpen && (
          <div className="animate-lp-rise mt-3 rounded-lp-card bg-lp-surface-2 p-3">
            <LeadForm pkg={pkg} compact />
          </div>
        )}

        {(rows.length > 0 || pkg.description) && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-3 self-start text-xs font-medium text-lp-brand hover:underline"
            >
              {open ? "פחות פרטים ▴" : "פרטים מלאים ▾"}
            </button>

            {open && (
              <div className="animate-lp-rise mt-3 space-y-3 border-t border-lp-line pt-3">
                {rows.length > 0 && (
                  <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                    {rows.map((r) => (
                      <div key={r.label} className="flex justify-between gap-2 border-b border-lp-line/60 pb-1">
                        <dt className="text-lp-ink-3">{r.label}</dt>
                        <dd className="nums text-end font-medium text-lp-ink">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {pkg.description && (
                  <div className="crm-text text-xs leading-relaxed text-lp-ink-2">{pkg.description}</div>
                )}
                {pkg.benefits && (
                  <div className="rounded-lg bg-lp-brand/5 p-3">
                    <p className="mb-1 text-xs font-semibold text-lp-brand">הטבות</p>
                    <div className="crm-text text-xs leading-relaxed text-lp-ink-2">{pkg.benefits}</div>
                  </div>
                )}
                <p className="text-lp-2xs text-lp-ink-3">
                  התנאים המחייבים הם אלה של {pkg.provider.name}. ייתכנו שינויים ותנאי סף.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
