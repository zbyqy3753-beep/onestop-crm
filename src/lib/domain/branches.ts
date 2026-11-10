/**
 * ── סניפי מוביסל: קישור ו-QR לכל סניף ─────────────────────────────────
 *
 * לקוח שסורק את ה-QR בסניף נכנס ל-`https://site.onestopil.co.il/s/<code>`.
 * האתר שומר את הקוד בקוקי לשלושים יום, וכל ליד שהלקוח משאיר באתר מגיע
 * לכאן עם `branch: <code>` ונרשם עם מקור "אתר ONE STOP – <שם הסניף>".
 *
 * ⚠️ **מקור האמת היחיד לסניפים.** האתר לא מחזיק רשימה. הוא מעביר כל קוד
 * שנראה תקין, וקוד שלא מופיע כאן פשוט נבלע: הליד נקלט כרגיל, בלי סניף.
 *
 * ⚠️⚠️ **אסור לשנות `code` של סניף קיים.** הוא מודפס על QR שתלוי בחנות,
 * וקוד ששונה הופך כל מדבקה קיימת לסריקה בלי ייחוס. סניף שנסגר נשאר
 * ברשימה. שם תצוגה (`name`) מותר לשנות.
 *
 * `callupId` הוא מזהה החנות במערכת CallUp (`crm.onestopil.co`), לצורך
 * הצלבה בלבד.
 *
 * `whatsapp`: מספר שמקבל הודעה על כל ליד מהסניף (במקבץ של חמש דקות,
 * כמו התראת ליד חם לעובד). ריק = אין הודעה. הוספת מספר היא כל מה שצריך.
 *
 * ⚠️ מודול טהור, בלי ייבוא: משמש גם את מסלול ה-API וגם את המסך.
 */

export type Branch = {
  code: string;
  name: string;
  callupId: number;
  whatsapp?: string;
};

/** הדומיין שה-QR מצביע אליו. */
export const BRANCH_SITE_ORIGIN = "https://site.onestopil.co.il";

export const BRANCHES: readonly Branch[] = [
  { code: "ashdod", name: "מוביסל אשדוד", callupId: 149 },
  { code: "rehovot", name: "מוביסל רחובות", callupId: 150 },
  { code: "maxitel", name: "מוביסל מקסיטל", callupId: 155 },
  { code: "cellpower", name: "מוביסל סלפאוור", callupId: 159 },
  { code: "nazareth", name: "מובי סייל נצרת", callupId: 160 },
  { code: "bilu", name: "מוביסל בילו", callupId: 166 },
  { code: "cinema", name: "מוביסל סינמה", callupId: 167 },
  { code: "beer-sheva", name: "מוביסל באר שבע", callupId: 172 },
  { code: "zichron", name: "מוביסל זכרון", callupId: 178 },
  { code: "rothschild", name: "מוביסל רוטשילד", callupId: 181 },
  { code: "malha", name: "מוביסל מלחה ירושלים", callupId: 182 },
  { code: "ramat-aviv", name: "מוביסל רמת אביב", callupId: 183 },
  { code: "zahav", name: "מוביסל קניון הזהב", callupId: 184 },
  { code: "orel", name: "מובי סיל אוראל בע״מ", callupId: 185 },
  { code: "pinchas-rosen", name: "מוביסל פנחס רוזן", callupId: 186 },
  { code: "modiin", name: "מוביסל מודיעין", callupId: 187 },
  { code: "hai", name: "מוביסל חי", callupId: 188 },
  { code: "hadar", name: "מוביסל קניון הדר", callupId: 189 },
  { code: "yehud", name: "מוביסל יהוד", callupId: 190 },
  { code: "tiberias", name: "מוביסל ביג טבריה וחוצות המפרץ", callupId: 191 },
  { code: "or-akiva", name: "מוביסל אור עקיבא", callupId: 192 },
  { code: "raanana-ubox", name: "מוביסל רעננה ubox", callupId: 193 },
  { code: "simol", name: "מוביסל קניון סימול", callupId: 194 },
  { code: "noam", name: "מוביסל נועם", callupId: 195 },
  { code: "petah-tikva", name: "מוביסל פתח תקווה", callupId: 196 },
  { code: "raanana-renanim", name: "מוביסל רעננה רננים", callupId: 198 },
  { code: "azrieli-tlv", name: "מוביסל עזריאלי תל אביב", callupId: 201 },
  { code: "rishonim", name: "מוביסל קניון ראשונים", callupId: 213 },
  { code: "kfar-saba", name: "מוביסל כפר סבא", callupId: 219 },
  { code: "tlv", name: "מוביסל tlv", callupId: 220 },
  { code: "migdal-haemek", name: "מוביסל מגדל העמק", callupId: 223 },
  { code: "hanhala", name: "מוביסל הנהלה", callupId: 226 },
  { code: "buchman-modiin", name: "מוביסל בוכמן מודיעין", callupId: 229 },
  { code: "daniel", name: "מוביסל דניאל בע״מ", callupId: 231 },
  { code: "gan-shmuel", name: "מוביסל בר סלולר גן שמואל", callupId: 245 },
  { code: "midtown-tlv", name: "מוביסל מידטאון תל אביב", callupId: 251 },
  { code: "kiryat-ono", name: "מוביסל קרית אונו shytech", callupId: 287 },
  { code: "shaarei-tzedek", name: "מוביסל שערי צדק", callupId: 294 },
];

/** הסניף לפי הקוד מה-QR, או `undefined` לקוד לא מוכר. */
export function branchByCode(code: unknown): Branch | undefined {
  if (typeof code !== "string") return undefined;
  const key = code.trim().toLowerCase();
  return BRANCHES.find((b) => b.code === key);
}

/** הקישור שמודפס ב-QR של הסניף. */
export function branchUrl(branch: Branch): string {
  return `${BRANCH_SITE_ORIGIN}/s/${branch.code}`;
}

/** ה"מקור" שנרשם על ליד מהסניף, כפי שהוא מוצג בטבלת הלידים. */
export function branchSourceDetail(partnerName: string, branch: Branch): string {
  return `${partnerName} – ${branch.name}`;
}
