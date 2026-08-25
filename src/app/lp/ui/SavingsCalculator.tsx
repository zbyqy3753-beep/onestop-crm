"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { LeadForm } from "./LeadForm";
import { shekels } from "../catalog/format";
import type { Package } from "../catalog/types";

type Track = "cellular" | "home";

/**
 * "What do you pay today?" — the reverse of a filter grid, and the highest
 * converting pattern on the competing sites. Two differences here:
 *
 *  1. The result is computed against the real catalogue, never a made-up
 *     percentage — but the headline is the SAVING, not the package behind it.
 *     Naming the package turns the answer into a price list; "how much you
 *     keep" is what the visitor came for, and the package itself is the sales
 *     conversation the lead is supposed to start.
 *  2. The saving is shown BEFORE the phone number is requested. Asking for a
 *     phone to reveal a figure we already know is what makes these calculators
 *     feel like a trap.
 */
export function SavingsCalculator({ packages }: { packages: Package[] }) {
  const [step, setStep] = useState(0);
  const [track, setTrack] = useState<Track>("cellular");
  const [spend, setSpend] = useState("");
  const [units, setUnits] = useState(1);

  const monthlySpend = Number(spend.replace(/[^\d.]/g, "")) || 0;

  const cheapest = useMemo(() => {
    const pool = packages.filter(
      (p) => p.category === track && p.priceModel === "monthly" && p.price != null,
    );
    return pool.reduce<Package | null>(
      (best, p) => (best == null || (p as { price: number }).price < (best as { price: number }).price ? p : best),
      null,
    );
  }, [packages, track]);

  const cheapestPrice = cheapest && cheapest.priceModel === "monthly" ? (cheapest.price ?? 0) : 0;
  // Cellular is priced per line; a home package is one household bill.
  const newMonthly = track === "cellular" ? cheapestPrice * units : cheapestPrice;
  const monthlySaving = monthlySpend - newMonthly;
  /*
   * ⚠️ מעוגל לשקל.
   *
   * חבילה במחיר 21.9 ₪ כפול שלושה קווים מייצרת "חיסכון של ₪1,851.6
   * בשנה" — והאגורות האלה הן בדיוק מה שגורם למספר להיראות מומצא.
   * מאז שהמספר הזה הוא הכותרת של המסך, העיגול חשוב כפליים.
   */
  const yearlySaving = Math.round(monthlySaving * 12);
  const worthwhile = monthlySpend > 0 && monthlySaving > 0;

  const unitLabel = track === "cellular" ? "קווים" : "בתי אב";

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-lp-brand" : "bg-lp-surface-3"}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {step === 0 && (
        <div>
          <h3 className="text-lg font-bold text-lp-ink">על מה תרצו לחסוך?</h3>
          <p className="mt-1 text-sm text-lp-ink-2">נשווה מול הקטלוג המלא שלנו ונראה לכם כמה אפשר לחסוך.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["cellular", "סלולר", "חבילות לכל הקווים במשפחה"],
                ["home", "אינטרנט וטלוויזיה", "סיבים, טריפל וטלוויזיה"],
              ] as const
            ).map(([key, title, sub]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTrack(key);
                  setStep(1);
                }}
                className="rounded-lp-card border border-lp-line p-4 text-start transition hover:border-lp-brand hover:bg-lp-brand/5"
              >
                <span className="block font-semibold text-lp-ink">{title}</span>
                <span className="mt-0.5 block text-xs text-lp-ink-3">{sub}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-lp-ink-3">
            מחפשים הנחה בחשמל? הלשונית &quot;חשמל&quot; למעלה מציגה את כל המסלולים.
          </p>
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 className="text-lg font-bold text-lp-ink">כמה אתם משלמים היום?</h3>
          <p className="mt-1 text-sm text-lp-ink-2">הסכום החודשי הכולל שאתם משלמים כרגע.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-lp-ink-2" htmlFor="calc-spend">
                תשלום חודשי כולל (₪)
              </label>
              <input
                id="calc-spend"
                value={spend}
                onChange={(e) => setSpend(e.target.value)}
                inputMode="numeric"
                placeholder="למשל 220"
                className="nums w-full rounded-lg border border-lp-line px-3 py-2.5 text-lg transition focus:border-lp-brand"
              />
            </div>
            {track === "cellular" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-lp-ink-2" htmlFor="calc-units">
                  כמה {unitLabel}?
                </label>
                <select
                  id="calc-units"
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value))}
                  className="w-full rounded-lg border border-lp-line px-3 py-3 transition focus:border-lp-brand"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n === 6 ? "6 ומעלה" : n}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-lg border border-lp-line px-4 py-2.5 text-sm text-lp-ink-2 hover:border-lp-brand"
            >
              חזרה
            </button>
            <button
              type="button"
              disabled={monthlySpend <= 0}
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg bg-lp-brand px-4 py-2.5 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright disabled:opacity-40"
            >
              חשבו לי את החיסכון
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {worthwhile ? (
            <>
              <p className="text-sm text-lp-ink-2">
                אתם משלמים <span className="nums font-semibold text-lp-ink">{shekels(monthlySpend)}</span> בחודש.
              </p>
              <p className="mt-1 text-sm font-semibold text-lp-ink">אפשר לחסוך עד</p>
              <p className="nums mt-1 text-4xl font-extrabold leading-none text-lp-save sm:text-5xl">
                {shekels(yearlySaving)}
              </p>
              <p className="mt-1.5 text-sm text-lp-ink-2">
                בשנה —{" "}
                <span className="nums font-semibold text-lp-ink">{shekels(Math.round(monthlySaving))}</span>{" "}
                כל חודש שנשאר אצלכם.
              </p>

              <p className="mt-4 text-xs leading-relaxed text-lp-ink-3">
                החישוב מבוסס על החבילה המשתלמת ביותר בקטלוג שלנו בקטגוריה הזו
                {track === "cellular" && units > 1 ? `, לפי ${units} ${unitLabel}` : ""}. הסכום המדויק
                תלוי בזמינות, בתנאי החברה ובמה שכלול היום בחשבון שלכם — נציג יעבור אתכם על החשבון
                ויגיד לכם בדיוק כמה תחסכו.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-lp-ink">אתם כבר משלמים מעט יחסית</p>
              <p className="mt-1 text-sm text-lp-ink-2">
                לפי הסכום שהזנתם לא נוכל להבטיח חיסכון בתשלום החודשי. עדיין שווה בדיקה — לפעמים
                ההבדל הוא במה שכלול, או במחיר שיקפוץ בתום ההטבה הנוכחית שלכם.
              </p>
            </>
          )}

          <div className="mt-5 rounded-lp-card bg-lp-surface-2 p-4">
            <p className="mb-3 text-sm font-semibold text-lp-ink">
              רוצים שנבדוק את החשבון שלכם לעומק?
            </p>
            <LeadForm
              compact
              category={track === "cellular" ? "mobile" : "internet"}
              note={[
                `מהמחשבון: משלם היום ${shekels(monthlySpend)} בחודש`,
                track === "cellular" ? `${units} ${unitLabel}` : "אינטרנט וטלוויזיה",
                worthwhile ? `חיסכון פוטנציאלי ${shekels(yearlySaving)} בשנה` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-3 text-xs text-lp-ink-3 hover:underline"
          >
            לשנות את הנתונים
          </button>
        </div>
      )}
    </Card>
  );
}
