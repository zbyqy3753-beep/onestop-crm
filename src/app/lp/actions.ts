"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/server/repositories";
import {
  isLeadCategory,
  isProvider,
  type LeadCategoryKey,
  type ProviderKey,
} from "@/lib/domain/types";
import { cleanText } from "@/lib/domain/interest";
import { normalizeIsraeliPhone } from "@/lib/format";
import { isYesLead } from "@/lib/domain/yes";
import {
  assigneeForIncoming,
  notifyOwnersOfYesLead,
} from "@/server/leads/yesRouting";
import { notifyHotLeadAssigned } from "@/server/leads/hotLeadAlert";
import {
  DEFAULT_ASSIGNEE_EMAIL,
  DEFAULT_SOURCE_DETAIL,
  LANDING_CATEGORIES,
} from "./config";

/**
 * שליחת דף הנחיתה הציבורי (`/lp`).
 *
 * ⚠️ **Server Action ולא קריאה ל-`POST /api/leads`, בכוונה.** ה-API
 * מיועד לשרת-אל-שרת ומאמת `x-api-key`; קריאה אליו מהדפדפן הייתה
 * מחייבת להטמיע את המפתח ב-JS של הדף — כלומר לפרסם אותו לכל מי
 * שפותח "הצג מקור". הפעולה הזו רצה על אותו שרת ואין לה מפתח בכלל.
 *
 * ⚠️ הנתיב פתוח בשער הגישה (`src/proxy.ts`), ולכן כל אימות כאן הוא
 * האימות היחיד. אין שכבה מעל שמסננת משהו.
 */

/* ── תוצאה ────────────────────────────────────────────────────────────── */

/**
 * מה שהמבקר הקליד, מוחזר אליו יחד עם שגיאה.
 *
 * ⚠️ ב-React 19 `<form action>` מאפס את כל השדות בסיום הפעולה — גם
 * כשהיא נכשלה. בלי ההד הזה "מספר טלפון לא תקין" הופיע מול טופס ריק,
 * והמבקר (שבמחשבון כבר עבר שלושה שלבים) היה צריך להקליד הכול מחדש.
 * הטופס מציב את הערכים כ-`defaultValue`, ראה `LeadForm`.
 */
export interface EchoedValues {
  name: string;
  phone: string;
  provider: string;
  message: string;
  consent: boolean;
}

export type LandingState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string; values?: EchoedValues };

function error(message: string, values?: EchoedValues): LandingState {
  return { status: "error", message, values };
}

function echo(formData: FormData): EchoedValues {
  return {
    name: text(formData.get("name")),
    phone: text(formData.get("phone")),
    provider: text(formData.get("provider")),
    message: text(formData.get("message")),
    consent: Boolean(text(formData.get("consent"))),
  };
}

/* ── הגבלת קצב ────────────────────────────────────────────────────────── */

/**
 * חלון מתגלגל לכל כתובת IP.
 *
 * ⚠️ אותה מגבלה מוכרת כמו ב-`api/leads/route.ts`: המונה חי בזיכרון
 * התהליך, ובפריסה serverless לכל אינסטנס מונה משלו. המטרה היא לבלום
 * סקריפט שמפציץ בלולאה, לא להיות מכסה מדויקת.
 */
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_PER_WINDOW = 8;

const hits = new Map<string, number[]>();

/*
 * ⚠️ הבדיקה רצה **אחרי** הוולידציה (ראה `submitLanding`), ולכן שליחה
 * שנדחתה על שם או טלפון אינה נספרת — המגבלה חלה רק על פניות שנוגעות
 * במסד.
 */
function overRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);

  /*
   * ⚠️ חותמת נדחפת רק אם המגבלה **טרם** נחרגה. קודם כל ניסיון נרשם,
   * כולל ניסיון שנחסם, ולכן גולש חסום שמנסה שוב האריך את החלון בעצמו
   * ולא יצא ממנו לעולם. ב-NAT משותף (משרד, CGNAT) זה חסם גולשים
   * שונים לחלוטין על סמך נסיונות של אדם אחר.
   */
  if (recent.length >= RATE_MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  /*
   * ⚠️ ניקוי מפתחות שפגו. המפה צברה ערך לכל IP שאי פעם שלח, לנצח —
   * רק המערך הפנימי סונן, והמפתח עצמו נשאר. באינסטנס ארוך-חיים זו
   * דליפת זיכרון איטית. הניקוי רץ רק כשהמפה גדלה, כדי לא לסרוק
   * אותה בכל שליחה.
   */
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }

  return false;
}

/**
 * כתובת ה-IP של השולח, לפי הכותרת ש-Vercel מציב.
 *
 * ⚠️ `x-forwarded-for` הוא רשימה — הפרוקסי מוסיף לסופה. הערך הראשון
 * הוא הלקוח; לקיחת המחרוזת כולה הייתה יוצרת מפתח מונה חדש בכל פעם
 * שמסלול הרשת משתנה, כלומר הגבלת קצב שלא מגבילה כלום.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown"
  );
}

/* ── נרמול ────────────────────────────────────────────────────────────── */

/**
 * ערך שדה מנוקה. `cleanText` (מ-`lib/domain/interest`) מסיר תווי
 * כיווניות — אותה פונקציה שקליטת ה-API משתמשת בה, כדי ששתי דרכי
 * הכניסה לא ינרמלו טקסט בשתי צורות שונות.
 */
function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? cleanText(value) : "";
}

/**
 * טלפון ישראלי לספרות בלבד, או `null` אם אינו תקין.
 *
 * ⚠️ `normalizeIsraeliPhone` מ-`lib/format` ולא עותק מקומי. הגרסה
 * שהייתה כאן בדקה `startsWith("972")` בלבד, ולכן `00972501234567` —
 * הצורה שיוצאת מייצוא אנשי קשר ומוואטסאפ — נשאר 14 ספרות ונדחה
 * בהודעה "נדרש מספר ישראלי" מול מספר ישראלי לגמרי. היא גם לא ידעה
 * להשלים אפס מוביל חסר (`501234567`), בניגוד לייבוא ה-CSV. שלוש
 * דרכי כניסה למאגר חייבות לנרמל טלפון באותה צורה בדיוק.
 */
function normalizePhone(raw: string): string | null {
  return normalizeIsraeliPhone(raw);
}

const ALLOWED_CATEGORIES = new Set<string>(
  LANDING_CATEGORIES.map((c) => c.key),
);

function parseCategory(raw: string): LeadCategoryKey | null {
  if (!ALLOWED_CATEGORIES.has(raw)) return null;
  return isLeadCategory(raw) ? raw : null;
}

function parseProvider(raw: string): ProviderKey | undefined {
  return isProvider(raw) ? raw : undefined;
}

/* ── יעד הליד ─────────────────────────────────────────────────────────── */

const MAX_NAME = 80;
const MAX_MESSAGE = 500;
/** שם חבילה מהקטלוג. הארוכה ביותר היום היא ~70 תווים. */
const MAX_PACKAGE = 120;
/** חלון הכפילות — פנייה חוזרת של אותו אדם באותו יום אינה ליד שני. */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60_000;

function assigneeEmail(): string {
  return process.env.LANDING_ASSIGNEE_EMAIL?.trim() || DEFAULT_ASSIGNEE_EMAIL;
}

function sourceDetail(): string {
  return process.env.LANDING_SOURCE_DETAIL?.trim() || DEFAULT_SOURCE_DETAIL;
}

/* ── הפעולה ───────────────────────────────────────────────────────────── */

