import type { IconKey } from "@/components/ui/Icon";
import { Icon } from "@/components/ui/Icon";
import type { StatusTone } from "@/lib/domain/types";
import { TONE_SOFT_VAR, TONE_VAR, number } from "@/lib/format";

/**
 * שורת אריחי הסיכום של הדשבורד.
 *
 * ארבעת האריחים הראשונים מחושבים מנתונים אמיתיים. שלושת האחרונים
 * (עסקאות החודש/היום, עמלות החודש) הם placeholder מכוון — גם
 * במערכת האמיתית הם עדיין לא מחוברים, ולכן מרנדרים `0` פשוטו
 * כמשמעו במקום להמציא מספר. ראה `src/app/(app)/page.tsx`.
 */

interface Tile {
  key: string;
  icon: IconKey;
  label: string;
  value: React.ReactNode;
  caption?: string;
  /**
   * ⚠️ שבעה אריחים לבנים זהים הם רשת שאי אפשר לסרוק — העין לא יודעת
   * לאן ללכת, וכל אריח נראה חשוב באותה מידה. הטון צובע את האייקון
   * ונותן לכל אריח סימן היכר שנקרא לפני שקוראים את הכותרת.
   */
  tone: StatusTone;
}

export function SummaryTiles({
  agentsActive,
  employeesActive,
  employeesTotal,
  storesCount,
  pendingLeads,
  totalLeads,
}: {
  agentsActive: number;
  employeesActive: number;
  employeesTotal: number;
  storesCount: number;
  pendingLeads: number;
  totalLeads: number;
}) {
  const tiles: Tile[] = [
    {
      key: "agents",
      icon: "user",
      label: "סוכנים",
      value: number(agentsActive),
      tone: "info",
    },
    {
      key: "employees",
      icon: "user",
      label: "עובדים",
      tone: "signal",
      // רצף "מספר / מספר" טהור (בלי מילה בעברית ביניים) מתהפך חזותית
      // ב-RTL בלי בידוד — ראה .ltr-num ב-globals.css.
      value: (
        <span className="ltr-num">
          {number(employeesActive)} / {number(employeesTotal)}
        </span>
      ),
    },
    {
      key: "stores",
      icon: "packages",
      label: "חנויות",
      value: number(storesCount),
      tone: "accent",
    },
    {
      key: "leads",
      icon: "leads",
      label: "לידים",
      value: `${number(pendingLeads)} ממתינים / ${number(totalLeads)}`,
      tone: "active",
    },
    {
      key: "dealsMonth",
      icon: "deals",
      label: "עסקאות החודש",
      value: "0",
      caption: "יתעדכן אוטומטית בקרוב",
      tone: "good",
    },
    {
      key: "dealsToday",
      icon: "clock",
      label: "עסקאות היום",
      value: "0",
      caption: "יתעדכן אוטומטית בקרוב",
      tone: "warn",
    },
    {
      key: "commissionsMonth",
      icon: "note",
      label: "עמלות החודש",
      value: "0",
      caption: "יתעדכן אוטומטית בקרוב",
      tone: "rose",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.key}
          className="rounded-card border border-line bg-surface p-4"
        >
          <div className="mb-2.5 flex items-center gap-2 text-ink-2">
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: TONE_SOFT_VAR[t.tone],
                color: TONE_VAR[t.tone],
              }}
            >
              <Icon name={t.icon} size={16} />
            </span>
            <span className="text-[13px] font-medium">{t.label}</span>
          </div>
          <p className="nums text-xl font-bold leading-tight text-ink-1">
            {t.value}
          </p>
          {t.caption && (
            <p className="mt-1.5 text-xs text-ink-4">{t.caption}</p>
          )}
        </div>
      ))}
    </div>
  );
}
