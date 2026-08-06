/**
 * מודל הדומיין של ONE STOP CRM.
 *
 * זהו מקור האמת היחיד לתוויות, צבעים וסדר של סטטוסים, סוגים ותפקידים.
 * כל תווית בעברית מוגדרת כאן ולא בקומפוננטות.
 */

/* ── מזהים ────────────────────────────────────────────────────────────── */

export type LeadId = string;
export type UserId = string;
export type PackageId = string;
export type DealId = string;
export type RegistrationId = string;

/* ── תפקידים והרשאות ──────────────────────────────────────────────────── */

export type Role =
  | "owner" // מנהל ראשי
  | "manager" // מנהל
  | "agent" // סוכן
  | "employee" // עובד — התפקיד שרוב המשתמשים בפועל נושאים
  | "operator" // מתפעל
  | "shopOwner" // בעל חנות
  | "bizManager"; // מנהל עסק

export const ROLE_CONFIG: Record<Role, { label: string; rank: number }> = {
  owner: { label: "מנהל ראשי", rank: 100 },
  manager: { label: "מנהל", rank: 80 },
  bizManager: { label: "מנהל עסק", rank: 60 },
  shopOwner: { label: "בעל חנות", rank: 50 },
  operator: { label: "מתפעל", rank: 30 },
  agent: { label: "סוכן", rank: 10 },
  employee: { label: "עובד", rank: 10 },
};

export const ROLE_ORDER: Role[] = [
  "owner",
  "manager",
  "bizManager",
  "shopOwner",
  "operator",
  "agent",
  "employee",
];

/* ── סטטוס ליד ────────────────────────────────────────────────────────── */

export type LeadStatus =
  | "new" // חדש
  | "recycled" // ממחזור
  | "inProgress" // בטיפול
  | "contacted" // נוצר קשר
  | "quoteSent" // הצעה נשלחה
  | "awaitingClient" // ממתין ללקוח
  | "followUp" // חיזור
  | "futureTracking" // חזרה ללקוח
  | "won" // נסגר בהצלחה
  | "notRelevant" // לא רלוונטי
  | "notInterested" // לא מעוניין
  | "existingCustomer" // לקוח קיים
  | "noAnswer" // אין מענה
  | "noAnswer1" // אין מענה 1
  | "noAnswer2" // אין מענה 2
  | "returning" // ליד חוזר
  | "soldByCompetitor" // נמכר ע״י משווק מקביל
  | "denies" // מתכחש לפנייה
  | "lost"; // הפסד

/**
 * `tone` ממופה לטוקן צבע סמנטי ב-globals.css, לא לצבע קשיח.
 * `prompt` הוא מה שנשאל את הסוכן כשהוא בוחר בסטטוס — המערכת המקורית
 * דורשת פירוט בכל מעבר, וזה מה שהופך את היסטוריית הליד לשימושית.
 */
/*
 * ⚠️ תשעה גוונים ל-19 סטטוסים, ולא שישה.
 *
 * הגרסה הקודמת החזיקה שישה, ומתוכם `info` ו-`active` היו **אותו hex
 * בדיוק** — כלומר חמישה סטטוסים פעילים ("חדש", "ממחזור", "נוצר קשר",
 * "בטיפול", "הצעה נשלחה") נצבעו בשני כחולים שאי אפשר להבחין ביניהם,
 * ושישה סטטוסים נוספים חלקו כתום אחד. במסך של 19 אריחים זה קורא
 * כאילו אין צבע בכלל.
 *
 * `signal` היה מוגדר ב-globals.css מההתחלה ואף אחד לא השתמש בו.
 * `accent` ו-`rose` נוספו, ו-`info` הוזז לאינדיגו.
 */
export type StatusTone =
  | "neutral"
  | "info"
  | "active"
  | "warn"
  | "good"
  | "bad"
  | "signal"
  | "accent"
  | "rose";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** האם הסטטוס סוגר את הליד (לא יופיע בתור העבודה הפתוח) */
  terminal: boolean;
  /** שאלת ההמשך שתוצג לסוכן, אם יש */
  prompt?: { question: string; placeholder: string; required: boolean };
}

