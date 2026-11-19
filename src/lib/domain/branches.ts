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
 * ⚠️ מודול טהור: משמש גם את מסלול ה-API וגם את המסך. הייבוא היחיד הוא
 * `mobicellWorkers.ts`, שגם הוא נתונים בלבד.
 */

import { MOBICELL_WORKERS, type MobicellWorker } from "./mobicellWorkers";

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

/**
 * ── QR אישי לנציג ───────────────────────────────────────────────────
 *
 * QR אישי נושא קוד `<סניף>--<תג נציג>` (למשל `ashdod--3fa91c0e`), וליד
 * שמגיע ממנו משויך אוטומטית לנציג ומקבל התראת ליד חם.
 *
 * ⚠️ האתר לא יודע על זה כלום: הוא מעביר כל קוד שעונה ל-
 * `^[a-z0-9-]{2,40}$` כמו שהוא. לכן אין צורך לשנות או לפרוס את האתר,
 * אבל הקוד המלא חייב להישאר בתוך הביטוי הזה: אותיות קטנות, ספרות
 * ומקף, עד 40 תווים. סניף ארוך (15) + מפריד (2) + תג (8) = 25.
 *
 * `--` בטוח כמפריד כי אף קוד סניף לא מכיל מקף כפול. התג עצמו נגזר
 * ממזהה המשתמש (`server/leads/branchRep.ts`), כך שהוא יציב ואין עמודה
 * ב-DB. תג שלא מתאים לאף עובד פעיל: הליד נקלט עם הסניף, בלי שיוך.
 */
export const REP_SEPARATOR = "--";

/** הסניף ותג הנציג (אם יש) מתוך קוד ה-QR, או `undefined` לסניף לא מוכר. */
export function parseBranchRef(
  code: unknown,
): { branch: Branch; repTag?: string } | undefined {
  if (typeof code !== "string") return undefined;
  const [branchCode, repTag] = code.trim().toLowerCase().split(REP_SEPARATOR, 2);
  const branch = branchByCode(branchCode);
  if (!branch) return undefined;
  return repTag ? { branch, repTag } : { branch };
}

/** הקישור שמודפס ב-QR של הסניף; עם `repTag` — ה-QR האישי של הנציג. */
export function branchUrl(branch: Branch, repTag?: string): string {
  const code = repTag ? `${branch.code}${REP_SEPARATOR}${repTag}` : branch.code;
  return `${BRANCH_SITE_ORIGIN}/s/${code}`;
}

/**
 * ── QR אישי לעובד מוביסל ────────────────────────────────────────────
 *
 * עובד מוביסל (`mobicellWorkers.ts`) מקבל תג `w<id>`, כאשר `id` הוא מזהה
 * הנציג ב-CallUp: `ashdod--w46`. בשונה מתג של עובד CRM, ליד מהתג הזה **לא**
 * משויך לנציג. עובד מוביסל לא נכנס ל-CRM, וליד ששויך אליו היה נתקע. הליד
 * נכנס לחלוקה הרגילה, והקרדיט נרשם בהערה (`mobicellCreditLine`).
 *
 * `w` + ספרות לא יכול להתנגש בתג של עובד CRM, שהוא תמיד שמונה תווי hex.
 */
export const WORKER_TAG_PREFIX = "w";

export function workerTag(worker: MobicellWorker): string {
  return `${WORKER_TAG_PREFIX}${worker.id}`;
}

/**
 * עובד המוביסל שהתג שלו, ורק אם הוא רשום **באותו סניף** שבקוד.
 *
 * ⚠️ עובד שכבר לא פעיל עדיין מוחזר: המדבקה שלו תלויה בחנות, והקרדיט
 * שלו לא אמור להיעלם רק כי הוא עזב את רשימת CallUp.
 */
export function workerByTag(branch: Branch, tag: string): MobicellWorker | undefined {
  const m = /^w(\d{1,9})$/.exec(tag);
  if (!m) return undefined;
  const id = Number(m[1]);
  return MOBICELL_WORKERS.find((w) => w.id === id && w.branch === branch.code);
}

/** העובדים הפעילים של סניף, לפי שם. */
export function branchWorkers(branch: Branch): MobicellWorker[] {
  return MOBICELL_WORKERS.filter((w) => w.active && w.branch === branch.code).sort((a, b) =>
    a.name.localeCompare(b.name, "he"),
  );
}

/**
 * השורה שנכתבת בהערת הליד. היא גם מה שהמסך סופר לפיו: `#<id>` יציב גם
 * כשהשם משתנה ב-CallUp.
 */
export function mobicellCreditLine(worker: MobicellWorker, branch: Branch): string {
  return `הגיע מסריקת ה-QR האישי של ${worker.name} (עובד מוביסל ${mobicellCreditMarker(worker)}) בסניף ${branch.name}`;
}

export function mobicellCreditMarker(worker: Pick<MobicellWorker, "id">): string {
  return `#${worker.id}`;
}

/**
 * ה"מקור" שנרשם על ליד מהסניף, כפי שהוא מוצג בטבלת הלידים:
 * `אתר ONE STOP – מוביסל אשדוד`, ועם עובד מוביסל `… – מוביסל אשדוד – שוהם`.
 *
 * ⚠️ מי שסופר לידים לסניף צריך להכיר את שתי הצורות — ראה `isBranchSource`.
 */
export function branchSourceDetail(
  partnerName: string,
  branch: Branch,
  worker?: MobicellWorker,
): string {
  const base = `${partnerName} – ${branch.name}`;
  return worker ? `${base} – ${worker.name}` : base;
}

/**
 * האם ה"מקור" שייך לסניף. ⚠️ לא `includes(שם)`: "מוביסל מודיעין" הוא סיומת
 * של "מוביסל בוכמן מודיעין", ולכן בודקים את השם כמקטע שלם בין מפרידים.
 */
export function isBranchSource(sourceDetail: string | null | undefined, branch: Branch): boolean {
  if (!sourceDetail) return false;
  const parts = sourceDetail.split(" – ");
  return parts.slice(1).includes(branch.name);
}
