import { PROVIDER_CONFIG, type ProviderKey } from "@/lib/domain/types";

/**
 * השדות שפנייה חוזרת של אותו אדם נושאת איתה.
 */
export interface Resubmission {
  message: string;
  packageName: string;
  name: string;
  currentProvider: ProviderKey | undefined;
}

/** הליד הקיים, במידה שהכרעה הזו צריכה. */
export interface ExistingLead {
  name: string;
  packageName?: string | null;
  currentProvider?: ProviderKey | null;
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
  return notes;
}
