import Link from "next/link";
import { Icon, type IconKey } from "@/components/ui/Icon";

/**
 * פאנל פעולות מהירות + שורת ניווט מהיר.
 *
 * קישורי הוואטסאפ/תמיכה הם placeholder (`#`) — אין עדיין URL אמיתי
 * לבק דסק או לתמיכה הטכנית; לסמן ולחווט כשיהיה ידוע.
 */

interface ActionItem {
  key: string;
  href: string;
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
    key: "whatsapp",
    // TODO: אין עדיין קישור וואטסאפ אמיתי לבק דסק — לחווט כשיסופק.
    href: "#",
    icon: "phone",
    title: "וואצפ בק דסק",
    subtitle: "תמיכה ועדכונים על עסקאות",
  },
  {
    key: "support",
    // TODO: אין עדיין קישור אמיתי לתמיכה הטכנית — לחווט כשיסופק.
    href: "#",
    icon: "note",
    title: "תמיכה טכנית",
    subtitle: "בעיות במערכת? אנחנו כאן",
  },
];

const QUICK_NAV: { href: string; label: string; icon: IconKey }[] = [
  { href: "/leads", label: "לידים חמים", icon: "leads" },
  { href: "/leads", label: "ליד מדאטה", icon: "leads" },
  { href: "/leads", label: "ניהול לידים", icon: "leads" },
  { href: "/admin", label: "עובדים", icon: "admin" },
];

export function QuickActions() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {ACTIONS.map((a) => (
          <li key={a.key}>
            <Link
              href={a.href}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon name={a.icon} size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-1">{a.title}</span>
                <span className="block truncate text-xs text-ink-3">{a.subtitle}</span>
              </span>
            </Link>
          </li>
        ))}
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
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1"
          >
            <Icon name={n.icon} size={14} />
            {n.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
