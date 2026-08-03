import type { Lead, LeadId, LeadStatus, UserId } from "@/lib/domain/types";
import { PRIORITY_CONFIG, STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
import type {
  ChangeStatusInput,
  CreateLeadInput,
  LeadFilter,
  LeadRepository,
  LeadSort,
  LogActivityInput,
  Page,
  Paginated,
  UpdateLeadInput,
} from "../types";
import { nextId, state } from "./store";

function nowIso(): string {
  return new Date().toISOString();
}

function matches(lead: Lead, f: LeadFilter): boolean {
  if (f.openOnly && STATUS_CONFIG[lead.status].terminal) return false;
  if (f.status?.length && !f.status.includes(lead.status)) return false;
  if (f.kind?.length && !f.kind.includes(lead.kind)) return false;
  if (f.priority?.length && !f.priority.includes(lead.priority)) return false;
  if (f.category?.length && (!lead.category || !f.category.includes(lead.category)))
    return false;
  if (
    f.provider?.length &&
    (!lead.currentProvider || !f.provider.includes(lead.currentProvider))
  )
    return false;

  if (f.assigneeId?.length) {
    const key = lead.assigneeId ?? null;
    if (!f.assigneeId.includes(key)) return false;
  }

  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q) {
      const haystack = [lead.name, lead.phone, lead.email ?? "", lead.city ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
  }

  return true;
}

/**
 * שובר שוויון קבוע, זהה למימוש Prisma. `Array.sort` יציב ולכן כאן זה
 * פחות קריטי, אבל שני המימושים חייבים להחזיר את *אותו* סדר בדיוק —
 * אחרת עימוד מציג שורות שונות בכל אחד מהם.
 */
function compare(a: Lead, b: Lead, sort: LeadSort): number {
  return compareByField(a, b, sort) || a.id.localeCompare(b.id);
}

function compareByField(a: Lead, b: Lead, sort: LeadSort): number {
  const dir = sort.direction === "asc" ? 1 : -1;

  switch (sort.field) {
    case "name":
      return a.name.localeCompare(b.name, "he") * dir;
    case "priority":
      return (
        (PRIORITY_CONFIG[a.priority].weight - PRIORITY_CONFIG[b.priority].weight) *
        dir
      );
    case "status":
      return (
        (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir
      );
    case "followUpAt": {
      // לידים בלי תאריך חזרה תמיד בסוף, ללא קשר לכיוון המיון
      if (!a.followUpAt && !b.followUpAt) return 0;
      if (!a.followUpAt) return 1;
      if (!b.followUpAt) return -1;
      return (Date.parse(a.followUpAt) - Date.parse(b.followUpAt)) * dir;
    }
    case "createdAt":
    case "updatedAt":
    default:
      return (Date.parse(a[sort.field]) - Date.parse(b[sort.field])) * dir;
  }
}

const DEFAULT_SORT: LeadSort = { field: "updatedAt", direction: "desc" };

export const memoryLeadRepository: LeadRepository = {
  async list(
    filter: LeadFilter = {},
    sort: LeadSort = DEFAULT_SORT,
    page?: Page,
  ): Promise<Paginated<Lead>> {
    const filtered = state.leads.filter((l) => matches(l, filter));
    const sorted = [...filtered].sort((a, b) => compare(a, b, sort));
    const rows = page
      ? sorted.slice(page.offset, page.offset + page.limit)
      : sorted;

    return { rows: structuredClone(rows), total: filtered.length };
  },

  async getById(id: LeadId): Promise<Lead | null> {
    const found = state.leads.find((l) => l.id === id);
    return found ? structuredClone(found) : null;
  },

  async listOwnership(ids: LeadId[]) {
    return state.leads
      .filter((l) => ids.includes(l.id))
      .map((l) => ({ id: l.id, assigneeId: l.assigneeId }));
  },

  async countByStatus(filter: LeadFilter = {}) {
    const counts = Object.fromEntries(
      STATUS_ORDER.map((s) => [s, 0]),
    ) as Record<LeadStatus, number>;

    for (const lead of state.leads) {
      if (matches(lead, filter)) counts[lead.status] += 1;
    }
    return counts;
  },

  async countOpenByAssignee(): Promise<Record<UserId, number>> {
    const counts: Record<UserId, number> = {};
    for (const lead of state.leads) {
      if (!lead.assigneeId) continue;
      if (STATUS_CONFIG[lead.status].terminal) continue;
      counts[lead.assigneeId] = (counts[lead.assigneeId] ?? 0) + 1;
    }
    return counts;
  },

  async create(input: CreateLeadInput): Promise<Lead> {
    const id = nextId("lead");
    const ts = nowIso();

    const lead: Lead = {
      id,
      name: input.name,
      phone: input.phone,
      email: input.email,
      kind: input.kind,
      status: "new",
      noAnswerCount: 0,
      priority: input.priority,
      source: input.source,
      sourceDetail: input.sourceDetail,
      packageName: input.packageName,
      isStarred: false,
      category: input.category,
      currentProvider: input.currentProvider,
      assigneeId: input.assigneeId,
      createdById: input.createdById,
      createdAt: ts,
      updatedAt: ts,
      city: input.city,
      notes: input.note
        ? [
            {
              id: nextId("note"),
              leadId: id,
              authorId: input.createdById,
              body: input.note,
              createdAt: ts,
            },
          ]
        : [],
      history: [
        {
          id: nextId("evt"),
          leadId: id,
          from: null,
          to: "new",
          actorId: input.createdById,
          createdAt: ts,
        },
      ],
      activity: [
        {
          id: nextId("act"),
          leadId: id,
          type: input.source === "import" ? "imported" : "created",
          targetUserId: input.assigneeId,
          actorId: input.createdById,
          createdAt: ts,
        },
      ],
    };

    state.leads.unshift(lead);
    return structuredClone(lead);
  },

  async createMany(inputs: CreateLeadInput[]): Promise<Lead[]> {
    const created: Lead[] = [];
    for (const input of inputs) {
      created.push(await this.create(input));
    }
    return created;
  },

  async findPhones(phones: string[]): Promise<Set<string>> {
    const wanted = new Set(phones);
    const found = new Set<string>();
    for (const lead of state.leads) {
      if (wanted.has(lead.phone)) found.add(lead.phone);
    }
    return found;
  },

  async update(id: LeadId, input: UpdateLeadInput): Promise<Lead> {
    const lead = state.leads.find((l) => l.id === id);
    if (!lead) throw new Error(`ליד ${id} לא נמצא`);

    // ⚠️ לא `Object.assign`. הוא כותב גם מפתחות שערכם `undefined`,
    // כלומר מוחק שדה שהקורא ביקש *לא* לגעת בו — ההפך המדויק ממה
    // ש-Prisma עושה עם אותו קלט. הלולאה המפורשת היא מה שמייצר
    // התנהגות זהה בשני המימושים: מדלגים על `undefined`, ומתרגמים
    // `null` (= נקה) ל-`undefined`, שהוא ייצוג "אין ערך" בדומיין.
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      Reflect.set(lead, key, value === null ? undefined : value);
    }
    lead.updatedAt = nowIso();

    return structuredClone(lead);
  },

  async changeStatus({
    leadId,
    to,
    detail,
    actorId,
    followUpAt,
  }: ChangeStatusInput): Promise<Lead> {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error(`ליד ${leadId} לא נמצא`);

    const ts = nowIso();
    const from = lead.status;

    lead.history.push({
      id: nextId("evt"),
      leadId,
      from,
      to,
      detail,
      actorId,
      createdAt: ts,
    });

    // עולה ב-1 בכל חזרה ל"אין מענה", מתאפס בכל מעבר לסטטוס אחר —
    // אותה סמנטיקה כמו במימוש Prisma (ראה docblock על השדה ב-types.ts).
    lead.noAnswerCount =
      to === "noAnswer"
        ? from === "noAnswer"
          ? lead.noAnswerCount + 1
          : 1
        : 0;

    lead.status = to;
    lead.updatedAt = ts;
    lead.lastContactAt = ts;

    // רק סטטוס סופי מנקה תאריך חזרה — הליד כבר לא בטיפול. סטטוס
    // לא-סופי משמר את התאריך הקיים: הכלל הישן גרם לכך שמעבר
    // ל"אין מענה" מחק תאריך חזרה שנקבע מראש. תאריך שהועבר במפורש
    // תמיד גובר. אותה התנהגות כמו במימוש Prisma.
    if (followUpAt) {
      lead.followUpAt = followUpAt;
    } else if (STATUS_CONFIG[to].terminal) {
      lead.followUpAt = undefined;
    }

    return structuredClone(lead);
  },

  async assign(
    ids: LeadId[],
    assigneeId: UserId | null,
    actorId: UserId,
  ): Promise<Lead[]> {
    const ts = nowIso();
    const touched: Lead[] = [];

    for (const lead of state.leads) {
      if (!ids.includes(lead.id)) continue;
      lead.assigneeId = assigneeId ?? undefined;
      lead.updatedAt = ts;
      lead.activity.push({
        id: nextId("act"),
        leadId: lead.id,
        type: assigneeId ? "assigned" : "unassigned",
        targetUserId: assigneeId ?? undefined,
        actorId,
        createdAt: ts,
      });
      touched.push(lead);
    }

    return structuredClone(touched);
  },

  async logActivity({
    leadId,
    type,
    detail,
    targetUserId,
    actorId,
  }: LogActivityInput): Promise<void> {
    const lead = state.leads.find((l) => l.id === leadId);
    // זורק ולא שותק: ב-Prisma זו הפרת מפתח זר. `setLeadCostAction`
    // עושה update ואז logActivity, וליד שנמחק בין שתי הקריאות היה
    // "מצליח" כאן ונופל שם — שני מימושים, שתי התנהגויות.
    if (!lead) throw new Error(`ליד ${leadId} לא נמצא`);

    lead.activity.push({
      id: nextId("act"),
      leadId,
      type,
      detail,
      targetUserId,
      actorId,
      createdAt: nowIso(),
    });
  },

  async addNote(leadId: LeadId, authorId: UserId, body: string): Promise<Lead> {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error(`ליד ${leadId} לא נמצא`);

    const ts = nowIso();
    lead.notes.push({
      id: nextId("note"),
      leadId,
      authorId,
      body,
      createdAt: ts,
    });
    lead.updatedAt = ts;

    return structuredClone(lead);
  },

  async remove(ids: LeadId[]): Promise<void> {
    state.leads = state.leads.filter((l) => !ids.includes(l.id));
  },
};
