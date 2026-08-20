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
  "אחר",
] as const;
