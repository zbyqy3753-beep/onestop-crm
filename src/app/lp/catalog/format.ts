import type { CellularSpec, ElectricitySpec, HomeSpec, Package } from "./types";

const nf = new Intl.NumberFormat("he-IL");

/** "39" not "39.00"; "39.9" keeps its agora. */
export function shekels(value: number): string {
  return `₪${nf.format(Number(value.toFixed(2)))}`;
}

export function siteDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

/** Big buckets are sold as "unlimited" — say so instead of printing 10000GB. */
export function dataLabel(spec: CellularSpec): string | null {
  if (spec.unlimitedData) return "גלישה חופשית";
  if (spec.dataGb == null || spec.dataGb === 0) return null;
  return `${nf.format(spec.dataGb)}GB`;
}

export function speedLabel(spec: HomeSpec): string | null {
  if (spec.downloadMbps == null) return null;
  const down = spec.downloadMbps >= 1000 ? `${spec.downloadMbps / 1000}Gb` : `${spec.downloadMbps}Mb`;
  return spec.uploadMbps != null ? `${down}/${spec.uploadMbps}` : down;
}

export const CUSTOMER_TYPE_HE: Record<ElectricitySpec["customerType"], string> = {
  private: "לקוח פרטי",
  business: "לקוח עסקי",
  house_committee: "ועד בית",
};

/**
 * The three headline figures on a card. Value + caption reads far faster on
 * mobile than a spec table, which is why every card uses this shape.
 */
export interface Stat {
  value: string;
  caption: string;
}

export function cardStats(pkg: Package): Stat[] {
  if (pkg.category === "cellular") {
    const spec = pkg.spec as CellularSpec;
    const out: Stat[] = [];
    const data = dataLabel(spec);
    if (data) out.push({ value: data, caption: "גלישה בישראל" });
    if (spec.minutes) out.push({ value: nf.format(spec.minutes), caption: "דקות שיחה" });
    if (spec.sms) out.push({ value: nf.format(spec.sms), caption: "הודעות SMS" });
    if (out.length < 3 && spec.intlMinutes) {
      out.push({ value: nf.format(spec.intlMinutes), caption: "דקות לחו״ל" });
    }
    return out.slice(0, 3);
  }

  if (pkg.category === "home") {
    const spec = pkg.spec as HomeSpec;
    const out: Stat[] = [];
    const speed = spec.downloadMbps != null ? speedLabel(spec) : null;
    if (speed) out.push({ value: speed, caption: "מהירות גלישה" });
    if (spec.channels) out.push({ value: nf.format(spec.channels), caption: "ערוצים" });
    if (spec.converters) out.push({ value: String(spec.converters), caption: "ממירים כלולים" });
    if (out.length < 3 && spec.installationCost != null) {
      out.push({
        value: spec.installationCost === 0 ? "ללא עלות" : shekels(spec.installationCost),
        caption: "התקנה",
      });
    }
    return out.slice(0, 3);
  }

  const spec = pkg.spec as ElectricitySpec;
  const out: Stat[] = [];
  if (spec.allHours) out.push({ value: "כל השעות", caption: "מתי ההנחה חלה" });
  else if (spec.hoursText) out.push({ value: spec.hoursText, caption: "שעות ההנחה" });
  out.push({ value: CUSTOMER_TYPE_HE[spec.customerType], caption: "מיועד ל" });
  if (spec.smartMeterRequired === true) out.push({ value: "מונה חכם", caption: "נדרש" });
  else if (spec.smartMeterRequired === false) out.push({ value: "כל המונים", caption: "מתאים ל" });
  return out.slice(0, 3);
}

/** Extra facts worth surfacing under the fold; nulls are dropped, never guessed. */
export function detailRows(pkg: Package): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const fee = (label: string, v: number | null | undefined) => {
    if (v == null) return;
    rows.push({ label, value: v === 0 ? "ללא עלות" : shekels(v) });
  };

  if (pkg.category === "cellular") {
    const s = pkg.spec as CellularSpec;
    if (s.intlMinutes) rows.push({ label: "דקות לחו״ל", value: nf.format(s.intlMinutes) });
    fee("עלות SIM", s.simCost);
    fee("דמי חיבור", s.connectionFee);
    fee("דמי מעבר", s.transferFee);
    if (s.esim) rows.push({ label: "eSIM", value: "נתמך" });
    if (s.lineTiers?.length) {
      rows.push({
        label: "מחיר לפי מספר קווים",
        value: s.lineTiers.map((t) => `${t.lines} קווים ${shekels(t.price)}`).join(" · "),
      });
    }
  }

  if (pkg.category === "home") {
    const s = pkg.spec as HomeSpec;
    const speed = speedLabel(s);
    if (speed) rows.push({ label: "מהירות (הורדה/העלאה)", value: speed });
    fee("עלות התקנה", s.installationCost);
    if (s.routerIncluded === true) rows.push({ label: "נתב", value: "כלול במחיר" });
    if (s.extenderIncluded === true) rows.push({ label: "מגדיל טווח", value: "כלול במחיר" });
    fee("ממיר נוסף", s.extraConverterCost);
    fee("מגדיל טווח נוסף", s.extraExtenderCost);
    if (s.vodIncluded) rows.push({ label: "VOD", value: "כלול במחיר" });
  }

  if (pkg.category === "electricity") {
    const s = pkg.spec as ElectricitySpec;
    if (s.hoursText) rows.push({ label: "שעות ההנחה", value: s.hoursText });
    if (s.maxMonthlyBill) rows.push({ label: "תקרת חשבונית חודשית", value: shekels(s.maxMonthlyBill) });
    if (s.commitment === false) rows.push({ label: "התחייבות", value: "ללא התחייבות" });
    if (s.smartMeterRequired === true) rows.push({ label: "סוג מונה", value: "מונה חכם בלבד" });
    if (s.smartMeterRequired === false) rows.push({ label: "סוג מונה", value: "מתאים לכל סוגי המונים" });
  }

  return rows;
}
