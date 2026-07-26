import type { Role } from "@/lib/domain/types";

export interface NavItem {
  href: string;
  label: string;
  /** תיאור קצר שמופיע כ-title ולקוראי מסך */
  hint: string;
  icon: IconName;
  /** התפקידים שרואים את הפריט. ריק = כולם */
  roles?: Role[];
  /** המסך עדיין לא נבנה — יוצג כמושבת */
  planned?: boolean;
}

export type IconName =
  | "leads"
  | "packages"
  | "deals"
  | "dashboard"
  | "myDeals"
  | "registrations"
  | "admin"
  | "feedback";

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * מבנה הניווט. המסלולים תואמים למערכת הקיימת, כך שקישורים
 * וזיכרון שריר של המשתמשים נשמרים.
 */
export const NAV: NavGroup[] = [
  {
    title: "עבודה יומית",
    items: [
      {
        href: "/",
        label: "בית",
        hint: "סיכום יומי",
        icon: "dashboard",
      },
      {
        href: "/leads",
        label: "לידים",
        hint: "תור העבודה — מי לחייג עכשיו",
        icon: "leads",
      },
      {
        href: "/packages",
        label: "חבילות",
        hint: "קטלוג הספקים והעמלות",
        icon: "packages",
      },
      {
        href: "/my-deals",
        label: "העסקאות שלי",
        hint: "מה סגרתי וכמה הרווחתי",
        icon: "myDeals",
      },
      {
        href: "/feedback",
        label: "משוב",
        hint: "דיווח באגים ובקשות שיפור על המערכת",
        icon: "feedback",
      },
    ],
  },
  {
    title: "ניהול",
    items: [
      {
        href: "/deals",
        label: "מעקב עסקאות",
        hint: "כל העסקאות בארגון",
        icon: "deals",
        roles: ["owner", "manager", "bizManager", "shopOwner"],
      },
      {
        href: "/deals-dashboard",
        label: "דשבורד עסקאות",
        hint: "רווח, עמלות וביצועים",
        icon: "dashboard",
        roles: ["owner", "manager", "bizManager"],
      },
      {
        href: "/registrations",
        label: "טפסי רישום",
        hint: "פניות שהגיעו מטפסים",
        icon: "registrations",
        roles: ["owner", "manager", "operator"],
      },
      {
        href: "/admin",
        label: "ניהול מערכת",
        hint: "משתמשים, הרשאות ועלויות",
        icon: "admin",
        roles: ["owner", "manager"],
      },
    ],
  },
];

export function visibleFor(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}