export const STATUS_CONFIG: Record<LeadStatus, StatusMeta> = {
  new: {
    label: "חדש",
    tone: "info",
    terminal: false,
  },
  /**
   * ליד שנוצר ממסמך חידוש — לקוח עבר שהשנה שלו הסתיימה.
   *
   * בלי `prompt`, כמו `new`: זה מצב פתיחה שנוצר אוטומטית ולא בחירה
   * שסוכן עושה, ואין לו על מה לדווח ברגע היצירה.
   */
  recycled: {
    label: "ממחזור",
    tone: "rose",
    terminal: false,
  },
  inProgress: {
    label: "בטיפול",
    tone: "active",
    terminal: false,
    prompt: {
      question: "פרט מה בוצע",
      placeholder: "מה עשית עד כה...",
      required: true,
    },
  },
  contacted: {
    label: "נוצר קשר",
    tone: "signal",
    terminal: false,
    prompt: {
      question: "סיכום השיחה",
      placeholder: "עם מי דיברת, מה סוכם...",
      required: true,
    },
  },
  quoteSent: {
    label: "הצעה נשלחה",
    tone: "accent",
    terminal: false,
    prompt: {
      question: "פרטי ההצעה",
      placeholder: "איזו הצעה נשלחה, מחיר...",
      required: true,
    },
  },
  awaitingClient: {
    label: "ממתין ללקוח",
    tone: "warn",
    terminal: false,
    prompt: {
      question: "ממתין למה?",
      placeholder: "ממתין לאישור, לתשובה...",
      required: true,
    },
  },
  followUp: {
    label: "חיזור",
    tone: "warn",
    terminal: false,
    prompt: {
      question: "מתי לחזור?",
      placeholder: "תאריך / תקופה לחזרה...",
      required: true,
    },
  },
  /*
   * ⚠️ המפתח `futureTracking` נשאר למרות שהתווית היא "חזרה ללקוח".
   *
   * שינוי המפתח היה דורש `ALTER TYPE` על ה-enum ב-Postgres, וסדר
   * ההצהרה שם הוא סדר המיון שה-repository נשען עליו (ראה ההערה מעל
   * `enum LeadStatus` ב-schema.prisma). זו פעולה שכבר שברה לנו את
   * מיון הסטטוסים פעם אחת. תווית היא מחרוזת תצוגה, ואין שום סיבה
   * לשלם עליה במיגרציה.
   */
  futureTracking: {
    label: "חזרה ללקוח",
    tone: "signal",
    terminal: false,
    prompt: {
      question: "מתי לחזור ללקוח?",
      placeholder: "מתי ולמה לחזור",
      required: true,
    },
  },
  won: {
    label: "נסגר בהצלחה",
    tone: "good",
    terminal: true,
    prompt: {
      question: "מה נמכר?",
      placeholder: "חבילה, חברה, סכום...",
      required: true,
    },
  },
  notRelevant: {
    label: "לא רלוונטי",
    tone: "neutral",
    terminal: true,
    prompt: {
      question: "למה לא רלוונטי?",
      placeholder: "לא בתחום, כפול...",
      required: true,
    },
  },
  notInterested: {
    label: "לא מעוניין",
    tone: "bad",
    terminal: true,
    prompt: {
      question: "סיבת הסירוב",
      placeholder: "יקר, לא צריך, יש ספק...",
      required: true,
    },
  },
  existingCustomer: {
    label: "לקוח קיים",
    tone: "neutral",
    terminal: true,
    prompt: {
      question: "פרטים נוספים",
      placeholder: "כבר לקוח אצלנו, אצל איזה ספק...",
      required: false,
    },
  },
  noAnswer: {
    label: "אין מענה",
    tone: "warn",
    terminal: false,
    prompt: {
      question: "כמה ניסיונות?",
      placeholder: "מספר ניסיונות חיוג",
      required: false,
    },
  },
  // שני השלבים הבאים בסולם — ניסיון חיוג שני ושלישי שגם הם לא נענו.
  // סטטוסים מפורשים ולא מונה אוטומטי: קל יותר לבחור מהרשימה, וקל
  // יותר לקרוא בהיסטוריה של הליד "עבר ל-אין מענה 2" מאשר מספר סתום.
  noAnswer1: {
    label: "אין מענה 1",
    tone: "warn",
    terminal: false,
  },
  noAnswer2: {
    label: "אין מענה 2",
    tone: "warn",
    terminal: false,
  },
  returning: {
    label: "ליד חוזר",
    tone: "accent",
    terminal: false,
    prompt: {
      question: "למה חזר?",
      placeholder: "רוצה הצעה חדשה, שינה ספק...",
      required: true,
    },
  },
  soldByCompetitor: {
    label: "נמכר ע״י משווק מקביל",
    tone: "bad",
    terminal: true,
    prompt: {
      question: "מי המשווק?",
      placeholder: "שם המשווק המקביל, אם ידוע...",
      required: false,
    },
  },
  denies: {
    label: "מתכחש לפנייה",
    tone: "bad",
    terminal: true,
    prompt: {
      question: "פרטי ההתכחשות",
      placeholder: "טוען שלא פנה, לא מכיר...",
      required: true,
    },
  },
  lost: {
    label: "הפסד",
    tone: "bad",
    terminal: true,
    prompt: {
      question: "מה קרה?",
      placeholder: "הלך למתחרה, ביטל...",
      required: true,
    },
  },
};

/**
 * סדר התצוגה בסרגלי סינון ובתפריטי שינוי סטטוס.
 *
 * הבסיס הוא סדר הסטטוסים האמיתי שאומת מול המערכת החיה (13 סטטוסים,
 * עם ספירות שסוכמות בדיוק לכלל הלידים). `followUp` ו-`lost` לא הופיעו
 * ברשימה החיה שנצפתה, אך לא הוסרו — אין הוכחה שהם לא קיימים במקום אחר
 * במערכת האמיתית, ומחיקתם הייתה רגרסיה בלי הצדקה. הם משובצים כאן ליד
 * השכנים הסמנטיים שלהם. `existingCustomer`, `noAnswer1` ו-`noAnswer2`
 * נוספו מאוחר יותר (17 היום).
 */
