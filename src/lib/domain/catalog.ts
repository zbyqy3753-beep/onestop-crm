import type { LeadCostTable, Package } from "./types";

/**
 * קטלוג ריק — אין חבילות דוגמה. החבילות האמיתיות מגיעות מ-MySQL.
 */
export const SEED_PACKAGES: Package[] = [];

/**
 * עלות רכישת ליד לפי קטגוריה, בשקלים. מאופס עד שמגדירים ערכים
 * אמיתיים (במסך החבילות או ישירות ב-MySQL).
 */
export const SEED_LEAD_COSTS: LeadCostTable = {
  mobile: 0,
  internet: 0,
  tv: 0,
  triple: 0,
  electricity: 0,
  general: 0,
};
