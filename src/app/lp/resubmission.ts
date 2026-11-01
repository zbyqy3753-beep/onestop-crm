import { PROVIDER_CONFIG, type ProviderKey } from "@/lib/domain/types";
import { LANDING_CATEGORIES } from "./config";
import type { LeadCategoryKey } from "@/lib/domain/types";

/**
 * השדות שפנייה חוזרת של אותו אדם נושאת איתה.
 *
 * ⚠️ `category` הוא החמישי, ולא נשא איתו עקבה. ארבעה מחמשת השדות
 * שהטופס מאמת הגיעו לכאן, והיחיד שנשאר בחוץ הוא דווקא **מפתח הסינון
 * של הנציג** — אותו משטח שסבב 47 גידר עבור `packageName`. מבקר
 * שהשאיר פרטים על כרטיס סלולר ואז מילא את המחשבון במסלול הבית קיבל
 * "קיבלנו!", ועמודת הקטגוריה נשארה "סלולר" בזמן שהבקשה הנוכחית שלו
 * היא "אינטרנט וטלוויזיה". זו בדיוק ההבטחה שהמחשבון מדפיס במלים
 * ("שליחה נוספת תעדכן את אותה פנייה").
 */
export interface Resubmission {
  message: string;
  packageName: string;
  name: string;
  currentProvider: ProviderKey | undefined;
  category: LeadCategoryKey | undefined;
}

/** הליד הקיים, במידה שהכרעה הזו צריכה. */
export interface ExistingLead {
  name: string;
  packageName?: string | null;
  currentProvider?: ProviderKey | null;
  category?: LeadCategoryKey | null;
  notes: { body: string }[];
}

/**
 * מה מתוך פנייה חוזרת הוא **מידע חדש** שצריך להגיע לנציג.
 *
 * ⚠️ הפונקציה יושבת כאן ולא ב-`actions.ts` כדי שאפשר לבדוק אותה:
 * `actions.ts` הוא `"use server"`, כלומר כל ייצוא ממנו חייב להיות
 * פונקציה אסינכרונית, והמודול עצמו אינו ניתן לקמפול ב-tsx
 * (ראה ה-stub בראש `tools/lpBrowse.test.mjs`). הכללים האלה הם ההבטחה
 * ש-`SavingsCalculator` מדפיס לגולש במלים ("אם שיניתם את הנתונים,
 * שליחה נוספת תעדכן את אותה פנייה"), ולכן הם חייבים בדיקה.
 *
 * ⚠️ הערות ולא `db.leads.update`: השם, הספק ושם החבילה על הליד
 * הקיים הם שדות שהנציג עורך, ודריסה מטופס ציבורי הייתה מוחקת
 * תיקון שלו בלי שידע. ההכרעה נשארת אצלו.
 *
 * ⚠️ וכל שורה נבדקת מול ההערות שכבר קיימות: לחיצה כפולה על
 * "שליחה" אינה נושאת מידע חדש, ואסור שתוסיף אותה הערה פעמיים.
 */
export function resubmissionNotes(input: Resubmission, lead: ExistingLead): string[] {
  const notes: string[] = [];
  const fresh = (line: string) => {
    if (!lead.notes.some((n) => n.body === line) && !notes.includes(line)) notes.push(line);
  };
  if (input.message) fresh(input.message);
  if (input.packageName && input.packageName !== lead.packageName) {
    fresh(`התעניין גם ב: ${input.packageName}`);
  }
  if (input.name && input.name !== lead.name) {
    fresh(`השם שנמסר בפנייה החוזרת: ${input.name}`);
  }
  if (input.currentProvider && input.currentProvider !== lead.currentProvider) {
    fresh(`הספק שנמסר בפנייה החוזרת: ${PROVIDER_CONFIG[input.currentProvider].label}`);
  }
  /*
   * ⚠️ והתווית מ-`LANDING_CATEGORIES`, הרשימה שהטופס עצמו מציג —
   * ולא `LEAD_CATEGORY_CONFIG` הגדולה ממנה. `parseCategory` מצמצם
   * את הקלט לחמשת המפתחות האלה, ולכן זו הרשימה שתמיד תחזיק תווית;
   * מפתח שאינו בה נשאר בלי שורה במקום להדפיס `undefined`.
   */
  if (input.category && input.category !== lead.category) {
    const label = LANDING_CATEGORIES.find((c) => c.key === input.category)?.label;
    if (label) fresh(`מה שמעניין אותו בפנייה החוזרת: ${label}`);
  }
  return notes;
}