export const STATUS_ORDER: LeadStatus[] = [
  "new",
  "recycled",
  "inProgress",
  "contacted",
  "quoteSent",
  "awaitingClient",
  "followUp",
  "futureTracking",
  "won",
  "notRelevant",
  "notInterested",
  "existingCustomer",
  "noAnswer",
  "noAnswer1",
  "noAnswer2",
  "returning",
  "soldByCompetitor",
  "denies",
  "lost",
];

export const OPEN_STATUSES: LeadStatus[] = STATUS_ORDER.filter(
  (s) => !STATUS_CONFIG[s].terminal,
);

/* ── סוג ליד ──────────────────────────────────────────────────────────── */

/**
 * שני ערכים בלבד — תואם לטופס ההוספה האמיתי, שהוא toggle דו-כיווני.
 * "ליד חוזר" אינו סוג ליד — הוא סטטוס (ראה `STATUS_CONFIG.returning`).
 */
export type LeadKind = "hot" | "data";

export const KIND_CONFIG: Record<
  LeadKind,
  {
    label: string;
    /** ריבוי — לכותרות שסופרות ("לידים חמים · 24"), לא לתגית על שורה */
    plural: string;
    short: string;
    tone: StatusTone;
    emptyState: string;
  }
> = {
  hot: {
    label: "ליד חם",
    plural: "לידים חמים",
    short: "חם",
    tone: "bad",
    emptyState: "אין לידים חמים עדיין",
  },
  data: {
    label: "ליד מדאטה",
    plural: "לידים מדאטה",
    short: "דאטה",
    tone: "info",
    emptyState: "אין לידים מדאטה עדיין",
  },
};

export const KIND_ORDER: LeadKind[] = ["hot", "data"];

/* ── עדיפות ───────────────────────────────────────────────────────────── */

