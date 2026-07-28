import type {
  CategoryKey,
  Deal,
  Lead,
  LeadActivityType,
  LeadCategoryKey,
  LeadCostTable,
  LeadId,
  LeadKind,
  LeadStatus,
  Package,
  PackageId,
  Priority,
  ProviderKey,
  Registration,
  RegistrationId,
  RegistrationStatus,
  User,
  UserId,
} from "@/lib/domain/types";

/**
 * חוזי שכבת הנתונים.
 *
 * זהו הגבול היחיד בין האפליקציה למקור הנתונים. שום קומפוננטה ושום
 * Server Action לא ניגשים לנתונים אלא דרך הממשקים כאן.
 *
 * כל שיטה מחזירה Promise גם במימוש הזיכרון — כך שהמעבר ל-Postgres
 * לא ידרוש שינוי באף קורא.
 */

/* ── טיפוסי עזר ───────────────────────────────────────────────────────── */

export interface LeadFilter {
  /** חיפוש חופשי בשם, טלפון, אימייל או עיר */
  query?: string;
  status?: LeadStatus[];
  kind?: LeadKind[];
  priority?: Priority[];
  category?: LeadCategoryKey[];
  provider?: ProviderKey[];
  /** `null` = לידים ללא שיוך */
  assigneeId?: (UserId | null)[];
  /** רק לידים בסטטוס לא סופי */
  openOnly?: boolean;
}

export type LeadSortField =
  | "createdAt"
  | "updatedAt"
  | "name"
  | "priority"
  | "status"
  | "followUpAt";

export interface LeadSort {
  field: LeadSortField;
  direction: "asc" | "desc";
}

export interface Page {
  offset: number;
  limit: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
}

/** קלט ליצירת ליד. השדות הנגזרים נקבעים בשכבת השירות. */
export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  kind: LeadKind;
  priority: Priority;
  category?: LeadCategoryKey;
  currentProvider?: ProviderKey;
  city?: string;
  assigneeId?: UserId;
  source: Lead["source"];
  /** טקסט חופשי: שם הקמפיין/החבילה שהליד הגיע ממנה */
  sourceDetail?: string;
  createdById: UserId;
  /** הערה ראשונית, אופציונלית */
  note?: string;
}

export type UpdateLeadInput = Partial<
  Pick<
    Lead,
    | "name"
    | "phone"
    | "email"
    | "kind"
    | "priority"
    | "category"
    | "currentProvider"
    | "city"
    | "assigneeId"
    | "followUpAt"
    | "isStarred"
    | "sourceDetail"
  >
> & {
  /**
   * `null` מנקה את העלות הפרטנית ומחזיר לעלות הקטגוריה.
   * השמטה (`undefined`) משאירה אותה כמו שהיא — שני מצבים שונים.
   */
  cost?: number | null;
};

/** שינוי סטטוס תמיד נושא איתו את הפירוט שהסוכן הזין. */
export interface ChangeStatusInput {
  leadId: LeadId;
  to: LeadStatus;
  detail?: string;
  actorId: UserId;
  /**
   * מתי לחזור. רלוונטי רק לסטטוסים `followUp` / `futureTracking` —
   * בכל השאר התזכורת נמחקת ממילא והערך הזה מתעלמים ממנו.
   */
  followUpAt?: string;
}

/* ── ממשקים ───────────────────────────────────────────────────────────── */

export interface LeadRepository {
  list(
    filter?: LeadFilter,
    sort?: LeadSort,
    page?: Page,
  ): Promise<Paginated<Lead>>;
  getById(id: LeadId): Promise<Lead | null>;
  /** ספירה לפי סטטוס — משמש לכרטיסי הסיכום בלי לשלוף את כל השורות */
  countByStatus(filter?: LeadFilter): Promise<Record<LeadStatus, number>>;
  create(input: CreateLeadInput): Promise<Lead>;
  /** יצירה מרובה, לייבוא CSV */
  createMany(inputs: CreateLeadInput[]): Promise<Lead[]>;
  /**
   * אילו מהטלפונים האלה כבר קיימים במערכת.
   * הטלפון הוא מפתח הכפילות בפועל — `@@index([phone])` קיים בשבילו.
   */
  findPhones(phones: string[]): Promise<Set<string>>;
  update(id: LeadId, input: UpdateLeadInput): Promise<Lead>;
  changeStatus(input: ChangeStatusInput): Promise<Lead>;
  assign(
    ids: LeadId[],
    assigneeId: UserId | null,
    actorId: UserId,
  ): Promise<Lead[]>;
  addNote(leadId: LeadId, authorId: UserId, body: string): Promise<Lead>;
  /** רישום פעולה שאינה שינוי סטטוס — ראה LeadActivityEvent. */
  logActivity(input: LogActivityInput): Promise<void>;
  remove(ids: LeadId[]): Promise<void>;
}

export interface LogActivityInput {
  leadId: LeadId;
  type: LeadActivityType;
  detail?: string;
  targetUserId?: UserId;
  actorId: UserId;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  role: User["role"];
  store?: string;
}

export interface UserRepository {
  list(): Promise<User[]>;
  getById(id: UserId): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  listActive(): Promise<User[]>;
  create(input: CreateUserInput): Promise<User>;
}

export interface PackageFilter {
  query?: string;
  provider?: ProviderKey[];
  category?: CategoryKey[];
  activeOnly?: boolean;
}

export interface PackageRepository {
  list(filter?: PackageFilter): Promise<Package[]>;
  getById(id: PackageId): Promise<Package | null>;
  update(id: PackageId, input: Partial<Package>): Promise<Package>;
}

export interface DealRepository {
  list(): Promise<Deal[]>;
  listByAgent(agentId: UserId): Promise<Deal[]>;
  getById(id: string): Promise<Deal | null>;
}

export interface SettingsRepository {
  getLeadCosts(): Promise<LeadCostTable>;
  setLeadCosts(costs: LeadCostTable): Promise<LeadCostTable>;
}

/* ── טפסי רישום ───────────────────────────────────────────────────────── */

export interface RegistrationFilter {
  status?: RegistrationStatus[];
  referredByUserId?: UserId[];
  query?: string;
}

export interface CreateRegistrationInput {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  referralSource: string;
  referredByUserId?: UserId;
}

export interface RegistrationRepository {
  list(filter?: RegistrationFilter): Promise<Registration[]>;
  getById(id: RegistrationId): Promise<Registration | null>;
  create(input: CreateRegistrationInput): Promise<Registration>;
  updateStatus(
    id: RegistrationId,
    status: RegistrationStatus,
    handledById: UserId,
  ): Promise<Registration>;
}

/** נקודת הגישה היחידה לכל המאגרים. */
export interface Repositories {
  leads: LeadRepository;
  users: UserRepository;
  packages: PackageRepository;
  deals: DealRepository;
  settings: SettingsRepository;
  registrations: RegistrationRepository;
}
