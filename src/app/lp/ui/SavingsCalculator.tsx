"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { LeadForm } from "./LeadForm";
import { shekels } from "../catalog/format";
import { afterPrice } from "../catalog/catalog";
import type { CellularSpec, HomeSpec, MonthlyPackage, Package } from "../catalog/types";

type Track = "cellular" | "home";

/**
 * חבילה שהמבקר במסלול הזה באמת יכול לעבור אליה.
 *
 * ⚠️ הפילטר הזה הוא מה שמפריד בין "עד כמה אפשר לחסוך" לבין מספר
 * מומצא. בלעדיו הזולה ביותר ב-`home` היא **קו טלפון של בזק ל-50 דקות**
 * (19.9 ₪) — כלומר מי שמשלם 220 ₪ על טריפל קיבל כותרת של ₪2,401
 * חיסכון מול מוצר שאינו אינטרנט ואינו טלוויזיה. באותו אופן 6 מתוך 8
 * החבילות הזולות בסלולר הן כשר או DATA ONLY, שאינן תחליף לקו רגיל.
 *
 * `price > 0` נבדק כאן ולא נשען על `listable()` של הקורא: בקטלוג יש
 * חבילות שמתומחרות לחבילה שלמה (`3 קווים ב99`) ורשומות כ-0, ומחיר 0
 * מייצר "חיסכון" של מלוא החשבון.
 */
function isComparable(p: Package, track: Track): p is MonthlyPackage {
  if (p.category !== track || p.priceModel !== "monthly") return false;
  if (p.price == null || p.price <= 0) return false;
  if (p.editorial?.hidden) return false;

  if (track === "cellular") {
    const spec = p.spec as CellularSpec;
    return !spec.kosher && (spec.unlimitedData || (spec.dataGb ?? 0) > 0) && (spec.minutes ?? 0) >= 1000;
  }
  // מסלול הבית הוא חשבון האינטרנט של משק הבית; חבילת TV בלבד או קו
  // טלפון בלבד אינם ההוצאה שהמבקר הזין.
  return (p.spec as HomeSpec).hasInternet;
}

/**
 * המחיר לקו **שנשאר אחרי שההטבה נגמרת**.
 *
 * ⚠️ זה הלב של התיקון. `price` לבדו הוא מחיר ההטבה: HOT Synergy עולה
 * 21.9 ₪ והופך ל-57.9 ₪ בתום שנה — פי 2.64. כותרת שנתית שנבנתה על
 * 21.9 מנפחת את החיסכון פי 3.3, וגרוע מכך היא סותרת את ההבטחה של
 * הדף עצמו ("כולל המחיר אחרי תום ההטבה"). `afterPrice` כבר מחזירה את
 * המחיר הקבוע, וזה המספר היחיד שאפשר לעמוד מאחוריו לשנה שלמה.
 *
 * מדרגות הקווים מתומחרות על בסיס ההטבה, ולכן הן נלקחות בחשבון רק
 * כשהחבילה לא הצהירה על עלייה — אחרת היינו מערבבים מחיר מבצע לקו עם
 * מחיר קבוע ומקבלים סכום שאינו נכון באף נקודת זמן.
 */
/** התקרה שהמחשבון מוכן להתייחס אליה כחשבון חודשי אמיתי. */
const MAX_SPEND = 5000;

/**
 * קריאת הסכום שהמבקר הקליד.
 *
 * ⚠️ `\d` בלי הדגל `u` לא תופס ספרות ערביות-הודיות, ומקלדת ערבית בנייד
 * הייתה מרוקנת את המחרוזת ומשאירה את הכפתור מושבת בלי הסבר. לכן
 * הספרות מנורמלות ל-ASCII לפני הניקוי, ורק הנקודה העשרונית הראשונה
 * נשמרת כדי ש-"1.2.3" לא ייפול ל-NaN.
 */
function parseSpend(raw: string): number {
  const ascii = raw.replace(/[٠-٩۰-۹]/g, (d) =>
    String((d.codePointAt(0)! - 0x0660) % 16),
  );
  const cleaned = ascii.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  const value = Number(rest.length ? `${whole}.${rest.join("")}` : whole);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, MAX_SPEND);
}

