"use client";

import { Fragment, useState } from "react";
import type { CategoryKey, LeadCategoryKey, LeadCostTable, Package } from "@/lib/domain/types";
import {
  COMMISSION_MULTIPLIER,
  PACKAGE_SPEC_FIELDS,
  PROVIDER_CONFIG,
  CATEGORY_CONFIG,
} from "@/lib/domain/types";
import { money } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

/**
 * תצוגת טבלה שטוחה של חבילות (לא מקובצת לפי ספק — עמודת "ספק" נותנת
 * את אותו מידע בפחות גלילה כשהמשתמש כבר סינן). כל שורה ניתנת להרחבה
 * כדי לראות את כל שדות ה-spec, שמשתנים לפי קטגוריה (ר' PACKAGE_SPEC_FIELDS).
 */
export function PackagesTable({
  packages,
  leadCosts,
  packageToLeadCategory,
}: {
  packages: Package[];
  leadCosts: LeadCostTable;
  packageToLeadCategory: Record<CategoryKey, LeadCategoryKey>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-start text-xs text-ink-4">
            <th className="w-6 px-3 py-2.5" />
            <th className="px-2 py-2.5 text-start font-medium">ספק</th>
            <th className="px-2 py-2.5 text-start font-medium">חבילה</th>
            <th className="px-2 py-2.5 text-start font-medium">קטגוריה</th>
            <th className="px-2 py-2.5 text-end font-medium">ללקוח</th>
            <th className="px-2 py-2.5 text-end font-medium">
              עמלה
              <span className="ms-1 font-normal text-ink-4/70">(משוער)</span>
            </th>
            <th className="px-2 py-2.5 text-end font-medium">רווח</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => {
            const isOpen = expanded === pkg.id;
            const payable = pkg.commission * COMMISSION_MULTIPLIER;
            const leadCost = leadCosts[packageToLeadCategory[pkg.category]];
            const profit = payable - leadCost;
            const fields = PACKAGE_SPEC_FIELDS[pkg.category].filter(
              (f) => pkg.spec[f.key] !== undefined && pkg.spec[f.key] !== "" && pkg.spec[f.key] !== false,
            );

            return (
              <Fragment key={pkg.id}>
                <tr
                  onClick={() => setExpanded(isOpen ? null : pkg.id)}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="px-3 py-2 text-ink-4">
                    <span
                      className="inline-block transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                    >
                      <Icon name="chevronLeft" size={14} />
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: PROVIDER_CONFIG[pkg.provider].accent }}
                      />
                      {PROVIDER_CONFIG[pkg.provider].label}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium">{pkg.name}</td>
                  <td className="px-2 py-2 text-ink-3">{CATEGORY_CONFIG[pkg.category].label}</td>
                  <td className="nums px-2 py-2 text-end">
                    {pkg.price === null
                      ? String(pkg.spec.discountPercent ?? "—")
                      : pkg.price === 0
                        ? "חינם"
                        : money(pkg.price)}
                  </td>
                  <td className="nums px-2 py-2 text-end">{money(payable)}</td>
                  <td
                    className={`nums px-2 py-2 text-end font-semibold ${
                      profit >= 0 ? "text-good" : "text-bad"
                    }`}
                  >
                    {money(profit)}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-line/60 bg-surface-2/60">
                    <td colSpan={7} className="px-4 py-3">
                      {fields.length === 0 ? (
                        <p className="text-xs text-ink-4">אין פרטים נוספים לחבילה זו.</p>
                      ) : (
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                          {fields.map((f) => (
                            <div key={f.key} className="min-w-0">
                              <dt className="text-[11px] text-ink-4">{f.label}</dt>
                              <dd className="truncate text-xs text-ink-2" title={String(pkg.spec[f.key])}>
                                {String(pkg.spec[f.key])}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {pkg.description && (
                        <p className="mt-2 text-xs text-ink-3">{pkg.description}</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
