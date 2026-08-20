/** Domain model for the public catalogue. Mirrors tools/normalize.mjs output. */

export type Category = "cellular" | "home" | "electricity";

export interface ProviderRef {
  slug: string;
  name: string;
  logo: string;
  raw: string | null;
}

export interface Provider {
  slug: string;
  name: string;
  logo: string;
  categories: Category[];
  count: number;
}

export interface CellularSpec {
  dataGb: number | null;
  unlimitedData: boolean;
  minutes: number | null;
  sms: number | null;
  intlMinutes: number | null;
  simCost: number | null;
  connectionFee: number | null;
  transferFee: number | null;
  esim: boolean;
  kosher: boolean;
  fiveG: boolean;
  lineTiers: { lines: number; price: number }[] | null;
}

export interface HomeSpec {
  downloadMbps: number | null;
  uploadMbps: number | null;
  converters: number | null;
  extraConverterCost: number | null;
  extraExtenderCost: number | null;
  installationCost: number | null;
  routerIncluded: boolean | null;
  extenderIncluded: boolean | null;
  channels: number | null;
  vodIncluded: boolean | null;
  hasTv: boolean;
  hasInternet: boolean;
  hasPhone: boolean;
  fiber: boolean;
}

export interface ElectricitySpec {
  discountPercent: number | null;
  allHours: boolean;
  hoursText: string | null;
  customerType: "private" | "business" | "house_committee";
  commitment: boolean | null;
  smartMeterRequired: boolean | null;
  maxMonthlyBill: number | null;
}

/**
 * שכבת ההחלטות האנושיות שמעל רשומת CallUp.
 *
 * קיימת רק על חבילה שמישהו ערך במערכת הניהול. `undefined` פירושו
 * "אף אחד לא נגע" — ולא "נערך וכבוי", שני מצבים שחייבים להיראות שונה
 * במסך הניהול.
 */
export interface Editorial {
  hidden: boolean;
  featured: boolean;
  sortWeight: number;
  note: string | null;
}

interface PackageBase {
  id: string;
  slug: string;
  category: Category;
  categoryHe: string;
  name: string;
  type: string | null;
  badges: string[];
  recommended: boolean;
  provider: ProviderRef;
  description: string | null;
  benefits: string | null;
  crmOrderUrl: string;
  /**
   * The operator's own sentence about what happens when the promotion ends,
   * shown verbatim when we could not read a reliable number. Never synthesised.
   */
  priceAfterPromoNote: string | null;
  /** נוסף במיזוג. `undefined` = החבילה לא נערכה מעולם. */
  editorial?: Editorial;
}

export interface MonthlyPackage extends PackageBase {
  category: "cellular" | "home";
  priceModel: "monthly";
  price: number | null;
  priceAfterPromo: number | null;
  /**
   * המחיר שאחרי ההטבה הוזן ידנית ולא נקרא מהטקסט של המפעיל.
   *
   * ⚠️ קיים כדי שיהיה אפשר לענות "מאיפה המספר הזה" בלי לחפור ביומן.
   * מספר באתר השוואת מחירים חייב להיות ניתן לייחוס למקור.
   */
  priceAfterPromoCorrected?: boolean;
  spec: CellularSpec | HomeSpec;
}

export interface ElectricityPackage extends PackageBase {
  category: "electricity";
  priceModel: "discount";
  price: null;
  discountPercent: number | null;
  rawPriceField: number | null;
  priceAfterPromo: null;
  spec: ElectricitySpec;
}

export type Package = MonthlyPackage | ElectricityPackage;

export interface Catalog {
  updatedAt: string;
  counts: { total: number; cellular: number; home: number; electricity: number };
  providers: Provider[];
  packages: Package[];
}

export const isElectricity = (p: Package): p is ElectricityPackage => p.category === "electricity";
export const isCellularSpec = (p: Package): p is MonthlyPackage & { spec: CellularSpec } =>
  p.category === "cellular";
export const isHomeSpec = (p: Package): p is MonthlyPackage & { spec: HomeSpec } => p.category === "home";
