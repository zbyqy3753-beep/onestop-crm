"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Role } from "@/lib/domain/types";
import { mobileTabsFor } from "./nav";

/**
 * הניווט של הטלפון.
 *
 * ⚠️ הוא **מחליף** את כפתור ההמבורגר, לא מצטרף אליו. ההמבורגר ישב
 * בפינה העליונה — ב-RTL זו הפינה הימנית העליונה, הנקודה הכי רחוקה
 * מהאגודל במכשיר גדול — וכל מעבר בין מסכים עלה לחיצה, המתנה לאנימציה,
 * סריקה של עד תשעה פריטים, ולחיצה שנייה. שום ליטוש לא מתקן מיקום.
 *
 * חשבון הגובה: הסרגל הזה עולה 56px, הסרגל העליון ירד מ-60 ל-52
 * ואיבד את ההמבורגר, ולכן התוספת נטו היא 48px — מול 196px שכותרת
 * מסך הלידים החזירה.
 *
 * ארבעה יעדים ועוד "עוד". מי שאין לו `mobileOrder` נוחת בגיליון,
 * ולכן יעד חדש ב-`NAV` אף פעם לא נעלם.
 */
export function BottomNav({
  role,
  pathname,
  onMore,
  moreOpen,
}: {
  role: Role;
  pathname: string;
  onMore: () => void;
  moreOpen: boolean;
}) {
  const tabs = mobileTabsFor(role);

  return (
    <nav
      aria-label="ניווט ראשי"
      // ⚠️ גם ה-inset האופקי, לא רק התחתון. במצב נוף על מכשיר עם מגרעת
      // הטאב הראשון והאחרון נחתו מתחתיה — כלומר "לידים", היעד הנפוץ
      // ביותר, הפך ללא לחיץ בדיוק בסיבוב שבו מסתכלים על טבלאות
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] ps-[env(safe-area-inset-right)] pe-[env(safe-area-inset-left)] lg:hidden"
    >
      {tabs.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors active:bg-surface-2 ${
              active ? "font-semibold text-brand" : "text-ink-3"
            }`}
          >
            <Icon name={item.icon} size={20} />
            <span className="max-w-full truncate px-1">
              {item.shortLabel ?? item.label}
            </span>
          </Link>
        );
      })}

      <button
        onClick={onMore}
        aria-expanded={moreOpen}
        className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors active:bg-surface-2 ${
          moreOpen ? "font-semibold text-brand" : "text-ink-3"
        }`}
      >
        <Icon name="menu" size={20} />
        עוד
      </button>
    </nav>
  );
}