export type Priority = "normal" | "high" | "urgent";

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; tone: StatusTone; weight: number }
> = {
  normal: { label: "רגיל", tone: "neutral", weight: 0 },
  high: { label: "גבוה", tone: "warn", weight: 1 },
  urgent: { label: "דחוף", tone: "bad", weight: 2 },
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal"];

/* ── מקור הליד ────────────────────────────────────────────────────────── */

export type LeadSource = "manual" | "import" | "form" | "campaign" | "referral";

/**
 * ⚠️ `tone` נוסף כדי שהמקור יהיה **נראה** ולא טקסט אפור בקצה השורה.
 *
 * מאיפה הליד הגיע משנה את השיחה: הפניה מלקוח מרוצה ופנייה מטופס אינן
 * אותו חיוג. עד כה ה-enum הזה הוצג רק כשלא היה `sourceDetail`, כלומר
 * דווקא בלידים שהגיעו מקמפיין — היחידים שבהם יש פירוט — ערוץ המקור
 * נעלם לגמרי מהמסך.
 */
export const SOURCE_CONFIG: Record<LeadSource, { label: string; tone: StatusTone }> = {
  manual: { label: "ידני", tone: "neutral" },
  import: { label: "ייבוא", tone: "info" },
  form: { label: "טופס רישום", tone: "signal" },
  campaign: { label: "קמפיין", tone: "accent" },
  referral: { label: "הפניה", tone: "good" },
};

/* ── ישויות ───────────────────────────────────────────────────────────── */

export interface User {
  id: UserId;
  name: string;
  role: Role;
  email: string;
  phone?: string;
  active: boolean;
  /** שם העסק/החנות המשויכת, אם יש. שדה חופשי — אין עדיין ישות Store נפרדת. */
  store?: string;
  /** תפוגת מנוי — המערכת המקורית מתריעה עליה */
  subscriptionEndsAt?: string;
}

export interface LeadNote {
  id: string;
  leadId: LeadId;
  authorId: UserId;
  body: string;
  createdAt: string;
}

/**
 * רשומת שינוי סטטוס. כל מעבר נשמר עם הפירוט שהסוכן הזין,
 * כך שאפשר לשחזר את סיפור הליד במלואו.
 */
export interface LeadStatusEvent {
  id: string;
  leadId: LeadId;
  from: LeadStatus | null;
  to: LeadStatus;
  detail?: string;
  actorId: UserId;
  createdAt: string;
}

/**
 * פעולה על הליד שאינה שינוי סטטוס.
 *
 * `LeadStatusEvent` עונה על "מה הסטטוס עשה"; זה עונה על "מה נעשה לליד" —
 * מי יצר אותו, למי הוא הועבר, מתי העלות שונתה.
 */
export type LeadActivityType =
  | "created"
  | "assigned"
  | "unassigned"
  | "imported"
  | "costChanged"
  | "starred"
  | "unstarred";

export interface LeadActivityEvent {
  id: string;
  leadId: LeadId;
  type: LeadActivityType;
  detail?: string;
  /** היעד של הפעולה, כשרלוונטי (למשל העובד שהליד שויך אליו) */
  targetUserId?: UserId;
  actorId: UserId;
  createdAt: string;
}

/**
 * הניסוח של כל סוג פעולה. `target` הוא שם העובד שהפעולה מכוונת אליו,
 * כבר מפוענח — הרכיב לא צריך לדעת איך לגשת למשתמשים.
 */
export const ACTIVITY_CONFIG: Record<
  LeadActivityType,
  { tone: StatusTone; text: (target?: string) => string }
> = {
  created: { tone: "info", text: () => "הליד נוצר" },
  imported: { tone: "info", text: () => "יובא מקובץ" },
  assigned: {
    tone: "active",
    text: (target) => (target ? `שויך ל${target}` : "שויך"),
  },
  unassigned: { tone: "neutral", text: () => "השיוך הוסר" },
  costChanged: { tone: "warn", text: () => "העלות עודכנה" },
  starred: { tone: "warn", text: () => "סומן" },
  unstarred: { tone: "neutral", text: () => "הסימון הוסר" },
};

export interface Lead {
  id: LeadId;
  name: string;
  phone: string;
  email?: string;
  kind: LeadKind;
  status: LeadStatus;
  priority: Priority;
  source: LeadSource;
  /** קטגוריית העניין של הליד — מפתח מתוך LEAD_CATEGORY_CONFIG */
  category?: LeadCategoryKey;
  /** הספק הנוכחי של הלקוח, אם ידוע */
  currentProvider?: ProviderKey;
  /**
   * עלות רכישת הליד. `undefined` = לא הוגדר, לוקחים את עלות הקטגוריה;
   * `0` = הליד היה חינם. ההבחנה הזו היא הסיבה שהשדה אופציונלי ולא 0.
   */
  cost?: number;
  isStarred: boolean;
  /**
   * מאיפה הליד הגיע, בטקסט חופשי — שם קמפיין, חבילה או ספק.
   * `source` אומר *איך* הוא נקלט (ידני/ייבוא/טופס); זה אומר *ממה*.
   */
  sourceDetail?: string;
  /**
   * החבילה שהלקוח התעניין בה, בטקסט חופשי ("500GB 5G Together").
   * לא מקושר לקטלוג — ראה ההסבר ב-schema.prisma.
   */
  packageName?: string;
  assigneeId?: UserId;
  createdById: UserId;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
  /** מתי לחזור — נגזר מסטטוס חיזור / חזרה ללקוח */
  followUpAt?: string;
  city?: string;
  notes: LeadNote[];
  history: LeadStatusEvent[];
  activity: LeadActivityEvent[];
}

/** פתיח ההודעה שנשלחת ללקוח בוואטסאפ מתוך הטבלה או המגירה. */
export function whatsappGreeting(name: string): string {
  return `שלום ${name}, פונה אליך מ-ONE STOP בהמשך לפנייתך. איך אוכל לעזור?`;
}

/* ── ייבוא לידים: זיהוי כותרות ────────────────────────────────────────── */

/** שדה בקובץ ייבוא שאנחנו יודעים למפות אליו עמודה. */
export type LeadImportField =
  | "name"
  | "phone"
  | "email"
  | "city"
  | "category"
  | "note"
  | "sourceDetail"
  | "packageName"
  | "provider"
  | "externalId";

/**
 * כותרות מוכרות בקבצי ייבוא, בעברית ובאנגלית.
 *
 * המפתחות כאן כבר מנורמלים (אותיות קטנות, בלי רווחים/מקפים) — אל תחפש
 * בהם ישירות, קרא ל-`matchImportField` כדי שהנרמול יישאר במקום אחד.
 */
const LEAD_IMPORT_HEADER_ALIASES: Record<string, LeadImportField> = {
  שם: "name",
  שםמלא: "name",
  שםהלקוח: "name",
  שםלקוח: "name",
  name: "name",
  fullname: "name",

  טלפון: "phone",
  נייד: "phone",
  מספרטלפון: "phone",
  // הנרמול מסיר רווחים, מקפים וגרשיים — כך ש"מס' סלולרי" מגיע לכאן
  // כ"מססלולרי". הכינויים האלה מופיעים בקבצים אמיתיים של שותפים.
  סלולרי: "phone",
  מססלולרי: "phone",
  מסטלפון: "phone",
  טלפוןנייד: "phone",
  מספרנייד: "phone",
  phone: "phone",
  mobile: "phone",
  tel: "phone",
  cell: "phone",

  אימייל: "email",
  מייל: "email",
  // כל כתיבי "דוא״ל" מתכווצים לזה — הנרמול מסיר גרשיים
  דואל: "email",
  email: "email",
  mail: "email",

  עיר: "city",
  ישוב: "city",
  יישוב: "city",
  city: "city",

  קטגוריה: "category",
  תחום: "category",
  category: "category",

  הערה: "note",
  הערות: "note",
  note: "note",
  notes: "note",
  comment: "note",

  מקור: "sourceDetail",
  קמפיין: "sourceDetail",
  source: "sourceDetail",
  campaign: "sourceDetail",

  // "חבילה" מיפתה קודם ל-sourceDetail, כשלא היה שדה חבילה נפרד.
  // עכשיו יש, וזה המקום הנכון שלה.
  חבילה: "packageName",
  שםחבילה: "packageName",
  מסלול: "packageName",
  שםמסלול: "packageName",
  תוכנית: "packageName",
  תכנית: "packageName",
  package: "packageName",
  packagename: "packageName",
  packagetitle: "packageName",
  plan: "packageName",

  // הספק שהלקוח נמצא אצלו היום. בקבצים של השותף העמודה נקראת
  // "שם חברה", ולכן היא כאן ולא רק "ספק".
  ספק: "provider",
  חברה: "provider",
  שםחברה: "provider",
  ספקנוכחי: "provider",
  provider: "provider",
  company: "provider",
  carrier: "provider",

  // מזהה הליד במערכת של השותף. אין לו עמודה משלנו — הוא נשמר בהערה,
  // כדי שאפשר יהיה להצליב ליד מול המקור שלו.
  "#": "externalId",
  מזהה: "externalId",
  מזההליד: "externalId",
  מספרליד: "externalId",
  id: "externalId",
  leadid: "externalId",
  externalid: "externalId",
};

/**
 * מזהה לאיזה שדה שייכת כותרת עמודה, או `undefined` אם היא לא מוכרת.
 * מחזיר `undefined` גם עבור מחרוזת ריקה.
 */
export function matchImportField(header: string): LeadImportField | undefined {
  // מסירים גם גרשיים וגרש (רגילים ועבריים) כדי ש"דוא״ל" / "דוא'ל" / "דואל"
  // ייפלו כולם על אותו מפתח
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.'"׳״]/g, "");
  if (!normalized) return undefined;
  return LEAD_IMPORT_HEADER_ALIASES[normalized];
}

/** תווית עברית → מפתח קטגוריית ליד, לשימוש בייבוא. */
export function matchLeadCategory(label: string): LeadCategoryKey | undefined {
  const normalized = label.trim();
  if (!normalized) return undefined;
  // `in` היה מחזיר true גם עבור "constructor"/"__proto__" ומזריק ערך
  // לא חוקי לייבוא. `LEAD_CATEGORY_ORDER` הוא הרשימה הסגורה האמיתית.
  if (isLeadCategory(normalized)) return normalized;
  return LEAD_CATEGORY_ORDER.find(
    (k) => LEAD_CATEGORY_CONFIG[k].label === normalized,
  );
}

/* ── קטגוריית ליד ─────────────────────────────────────────────────────── */

/**
 * קטגוריית עניין של ליד. **שונה** מ-`CategoryKey` (קטגוריית חבילה) —
 * הטופס האמיתי להוספת ליד חושף 6 ערכים שאינם זהים לקטגוריות הקטלוג:
 * יש כאן "כללי" (ברירת מחדל כשלא ידוע מה מעניין את הלקוח), ואין כאן
 * "סיבים" (זו קטגוריית מוצר, לא קטגוריית עניין של ליד).
 */
export type LeadCategoryKey =
  | "mobile"
  | "internet"
  | "tv"
  | "triple"
  | "electricity"
  | "general"
  | "recycled";

/**
 * ⚠️ `tone` נוסף כדי שהקטגוריה תהיה **נראית**.
 *
 * עד עכשיו הרשומה הייתה `{ label }` בלבד, והקטגוריה רוּנדרה כטקסט אפור
 * בתוך שורת מטא — כלומר שדה שקיים, מסונן ולא נקרא. "סלולר" מול "חשמל"
 * הוא ההבדל בין שתי שיחות שונות לגמרי, והוא היה בלתי נראה בסריקה.
 */
export const LEAD_CATEGORY_CONFIG: Record<
  LeadCategoryKey,
  { label: string; tone: StatusTone }
> = {
  mobile: { label: "סלולר", tone: "info" },
  internet: { label: "אינטרנט", tone: "signal" },
  tv: { label: "טלוויזיה", tone: "accent" },
  triple: { label: "טריפל", tone: "active" },
  electricity: { label: "חשמל", tone: "warn" },
  general: { label: "כללי", tone: "neutral" },
  /**
   * ⚠️ לא קטגוריית מוצר אלא **מקור**: הליד הגיע ממסמך חידוש של לקוח
   * עבר. הוא יושב באותה רשימה כי כך אפשר לסנן אליו במסך הלידים בלי
   * ציר סינון נוסף — אבל הוא לא מתאר במה הלקוח מתעניין, ולכן אחרון.
   */
  recycled: { label: "ממחזור", tone: "rose" },
};

export const LEAD_CATEGORY_ORDER: LeadCategoryKey[] = [
  "mobile",
  "internet",
  "tv",
  "triple",
  "electricity",
  "general",
  "recycled",
];

/* ── קטלוג: ספקים וקטגוריות חבילה ─────────────────────────────────────── */

export type ProviderKey =
  | "bezeq"
  | "hot"
  | "yes"
  | "cellcom"
  | "partner"
  | "pelephone"
  | "golan"
  | "ibc";

export const PROVIDER_CONFIG: Record<
  ProviderKey,
  { label: string; accent: string }
> = {
  bezeq: { label: "בזק", accent: "#1B7FD4" },
  hot: { label: "הוט", accent: "#E4002B" },
  yes: { label: "יס", accent: "#7A2FF2" },
  cellcom: { label: "סלקום", accent: "#00A0DF" },
  partner: { label: "פרטנר", accent: "#00B8A9" },
  pelephone: { label: "פלאפון", accent: "#0057B8" },
  golan: { label: "גולן", accent: "#F5A623" },
  ibc: { label: "IBC", accent: "#5B6BF5" },
};

export const PROVIDER_ORDER: ProviderKey[] = [
  "bezeq",
  "hot",
  "yes",
  "cellcom",
  "partner",
  "pelephone",
  "golan",
  "ibc",
];

/**
 * קטגוריית חבילה בקטלוג. **שונה** מ-`LeadCategoryKey` — ראה הערה שם.
 * "סיבים" קיים כאן (זו תשתית מוצר אמיתית בקטלוג); "כללי" לא קיים כאן
 * (כל חבילה שייכת לקטגוריית מוצר קונקרטית).
 */
export type CategoryKey =
  | "internet"
  | "mobile"
  | "tv"
  | "triple"
  | "fiber"
  | "electricity";

export const CATEGORY_CONFIG: Record<CategoryKey, { label: string }> = {
  internet: { label: "אינטרנט" },
  mobile: { label: "סלולר" },
  tv: { label: "טלוויזיה" },
  triple: { label: "טריפל" },
  fiber: { label: "סיבים" },
  electricity: { label: "חשמל" },
};

export const CATEGORY_ORDER: CategoryKey[] = [
  "internet",
  "mobile",
  "tv",
  "triple",
  "fiber",
  "electricity",
];

/* ── חבילות ───────────────────────────────────────────────────────────── */

/**
 * שדה יחיד בתוך `Package.spec` — ערך שמשתנה לפי קטגוריה (ג'יגה, מהירות
 * הורדה, אחוז הנחה וכו'). `PACKAGE_SPEC_FIELDS` הוא מקור האמת היחיד
 * לאילו שדות שייכים לכל קטגוריה ובאיזה סדר להציג אותם — כך שרינדור
 * כרטיס/טבלת חבילה הוא איטרציה על הקונפיג, לא JSX מותנה-קטגוריה.
 */
export interface PackageSpecField {
  key: string;
  label: string;
  unit?: string;
}

export const PACKAGE_SPEC_FIELDS: Record<CategoryKey, PackageSpecField[]> = {
  mobile: [
    { key: "networkGen", label: "סוג חבילה" },
    { key: "dataGb", label: "ג׳יגה", unit: "GB" },
    { key: "callMinutes", label: "דקות שיחה" },
    { key: "sms", label: "הודעות SMS" },
    { key: "abroadCallMinutes", label: "דקות מהארץ לחו״ל" },
    { key: "callsAbroad", label: "שיחות בחו״ל" },
    { key: "dataAbroad", label: "גלישה בחו״ל" },
    { key: "smsAbroad", label: "הודעות בחו״ל" },
    { key: "esim", label: "eSIM" },
    { key: "commitmentPeriod", label: "תוקף חבילה" },
    { key: "priceAfterCommitment", label: "מחיר אחרי תוקף" },
    { key: "multiLine", label: "מנויים" },
  ],
  internet: [
    { key: "infraIncluded", label: "תשתית כלולה" },
    { key: "downloadSpeed", label: "מהירות הורדה" },
    { key: "uploadSpeed", label: "מהירות העלאה" },
    { key: "router", label: "נתב" },
    { key: "installation", label: "התקנה" },
    { key: "commitmentPeriod", label: "תקופת התחייבות" },
    { key: "promoPrice", label: "מחיר מבצע" },
  ],
  fiber: [
    { key: "downloadSpeed", label: "מהירות הורדה" },
    { key: "uploadSpeed", label: "מהירות העלאה" },
    { key: "router", label: "נתב" },
    { key: "rangeExtender", label: "מגדיל טווח" },
    { key: "installation", label: "התקנה" },
    { key: "promoPrice", label: "מחיר מבצע" },
  ],
  tv: [
    { key: "included", label: "מה כלול" },
    { key: "userCount", label: "כמות יוזרים" },
    { key: "installation", label: "התקנה והתחברות" },
    { key: "commitmentPeriod", label: "תוקף חבילה" },
    { key: "priceAfterCommitment", label: "מחיר אחרי תוקף" },
    { key: "promoPrice", label: "מחיר מבצע" },
  ],
  triple: [
    { key: "downloadSpeed", label: "מהירות הורדה" },
    { key: "uploadSpeed", label: "מהירות העלאה" },
    { key: "router", label: "נתב" },
    { key: "rangeExtender", label: "מגדיל טווח" },
    { key: "tvIncluded", label: "טלוויזיה כלולה" },
    { key: "streamers", label: "סטרימרים/ממירים" },
    { key: "installBuilding", label: "התקנה בבניין" },
    { key: "installApartment", label: "התקנה בדירה" },
    { key: "promoPrice", label: "מחיר מבצע" },
  ],
  electricity: [
    { key: "discountPercent", label: "אחוז הנחה" },
    { key: "discountHours", label: "שעות ההנחה" },
    { key: "discountDays", label: "ימי ההנחה" },
    { key: "savingsTiers", label: "מדרגות חיסכון" },
    { key: "smartMeter", label: "מונה חכם" },
  ],
};

export interface Package {
  id: PackageId;
  name: string;
  provider: ProviderKey;
  category: CategoryKey;
  /**
   * מחיר חודשי ללקוח בשקלים. `null` לחבילות חשמל — אין להן מחיר קבוע,
   * רק אחוזי הנחה (ראה `spec.discountPercent`).
   */
  price: number | null;
  /** עמלת סגירה שהמשווק מקבל. תמיד מספר, גם לחשמל — זה מה שמזין את המכפיל. */
  commission: number;
  /**
   * שדות שמשתנים לפי קטגוריה, לפי `PACKAGE_SPEC_FIELDS[category]`.
   * ⚠️ לא מוצג ולא ידוע מה השדות/ערכים המדויקים בכל שורה עד שהקטלוג
   * האמיתי מוזן (ראה catalog.ts) — כאן רק הצורה.
   */
  spec: Record<string, string | number | boolean>;
  description?: string;
  active: boolean;
}

/* ── עסקאות ────────────────────────────────────────────────────────────── */

/**
 * שלבי מעקב הזמנה. אומת מול מסך "העסקאות שלי" האמיתי — סטפר רב-שלבי,
 * לא רק סטטוס יחיד. שלושת שלבי ה"ממתין ל-" תלויי-קטגוריה
 * (ראה `STAGE_PIPELINE_FOR_CATEGORY`): משלוח/ניוד שייכים לסלולר,
 * התקנה שייכת לאינטרנט/טלוויזיה/טריפל.
 */
export type DealStage =
  | "new" // חדש
  | "sentToAktiv" // נשלח לאקטוב
  | "inProgress" // בטיפול
  | "apiProcess" // תהליך API
  | "registered" // רשום
  | "awaitingShipment" // ממתין למשלוח
  | "awaitingPorting" // ממתין להפעלת ניודים
  | "awaitingInstall" // ממתין להתקנה
  | "active" // פעיל
  | "approved" // עסקה אושרה
  | "rejected" // נדחה
  | "cancelled"; // בוטל

export interface DealStageMeta {
  label: string;
  tone: StatusTone;
  /** האם השלב סוגר את מעקב ההזמנה (הצלחה או כישלון כאחד) */
  terminal: boolean;
}

export const DEAL_STAGE_CONFIG: Record<DealStage, DealStageMeta> = {
  new: { label: "חדש", tone: "info", terminal: false },
  sentToAktiv: { label: "נשלח לאקטוב", tone: "info", terminal: false },
  inProgress: { label: "בטיפול", tone: "active", terminal: false },
  apiProcess: { label: "תהליך API", tone: "active", terminal: false },
  registered: { label: "רשום", tone: "active", terminal: false },
  awaitingShipment: { label: "ממתין למשלוח", tone: "warn", terminal: false },
  awaitingPorting: { label: "ממתין להפעלת ניודים", tone: "warn", terminal: false },
  awaitingInstall: { label: "ממתין להתקנה", tone: "warn", terminal: false },
  active: { label: "פעיל", tone: "good", terminal: false },
  approved: { label: "עסקה אושרה", tone: "good", terminal: true },
  rejected: { label: "נדחה", tone: "bad", terminal: true },
  cancelled: { label: "בוטל", tone: "bad", terminal: true },
};

export const DEAL_STAGE_ORDER: DealStage[] = [
  "new",
  "sentToAktiv",
  "inProgress",
  "apiProcess",
  "registered",
  "awaitingShipment",
  "awaitingPorting",
  "awaitingInstall",
  "active",
  "approved",
  "rejected",
  "cancelled",
];

/**
 * הרצף התקין של שלבים לכל קטגוריית ליד — זה מה שה-stepper במסך
 * "העסקאות שלי" מרנדר. `rejected`/`cancelled` הם off-ramp שיכול לקרות
 * בכל נקודה ולכן לא מופיעים ברצף הליניארי עצמו (מוצגים בנפרד ב-UI).
 */
export const STAGE_PIPELINE_FOR_CATEGORY: Record<LeadCategoryKey, DealStage[]> = {
  mobile: [
    "new",
    "sentToAktiv",
    "inProgress",
    "apiProcess",
    "registered",
    "awaitingShipment",
    "awaitingPorting",
    "active",
    "approved",
  ],
  internet: [
    "new",
    "sentToAktiv",
    "inProgress",
    "apiProcess",
    "awaitingInstall",
    "active",
    "approved",
  ],
  tv: [
    "new",
    "sentToAktiv",
    "inProgress",
    "apiProcess",
    "awaitingInstall",
    "active",
    "approved",
  ],
  triple: [
    "new",
    "sentToAktiv",
    "inProgress",
    "apiProcess",
    "awaitingInstall",
    "active",
    "approved",
  ],
  electricity: ["new", "inProgress", "registered", "active", "approved"],
  general: ["new", "inProgress", "active", "approved"],
  /**
   * ⚠️ זהה ל-`general` בכוונה. "ממחזור" הוא מקור הליד ולא סוג המוצר,
   * ולכן אי אפשר לדעת ממנו אם העסקה תדרוש משלוח, ניוד או התקנה —
   * זה יתברר רק כשייבחר מה בעצם נמכר. רצף מינימלי שתמיד תקף עדיף
   * על stepper שמבטיח שלב שלא יקרה.
   */
  recycled: ["new", "inProgress", "active", "approved"],
};

/**
 * רשומת שינוי שלב — מראה את `LeadStatusEvent` בדיוק. זו ההיסטוריה
 * שמאפשרת ל-stepper להראות אילו שלבים העסקה כבר עברה, לא רק את הנוכחי.
 */
export interface DealStageEvent {
  id: string;
  dealId: DealId;
  from: DealStage | null;
  to: DealStage;
  detail?: string;
  actorId: UserId;
  createdAt: string;
}

export interface Deal {
  id: DealId;
  /** מזהה תצוגה קצר, בסגנון "10001" — נפרד מ-id הפנימי */
  displayId: string;
  leadId: LeadId;
  packageIds: PackageId[];
  agentId: UserId;
  /**
   * קטגוריית הליד המקורי, מועתקת בזמן יצירת העסקה. מאפשרת לחשב
   * עלות/רווח ולבחור stepper בלי join לליד.
   */
  category: LeadCategoryKey;
  /** סכום שנגבה מהלקוח */
  revenue: number;
  currentStage: DealStage;
  stageHistory: DealStageEvent[];
  closedAt: string;
  note?: string;
}

/**
 * עלות רכישת ליד לפי קטגוריית הליד. ניתנת לעריכה במסך החבילות
 * ומשמשת לחישוב הרווח נטו על כל עסקה.
 */
export type LeadCostTable = Record<LeadCategoryKey, number>;

/**
 * המכפיל שהמערכת המקורית משתמשת בו לתמחור עמלות.
 * ⚠️ לא אומת מול נתוני עמלה אמיתיים — זו הנחה שהתקבלה בעבודה קודמת
 * ולא נמצאה לה עדות בקטלוג האמיתי (שם לא מוצג שדה עמלה כלל).
 */
export const COMMISSION_MULTIPLIER = 3.5;

/* ── טפסי רישום (הפניית שותפים) ───────────────────────────────────────── */

export type RegistrationStatus = "pending" | "handled" | "rejected";

export const REGISTRATION_STATUS_CONFIG: Record<
  RegistrationStatus,
  { label: string; tone: StatusTone }
> = {
  pending: { label: "ממתין", tone: "warn" },
  handled: { label: "טופל", tone: "good" },
  rejected: { label: "נדחה", tone: "bad" },
};

export const REGISTRATION_STATUS_ORDER: RegistrationStatus[] = [
  "pending",
  "handled",
  "rejected",
];

/**
 * פנייה של בעל עסק חיצוני להצטרפות כשותף — דרך טופס ציבורי משותף
 * (`/form/[token]`), לא ליד מכירה. שדה נפרד לגמרי מ-`Lead`.
 */
export interface Registration {
  id: RegistrationId;
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  /** תיאור חופשי של ערוץ ההפניה, למשל "ONE STOP" או שם עובד */
  referralSource: string;
  /** המשתמש שהטוקן שלו שימש לשליחה, אם הטוקן היה תקין */
  referredByUserId?: UserId;
  status: RegistrationStatus;
  createdAt: string;
  handledAt?: string;
  handledById?: UserId;
}

/* ── שומרי טיפוס לערכי enum מבחוץ ─────────────────────────────────────── */

/**
 * ולידציה של ערך enum שהגיע מהלקוח.
 *
 * ⚠️ הדפוס שהיה כאן קודם — `if (!STATUS_CONFIG[value]) return שגיאה` —
 * נראה תקין אבל דולף: מפות התצורה הן object literals, ולכן
 * `STATUS_CONFIG["constructor"]` ו-`STATUS_CONFIG["toString"]` הם
 * פונקציות מהפרוטוטייפ, כלומר truthy, והבדיקה עוברת. ערך כזה היה
 * ממשיך ל-DB ונופל שם, או — במימוש הזיכרון — נשמר וגורם לכל רינדור
 * להתרסק על `STATUS_CONFIG[lead.status].terminal`.
 *
 * מערכי ה-`*_ORDER` הם רשימות סגורות ומפורשות, ולכן `Set` מעליהם הוא
 * מקור האמת הנכון לשאלה "האם הערך הזה חוקי".
 */
const STATUS_SET: ReadonlySet<string> = new Set(STATUS_ORDER);
const ROLE_SET: ReadonlySet<string> = new Set(ROLE_ORDER);
const KIND_SET: ReadonlySet<string> = new Set(KIND_ORDER);
const PRIORITY_SET: ReadonlySet<string> = new Set(PRIORITY_ORDER);
const LEAD_CATEGORY_SET: ReadonlySet<string> = new Set(LEAD_CATEGORY_ORDER);
const PROVIDER_SET: ReadonlySet<string> = new Set(PROVIDER_ORDER);
const REGISTRATION_STATUS_SET: ReadonlySet<string> = new Set(
  REGISTRATION_STATUS_ORDER,
);

export function isLeadStatus(value: string): value is LeadStatus {
  return STATUS_SET.has(value);
}

export function isRole(value: string): value is Role {
  return ROLE_SET.has(value);
}

export function isLeadKind(value: string): value is LeadKind {
  return KIND_SET.has(value);
}

export function isPriority(value: string): value is Priority {
  return PRIORITY_SET.has(value);
}

export function isLeadCategory(value: string): value is LeadCategoryKey {
  return LEAD_CATEGORY_SET.has(value);
}

export function isProvider(value: string): value is ProviderKey {
  return PROVIDER_SET.has(value);
}

export function isRegistrationStatus(
  value: string,
): value is RegistrationStatus {
  return REGISTRATION_STATUS_SET.has(value);
}
