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

function compare(a: Lead, b: Lead, sort: LeadSort): number {
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

  async countByStatus(filter: LeadFilter = {}) {
    const counts = Object.fromEntries(
      STATUS_ORDER.map((s) => [s, 0]),
    ) as Record<LeadStatus, number>;

    for (const lead of state.leads) {
      if (matches(lead, filter)) counts[lead.status] += 1;
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
      priority: input.priority,
      source: input.source,
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

    // `cost` מטופל בנפרד: null מהקלט הוא "נקה" ונשמר כ-undefined,
    // כדי שהמצב בזיכרון יהיה זהה למה שחוזר מ-Prisma
    const { cost, ...rest } = input;
    Object.assign(lead, rest, { updatedAt: nowIso() });
    if (cost !== undefined) lead.cost = cost === null ? undefined : cost;

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

    lead.status = to;
    lead.updatedAt = ts;
    lead.lastContactAt = ts;

    // סטטוסים שאינם דורשים חזרה מנקים את התזכורת; אלה שכן — קובעים
    // אותה אם התקבל תאריך, ומשאירים את הקיים אם לא
    if (to !== "followUp" && to !== "futureTracking") {
      lead.followUpAt = undefined;
    } else if (followUpAt) {
      lead.followUpAt = followUpAt;
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
    if (!lead) return;

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