function perLinePrice(p: MonthlyPackage, lines: number): number {
  const base = afterPrice(p);
  if (p.priceAfterPromo != null) return base;
  const tiers = (p.spec as CellularSpec).lineTiers;
  if (!tiers?.length) return base;
  const tier = tiers.filter((t) => t.lines <= lines).sort((a, b) => b.lines - a.lines)[0];
  return tier ? Math.min(tier.price, base) : base;
}

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

  const monthlySpend = parseSpend(spend);

  const cheapest = useMemo(() => {
    const pool = packages.filter((p): p is MonthlyPackage => isComparable(p, track));
    return pool.reduce<MonthlyPackage | null>(
      (best, p) => (best == null || perLinePrice(p, units) < perLinePrice(best, units) ? p : best),
      null,
    );
  }, [packages, track, units]);

  const perLine = cheapest ? perLinePrice(cheapest, units) : 0;
  // Cellular is priced per line; a home package is one household bill.
  const newMonthly = track === "cellular" ? perLine * units : perLine;
  /*
   * ⚠️ מעוגל פעם אחת, והשנה נגזרת ממנו.
   *
   * חבילה במחיר 29.9 ₪ כפול שלושה קווים מייצרת "חיסכון של ₪1,563.6
   * בשנה" — והאגורות האלה הן בדיוק מה שגורם למספר להיראות מומצא.
   * חשוב מזה: עיגול נפרד לחודש ולשנה הציג שני מספרים שסותרים זה את זה
   * על אותו מסך (₪154 בחודש לצד ₪1,852 בשנה, כשהמכפלה היא 1,848).
   * לכן מעגלים את החודש ומכפילים — שתי השורות תמיד מסתדרות.
   */
  const monthlySaving = cheapest ? Math.round(monthlySpend - newMonthly) : 0;
  const yearlySaving = monthlySaving * 12;
  const worthwhile = monthlySpend > 0 && monthlySaving > 0;

  const unitLabel = track === "cellular" ? "קווים" : "בתי אב";

  return (
    <Card className="p-5 sm:p-6">
      {/*
        ⚠️ הפס עצמו נשאר דקורטיבי, אבל הוא היה **כל** מה שסימן התקדמות:
        לקורא מסך המחשבון נראה כמסך אחד שמחליף תוכן בלי הסבר. השורה
        המוסתרת מכריזה על המעבר, ולכן חייבת לחיות מחוץ ל-`aria-hidden`.
      */}
      <div className="mb-5 flex items-center gap-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-lp-brand" : "bg-lp-surface-3"}`}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        שלב {step + 1} מתוך 3
      </p>

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
                inputMode="decimal"
                maxLength={6}
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
                  {/*
                    ⚠️ עד 10 ובלי "ומעלה". האפשרות הישנה הוצגה כ-"6 ומעלה"
                    אבל חושבה כ-6 בדיוק: משפחה עם 8 קווים קיבלה עלות חדשה
                    של 6 קווים מול חשבון של 8 — כלומר חיסכון מנופח — והנציג
                    קיבל בהערה מספר קווים שגוי.
                  */}
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex min-h-11 items-center rounded-lg border border-lp-line px-4 py-2.5 text-sm text-lp-ink-2 hover:border-lp-brand"
            >
              חזרה
            </button>
            <button
              type="button"
              disabled={monthlySpend <= 0}
              onClick={() => setStep(2)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-lp-brand px-4 py-2.5 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright disabled:opacity-40"
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
              <p className="nums mt-1 text-3xl font-extrabold break-words text-lp-save sm:text-5xl sm:leading-none">
                {shekels(yearlySaving)}
              </p>
              <p className="mt-1.5 text-sm text-lp-ink-2">
                בשנה —{" "}
                <span className="nums font-semibold text-lp-ink">{shekels(Math.round(monthlySaving))}</span>{" "}
                כל חודש שנשאר אצלכם.
              </p>

              <p className="mt-4 text-xs leading-relaxed text-lp-ink-3">
                החישוב מבוסס על החבילה המשתלמת ביותר בקטלוג שלנו בקטגוריה הזו
                {track === "cellular" && units > 1 ? `, לפי ${units} ${unitLabel}` : ""}, ולפי{" "}
                <strong className="font-semibold text-lp-ink-2">המחיר שנשאר גם אחרי תום ההטבה</strong> —
                ולא לפי מחיר מבצע שמסתיים. עלויות חד-פעמיות (מעבר, חיבור, התקנה) אינן נכללות, והסכום
                המדויק תלוי בזמינות, בתנאי החברה ובמה שכלול היום בחשבון שלכם — נציג יעבור אתכם על
                החשבון ויגיד לכם בדיוק כמה תחסכו.
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
                // ⚠️ גם המקרה השלילי נכתב במפורש. בלעדיו הנציג קיבל הערה
                // שנראית חתוכה ולא ידע אם המחשבון לא מצא חיסכון או שפשוט
                // לא רץ.
                worthwhile
                  ? `חיסכון פוטנציאלי ${shekels(yearlySaving)} בשנה`
                  : "המחשבון לא מצא חיסכון בתשלום החודשי",
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="-mx-1 mt-3 inline-flex min-h-11 items-center px-1 text-xs text-lp-ink-3 hover:underline"
          >
            לשנות את הנתונים
          </button>
        </div>
      )}
    </Card>
  );
}
