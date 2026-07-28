import type { SVGProps } from "react";

/**
 * סט אייקונים מינימלי, בקו אחיד (stroke 1.5, 24px grid).
 * הכל currentColor — האייקונים יורשים צבע מההקשר ולכן עובדים
 * בשתי התמות בלי טיפול מיוחד.
 */

export type IconKey =
  | "leads"
  | "packages"
  | "deals"
  | "dashboard"
  | "myDeals"
  | "operator"
  | "registrations"
  | "admin"
  | "search"
  | "menu"
  | "plus"
  | "close"
  | "chevronDown"
  | "chevronLeft"
  | "check"
  | "phone"
  | "mail"
  | "whatsapp"
  | "star"
  | "sun"
  | "moon"
  | "filter"
  | "upload"
  | "download"
  | "trash"
  | "user"
  | "clock"
  | "note"
  | "feedback"
  | "logout";

const PATHS: Record<IconKey, React.ReactNode> = {
  leads: (
    <>
      <path d="M4 6h16M4 12h16M4 18h9" />
      <circle cx="18.5" cy="18" r="2.5" />
    </>
  ),
  packages: (
    <>
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z" />
      <path d="M3 8.5 12 13l9-4.5M12 13v7" />
    </>
  ),
  deals: (
    <>
      <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  myDeals: (
    <>
      <path d="M20 7 9.5 17.5 4 12" />
    </>
  ),
  operator: (
    <>
      <path d="M4 13a8 8 0 1 1 16 0" />
      <rect x="2.5" y="13" width="4" height="6" rx="2" />
      <rect x="17.5" y="13" width="4" height="6" rx="2" />
      <path d="M19.5 19v1a2 2 0 0 1-2 2H13" />
    </>
  ),
  registrations: (
    <>
      <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9.5 9h5M9.5 13h5M9.5 17h3" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  feedback: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" />
      <path d="M13 9v3.5" />
      <circle cx="13" cy="15.6" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M9 8l-4 4 4 4M5 12h10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  phone: (
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 20.5 11.7z" />
      <path d="M9.3 9.2c.5 0 .8 1 1 1.5.1.3-.4.6-.5.9-.1.3.6 1.3 1.3 1.9.7.6 1.5 1 1.8.9.3-.1.5-.7.9-.7.4 0 1.5.6 1.5 1 0 .6-.6 1.2-1.3 1.3-1 .1-2.7-.5-4-1.7-1.3-1.2-2-2.8-1.9-3.8.1-.7.7-1.3 1.2-1.3z" />
    </>
  ),
  star: (
    <path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M10 11v6m4-6v6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M19 15h-5v5" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconKey;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