export async function submitLandingLead(
  _prev: LandingState,
  formData: FormData,
): Promise<LandingState> {
  /*
   * ⚠️ שדה הפיתיון נבדק ראשון, ולפני כל נגיעה במסד. הוא מוסתר
   * ב-CSS ואדם לא רואה אותו; בוט שממלא כל `input` בטופס ממלא גם
   * אותו. התשובה היא "נשלח" ולא שגיאה — בוט שמקבל שגיאה מנסה שוב
   * עם וריאציה, ובוט שמקבל הצלחה הולך הלאה.
   */
  const honeypot = text(formData.get("website"));
  if (honeypot) {
    /*
     * ⚠️ בלי הלוג הזה פנייה שנזרקה לא השאירה שום עקבה. השדה נקרא
     * `website` ויש לו `<label>אתר</label>` — מנהל סיסמאות או תוסף
     * מילוי אוטומטי שממלא אותו (`autoComplete="off"` אינו מחייב אותם)
     * מוחק ליד אמיתי, והגולש רואה "קיבלנו!". צריך לדעת אם זה קורה.
     */
    console.warn("[lp] פיתיון נתפס — הפנייה נזרקה", {
      name: text(formData.get("name")).slice(0, MAX_NAME),
      phone: text(formData.get("phone")).slice(0, 20),
    });
    return { status: "sent" };
  }

  // כל שגיאה מכאן והלאה מחזירה גם את מה שהוקלד — ראה `EchoedValues`.
  const values = echo(formData);
  const fail = (message: string) => error(message, values);

  const name = text(formData.get("name"));
  if (name.length < 2) return fail("נא למלא שם מלא");
  if (name.length > MAX_NAME) return fail("השם ארוך מדי");

  const phone = normalizePhone(text(formData.get("phone")));
  if (!phone) return fail("מספר טלפון לא תקין — נדרש מספר ישראלי");

  const category = parseCategory(text(formData.get("category")));
  if (!category) return fail("נא לבחור מה מעניין אותך");

  /*
   * ⚠️ ההסכמה נאכפת **בשרת**. הטופס הוא `noValidate` (ראה `LeadForm`),
   * ולכן ה-`required` של הדפדפן אינו חוסם דבר: עד כאן נוצר ליד חם
   * ויצאה התראת וואטסאפ לנציג בלי שום רישום שהאדם אישר שיתקשרו אליו.
   *
   * ⚠️ אבל היא **נבדקת ואינה נשמרת**: אין ל-`consent` עמודה, הוא אינו
   * נכנס ל-`note`, ואין לו זכר בהיסטוריה. אם לקוח יטען שלא אישר פנייה
   * שיווקית — אין רשומה שמוכיחה אחרת. ההערה הזו קיימת כדי שלא יֵיראה
   * כאילו יש; ההחלטה בין עמודה חדשה לשורת הערה היא של בעל המערכת.
   */
  if (!text(formData.get("consent"))) {
    return fail("יש לאשר יצירת קשר כדי שנוכל לחזור אליכם");
  }

  const currentProvider = parseProvider(text(formData.get("provider")));
  const message = text(formData.get("message")).slice(0, MAX_MESSAGE);

  /*
   * החבילה שהגולש לחץ עליה. יש לה עמודה משלה ב-CRM ולכן היא **לא**
   * נכנסת להערה — כפילות הייתה יוצרת שני מקומות שיכולים להיפרד בעריכה,
   * בדיוק כפי שמתועד ב-`api/leads/route.ts`.
   */
  const packageName = text(formData.get("packageName")).slice(0, MAX_PACKAGE);

  if (overRateLimit(await clientIp())) {
    return fail("נשלחו יותר מדי פניות מהמכשיר הזה. נסו שוב מאוחר יותר.");
  }

  const source = sourceDetail();

  /*
   * כפילות: אותו טלפון, מאותו דף, ב-24 השעות האחרונות.
   *
   * ⚠️ **חלון זמן ולא `findPhones` הגלובלי**, בניגוד ל-`api/leads`.
   * שם כל טלפון שקיים במאגר נחשב כפילות — כאן זה היה בולע פנייה
   * אמיתית של לקוח שכבר דיבר איתנו לפני שנה, והיא לא הייתה מגיעה
   * לאיש. מה שצריך להיחסם הוא לחיצה כפולה על "שליחה", וזה בדיוק
   * מה שהחלון הזה תופס.
   */
  /*
   * ⚠️ מכאן והלאה נוגעים במסד, וכל חריגה כאן **החליפה את כל הדף**
   * במסך שגיאה של Next: המבקר שסיים חישוב, ראה "אפשר לחסוך ₪1,560"
   * והקליד טלפון, איבד את המסך ולא ידע אם הפנייה נשלחה. `LandingState`
   * נבנה בדיוק בשביל הרגע הזה — הטופס נשאר על המסך עם הודעה.
   */
  try {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const recent = await db.leads.list(
      { query: phone, sourceDetail: source, createdFrom: since },
      { field: "createdAt", direction: "desc" },
      { offset: 0, limit: 5 },
    );
    /*
     * ⚠️ השוואה מדויקת, ולא מה ש-`query` החזיר. `query` הוא חיפוש
     * חופשי שמתורגם ל-`contains` על שם, טלפון, אימייל ועיר — ליד קיים
     * שהטלפון שלו מכיל את המספר החדש כתת-מחרוזת (שורת ייבוא עם ספרה
     * עודפת, למשל) היה מסמן פנייה של **אדם אחר** ככפילות, והיא הייתה
     * נעלמת מול הודעת "קיבלנו!". אין ב-`LeadFilter` מסנן טלפון מדויק,
     * ולכן הסינון נעשה כאן — ועל כמה שורות, כדי שהתאמה מזויפת לא
     * תסתיר כפילות אמיתית שמתחתיה.
     */
    const duplicate = recent.rows.find((row) => row.phone === phone);
    if (duplicate) {
      /*
       * ⚠️ הליד כפול — ההערה לא. הגולש שהשאיר פרטים על כרטיס חבילה ואז
       * מילא את המחשבון נופל בדיוק לכאן: הוא רואה "קיבלנו!", והשורה
       * היחידה שהנציג באמת צריך — "משלם היום ₪220 · 3 קווים · חיסכון
       * פוטנציאלי ₪1,560 בשנה" — נבלעה יחד עם הליד הכפול. החלון הזה נועד
       * לחסום לחיצה כפולה על "שליחה", ולחיצה כפולה אינה נושאת מידע חדש;
       * טופס שכן נושא מידע חדש מצרף אותו לליד הקיים.
       *
       * בולעת חריגות: הגולש כבר נחשב "נשלח", ואסור שכשל בהוספת הערה
       * יציג לו שגיאה על פנייה שנקלטה.
       */
      /*
       * ⚠️ "מידע חדש" אינו `message` בלבד. טופס של כרטיס חבילה אינו
       * כולל שדה הודעה כלל (`LeadForm` מציג `textarea` רק כשאין חבילה
       * ואין הערה), ולכן מבקר שמילא את המחשבון ואז לחץ "שיחזרו אליי"
       * על כרטיס של חבילה אחרת — השדה היחיד שהטופס השני נושא — קיבל
       * "קיבלנו!" בזמן ששם החבילה שהוא באמת בחר נזרק בלי שום עקבה.
       * שם חבילה שונה מזה שרשום על הליד הוא בדיוק המידע שהנציג צריך.
       */
      const notes: string[] = [];
      if (message && !duplicate.notes.some((n) => n.body === message)) {
        notes.push(message);
      }
      if (packageName && packageName !== duplicate.packageName) {
        const line = `התעניין גם ב: ${packageName}`;
        if (!duplicate.notes.some((n) => n.body === line)) notes.push(line);
      }
      if (notes.length > 0) {
        /*
         * בולעת חריגות: הגולש כבר נחשב "נשלח", ואסור שכשל בהוספת הערה
         * יציג לו שגיאה על פנייה שנקלטה.
         */
        try {
          const author = duplicate.assigneeId ?? duplicate.createdById;
          if (author) {
            for (const body of notes) {
              await db.leads.addNote(duplicate.id, author, body);
            }
          }
        } catch (err) {
          console.warn("[lp] הוספת הערה לליד כפול נכשלה", err);
        }
      }
      return { status: "sent" };
    }

    /*
     * הנמען. ⚠️ עובד מושבת נחשב "לא נמצא": ליד ששויך לחשבון שאינו
     * פעיל אינו גלוי לאיש — לא לו, כי אינו נכנס, ולא להנהלה, שרואה
     * את המאגר הלא-משויך. עדיף לידים ללא שיוך על לידים שנעלמו.
     */
    const assignee = await db.users.getByEmail(assigneeEmail());
    // ⚠️ כתובת שהוגדרה ואינה קיימת היא טעות הקלדה, לא מצב תקין. בלי
    // השורה הזו היא נראית בדיוק כמו "אין יעד מוגדר" — הליד נשמר בלי
    // שיוך ואיש לא יודע למה.
    /*
     * ⚠️ `error` ולא `warn`, והנוסח אומר את המחיר המלא: בלי נמען פעיל
     * `assigneeId` נשאר `undefined`, ואז `notifyHotLeadAssigned` יוצאת
     * מיד ב-`if (!input.assigneeId) return` — כלומר אפס וואטסאפ ואפס
     * מייל, בזמן שהגולש קיבל "קיבלנו! נציג יחזור אליך". הליד עצמו כן
     * נשמר וגלוי במאגר הלא-משויך, ולכן זו אינה אבדה — אבל אף אחד לא
     * מקבל דחיפה אליו, וזה חייב לצעוק בלוג.
     */
    if (!assignee || !assignee.active) {
      console.error(
        `[lp] יעד השיוך ${assigneeEmail()} ${assignee ? "מושבת" : "לא נמצא"} — הליד נשמר ללא שיוך ובלי שאף התראה יוצאת`,
      );
    }
    /*
     * ⚠️ כלל יאס גובר גם על היעד הקבוע של דף הנחיתה. ליד של יאס הולך
     * לעובד שמטפל ביאס — זה מה שנקבע, וההחרגה של דף הנחיתה הייתה
     * מייצרת מסלול שקט שבו לידים של יאס נוחתים אצל מישהו אחר.
     */
    const yesFacts = { currentProvider, packageName, sourceDetail: source };
    const assigneeId = await assigneeForIncoming(
      yesFacts,
      assignee?.active ? assignee.id : undefined,
    );

    /*
     * `createdById` הוא מפתח זר חובה. הנמען הוא גם היוצר הטבעי כאן —
     * זה הדף שלו. כשהוא חסר נופלים לבעלים, בדיוק כמו `api/leads`.
     */
    let createdById = assigneeId;
    if (!createdById) {
      const users = await db.users.listActive();
      createdById = (users.find((u) => u.role === "owner") ?? users[0])?.id;
    }
    if (!createdById) {
      return fail("שגיאה זמנית בשמירת הפנייה. נסו שוב בעוד רגע.");
    }

    const lead = await db.leads.create({
      name,
      phone,
      // ליד שמילא טופס מרצונו הוא ליד חם, לא רשומת דאטה
      kind: "hot",
      priority: "normal",
      category,
      currentProvider,
      // `source` אומר **איך** נקלט (טופס), `sourceDetail` אומר **ממה**
      source: "form",
      sourceDetail: source,
      packageName: packageName || undefined,
      note: message || undefined,
      assigneeId,
      createdById,
    });

    // ⚠️ אחרי היצירה, ובולעת חריגות בעצמה: הגולש שלחץ "שליחה" לא
    // אמור לראות שגיאה בגלל הודעה פנימית שלא יצאה.
    if (isYesLead(yesFacts)) {
      await notifyOwnersOfYesLead({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        assigneeId,
      });
    }

    await notifyHotLeadAssigned({
      lead: { id: lead.id, name: lead.name, phone: lead.phone, kind: lead.kind },
      assigneeId,
    });

    revalidatePath("/leads");
    return { status: "sent" };
  } catch (err) {
    console.error("[lp] שמירת הליד נכשלה", err);
    return fail("שגיאה זמנית בשמירת הפנייה. נסו שוב בעוד רגע.");
  }
}
