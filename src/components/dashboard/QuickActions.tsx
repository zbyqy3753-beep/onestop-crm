import Link from "next/link";
import { Icon, type IconKey } from "@/components/ui/Icon";

/**
 * פאנל פעולות מהירות + שורת ניווט מהיר.
 *
 * ⚠️ שניים מהפריטים כאן היו `href="#"` — קישור שנראה לחיץ ולא עושה
 * כלום. בעכבר זו אכזבה קטנה; במגע זה נראה כאילו האפליקציה נתקעה, כי
 * אין שום משוב. פריט בלי יעד אמיתי מוצג עכשיו כמושבת עם התווית
 * "בקרוב", ו"תמיכה טכנית" חוברה למסך המשוב שכבר קיים ועושה בדיוק את זה.
 */

interface ActionItem {
  key: string;
  /** `null` = אין יעד עדיין; יוצג כמושבת ולא כקישור */
  href: string | null;
  icon: IconKey;
  title: string;
  subtitle: string;
}

const ACTIONS: ActionItem[] = [
  {
    key: "new-deal",
    href: "/leads",
    icon: "deals",
    title: "הוספת עסקה חדשה",
    subtitle: "בחר חבילה והתחל אקטוב",
  },
  {
    key: "support",
    href: "/feedback",
    icon: "note",
    title: "תמיכה טכנית",
    subtitle: "בעיות במערכת? דווח לנו",
  },
  {
    key: "whatsapp",
    // TODO: אין עדיין קישור וואטסאפ אמיתי לבק דסק — לחווט כשיסופק.
    href: null,
    icon: "phone",
    title: "וואצפ בק דסק",
    subtitle: "תמיכה ועדכונים על עסקאות",
  },
];

/**
 * ⚠️ שלושה מארבעת הצ׳יפים כאן הצביעו ל-`/leads` עם תוויות שונות
 * ("לידים חמים", "ליד מדאטה", "ניהול לידים") — שלוש הבטחות שונות
 * שנוחתות באותו מקום בדיוק. הוחלפו ביעדים נבדלים.
 */
const QUICK_NAV: { href: string; label: string; icon: IconKey }[] = [
  { href: "/leads", label: "תור הלידים", icon: "leads" },
  { href: "/packages", label: "חבילות", icon: "packages" },
  { href: "/my-deals", label: "העסקאות שלי", icon: "myDeals" },
  { href: "/admin", label: "עובדים", icon: "admin" },
];

export function QuickActions() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {ACTIONS.map((a) => {
          const body = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon name={a.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-1">{a.title}</span>
                <span className="block truncate text-xs text-ink-3">{a.subtitle}</span>
              </span>
              {!a.href && (
                <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-4">
                  בקרוב
                </span>
              )}
            </>
          );

          return (
            <li key={a.key}>
              {a.href ? (
                <Link
                  href={a.href}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2 active:bg-surface-2"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex cursor-not-allowed items-center gap-3 rounded-card border border-dashed border-line bg-surface p-3.5 opacity-60">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="ניווט מהיר"
      >
        {QUICK_NAV.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1 active:bg-surface-2 lg:min-h-0"
          >
            <Icon name={n.icon} size={14} />
            {n.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
