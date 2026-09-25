"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderLogo } from "./ProviderLogo";
import { cardStats, detailRows, shekels } from "../catalog/format";
import type { Package } from "../catalog/types";

/**
 * A sticky tray that fills as you tick packages, then opens a side-by-side
 * sheet. Comparison only becomes useful at two items, so the button stays
 * disabled until then rather than opening an empty table.
 */
export function CompareTray({
  items,
  onRemove,
  onClear,
  max,
}: {
  items: Package[];
  onRemove: (pkg: Package) => void;
  onClear: () => void;
  max: number;
}) {
  const [open, setOpen] = useState(false);

  /*
   * ⚠️ `role="dialog" aria-modal="true"` הצהיר על חלון מודאלי שלא
   * התנהג כמודאלי: הפוקוס נשאר על כפתור "השוו" מאחורי הכיסוי, Tab
   * טייל בקטלוג שמתחת לאוברליי, ו-Escape לא עשה כלום — הסגירה היחידה
   * הייתה לחיצת עכבר. ההצהרה בלי ההתנהגות גרועה מכלום: קורא מסך
   * הבטיח למשתמש שהוא נמצא בחלון סגור.
   *
   * הפוקוס גם **חוזר** לכפתור שפתח: סגירה שמשאירה את הפוקוס על
   * `<body>` מחזירה את משתמש המקלדת לראש הדף, אחרי כל הקטלוג.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      // מלכודת הפוקוס: רק מה שבאמת ניתן למיקוד ונראה על המסך.
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-lp-line bg-lp-surface/95 backdrop-blur">
        {/*
          ⚠️ בנייד השבבים יורדים לשורה משלהם (`order-last w-full`)
          ונגללים אופקית במקום להישבר לשורות. עם עטיפה וארבע
          חבילות הסרגל הגיע ל-249px — שליש ממסך של אייפון, על סרגל
          שמרחף מעל הקטלוג. מ-`sm` ומעלה ההתנהגות המקורית חוזרת.
        */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="flex-1 text-sm font-medium text-lp-ink sm:flex-none">
            להשוואה ({items.length}/{max})
          </span>
          <ul className="order-last flex w-full flex-nowrap gap-2 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible">
            {items.map((p) => (
              <li key={p.id} className="flex shrink-0 items-center gap-1 rounded-full bg-lp-surface-2 px-3 py-1 text-xs">
                <span className="max-w-[10rem] truncate text-lp-ink">{p.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  aria-label={`הסר את ${p.name} מההשוואה`}
                  className="-my-1 inline-flex min-h-9 min-w-9 items-center justify-center text-lp-ink-3 hover:text-lp-rise"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onClear} className="-mx-2 inline-flex min-h-11 items-center px-2 text-xs text-lp-ink-3 hover:underline">
            נקה
          </button>
          <button
            type="button"
            onClick={(e) => {
              openerRef.current = e.currentTarget;
              setOpen(true);
            }}
            disabled={items.length < 2}
            className="inline-flex min-h-11 items-center rounded-lg bg-lp-brand px-4 py-2 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright disabled:opacity-40"
          >
            {items.length < 2 ? "בחרו עוד חבילה" : "השוו"}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-lp-navy/60 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="השוואת חבילות"
          onClick={close}
        >
          <div
            ref={panelRef}
            /* יעד הפוקוס בפתיחה — הכותרת נקראת, ומכאן Tab מתחיל בתוך החלון. */
            tabIndex={-1}
            className="animate-lp-rise max-h-[90dvh] w-full max-w-4xl overflow-auto rounded-t-lp-card bg-lp-surface p-5 shadow-lp-pop sm:rounded-lp-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-lp-ink">השוואת חבילות</h2>
              <button
                type="button"
                onClick={close}
                /* בלי זה קורא מסך הכריז "לחצן, ✕". */
                aria-label="סגירת ההשוואה"
                className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center text-2xl leading-none text-lp-ink-3"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-sm sm:min-w-[32rem]">
                <thead>
                  <tr>
                    <th className="w-20 sm:w-28" />
                    {items.map((p) => (
                      <th key={p.id} className="border-b border-lp-line p-2 text-start align-bottom">
                        <ProviderLogo logo={p.provider.logo} name={p.provider.name} size={26} />
                        <div className="mt-1 text-xs font-semibold text-lp-ink">{p.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row label="מחיר לחודש">
                    {items.map((p) => (
                      <Cell key={p.id}>
                        {p.category === "electricity"
                          ? `${p.discountPercent}% הנחה`
                          : p.price != null
                            ? shekels(p.price)
                            : "—"}
                      </Cell>
                    ))}
                  </Row>
                  <Row label="אחרי ההטבה">
                    {items.map((p) => (
                      <Cell key={p.id} tone={p.category !== "electricity" && p.priceAfterPromo ? "rise" : undefined}>
                        {p.category === "electricity"
                          ? "—"
                          : p.priceAfterPromo != null
                            ? shekels(p.priceAfterPromo)
                            : "לא דווח שינוי"}
                      </Cell>
                    ))}
                  </Row>
                  {statRows(items).map((row) => (
                    <Row key={`stat-${row.label}`} label={row.label}>
                      {row.values.map((v, i) => (
                        <Cell key={items[i].id}>{v}</Cell>
                      ))}
                    </Row>
                  ))}
                  {detailOnlyRows(items).map((row) => (
                    <Row key={`detail-${row.label}`} label={row.label}>
                      {row.values.map((v, i) => (
                        <Cell key={items[i].id}>{v}</Cell>
                      ))}
                    </Row>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface CompareRow {
  label: string;
  values: string[];
}

/**
 * The headline figures, aligned across the compared packages.
 *
 * ⚠️ היישור הוא לפי ה-`caption`, לא לפי מיקום. `cardStats` דוחף רק שדות
 * שקיימים, ולכן אותו אינדקס מייצג נתון אחר בכל חבילה: השוואה בין חבילה
 * עם גלישה+דקות+SMS לחבילה כשרה (דקות+SMS בלבד) הציגה את **דקות** השיחה
 * של הכשרה תחת הכותרת "גלישה בישראל", ובשורת הדקות סימנה לה "—" — כלומר
 * טענה שאין לה דקות בכלל. טבלה שכל תפקידה להשוות הציגה מספר של נתון אחד
 * תחת שמו של נתון אחר.
 */
function statRows(items: Package[]): CompareRow[] {
  const captions: string[] = [];
  for (const p of items) {
    for (const s of cardStats(p)) if (!captions.includes(s.caption)) captions.push(s.caption);
  }
  return captions.map((label) => ({
    label,
    values: items.map((p) => cardStats(p).find((s) => s.caption === label)?.value ?? "—"),
  }));
}

/**
 * Detail rows minus anything the stats already say. "מהירות גלישה" and
 * "מהירות (הורדה/העלאה)" are different labels for the same numbers, so we drop
 * the duplicate by comparing rendered values rather than maintaining a list of
 * synonymous labels.
 */
function detailOnlyRows(items: Package[]): CompareRow[] {
  // ⚠️ ההשוואה היא מול שורות הסטטיסטיקה **בלבד**. קודם כל שורת פירוט
  // שנכתבה נוספה גם היא ל-`shown`, ולכן שתי שורות פירוט שונות לגמרי
  // שבמקרה נשאו אותם ערכים הפילו זו את זו: "דמי חיבור" מחקה את
  // "דמי מעבר" כשלשתיהן היו אותם שני ערכים, והגולש תימחר עלות
  // חד-פעמית בחסר. המטרה המקורית הייתה לוותר על שם נרדף לנתון
  // שכבר מופיע למעלה, לא לאחד שני נתונים שונים.
  const shown = new Set(statRows(items).map((r) => r.values.join(" ")));
  const labels = new Set<string>();
  for (const p of items) for (const r of detailRows(p)) labels.add(r.label);

  const rows: CompareRow[] = [];
  for (const label of labels) {
    const values = items.map((p) => detailRows(p).find((r) => r.label === label)?.value ?? "—");
    const key = values.join(" ");
    if (shown.has(key)) continue;
    rows.push({ label, values });
  }
  return rows;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="even:bg-lp-surface-2">
      <th scope="row" className="p-2 text-start align-top text-xs font-medium text-lp-ink-3">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children, tone }: { children: React.ReactNode; tone?: "rise" }) {
  return (
    <td className={`nums p-2 align-top text-sm ${tone === "rise" ? "text-lp-rise" : "text-lp-ink"}`}>{children}</td>
  );
}
