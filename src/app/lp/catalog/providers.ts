/**
 * Operators a visitor might currently be with. Deliberately wider than our own
 * catalogue — someone switching away from a company we do not resell is still
 * a lead, and knowing who they are with is what lets the rep quote a saving.
 */
export const PROVIDER_CHOICES = [
  "סלקום",
  "פרטנר",
  "פלאפון",
  "HOT mobile",
  "גולן טלקום",
  "WeCom",
  "רמי לוי",
  "019",
  "בזק",
  "בזק בינלאומי",
  "HOT",
  "yes",
  "סטינג TV",
  "נטוויז'ן",
  "חברת החשמל",
  /*
   * ⚠️ ספקי החשמל הפרטיים, ולא "חברת החשמל" לבדה. 7 מ-19 מסלולי החשמל
   * בקטלוג הם של HOT אנרגי (146-148, 152) ובזק אנרג'י (149-151) —
   * כלומר מבקר שכבר עבר לספק פרטי ובא להשוות לא מצא את החברה שלו
   * ברשימה ונאלץ לבחור "אחר", דווקא בקטגוריה היחידה שבה המעבר הקודם
   * הוא המידע שהנציג צריך. אלה שני השמות היחידים שהופיעו ב-`provider`
   * של הקטלוג ולא כאן.
   */
  "HOT אנרגי",
  "בזק אנרג'י",
  "אחר",
] as const;
