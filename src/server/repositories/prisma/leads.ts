import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { Lead, LeadId, LeadStatus, UserId } from "@/lib/domain/types";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/domain/types";
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
import { leadFromPrisma } from "./mappers";

/**
 * מימוש Prisma של LeadRepository.
 *
 * שני דברים לא-מובנים־מאליהם:
 *
 *  - מיון לפי `status` ו-`priority` נשען על **סדר ההצהרה** של ה-enum
 *    ב-schema.prisma, שתואם בכוונה לסדר בדומיין (STATUS_ORDER,
 *    PRIORITY_ORDER). Postgres ממיין enum-ים לפי סדר יצירתם, לא
 *    לפי א״ב — אז `orderBy: { status: dir }` "סתם עובד" נכון.
 *    אם מישהו ישנה את סדר הערכים באחד משני המקומות בלי לשנות
 *    את השני, המיון בטבלה יפסיק להיות תואם.
 *
 *  - `changeStatus` הוא טרנזקציה: עדכון הליד ורישום האירוע
 *    בהיסטוריה חייבים להצליח יחד או להיכשל יחד.
 */

const openStatuses = STATUS_ORDER.filter((s) => !STATUS_CONFIG[s].terminal);

function buildWhere(filter: LeadFilter): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [];

  if (filter.openOnly) and.push({ status: { in: openStatuses } });
  if (filter.status?.length) and.push({ status: { in: filter.status } });
  if (filter.kind?.length) and.push({ kind: { in: filter.kind } });
  if (filter.priority?.length) and.push({ priority: { in: filter.priority } });
  if (filter.category?.length) and.push({ category: { in: filter.category } });
  if (filter.provider?.length)
    and.push({ currentProvider: { in: filter.provider } });

  if (filter.assigneeId?.length) {
    const ids = filter.assigneeId.filter((id): id is UserId => id !== null);
    const wantsUnassigned = filter.assigneeId.includes(null);
    const or: Prisma.LeadWhereInput[] = [];
    if (ids.length) or.push({ assigneeId: { in: ids } });
    if (wantsUnassigned) or.push({ assigneeId: null });
    if (or.length) and.push({ OR: or });
  }

  if (filter.query?.trim()) {
    const q = filter.query.trim();
    and.push({
      OR: [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { city: { contains: q } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

function buildOrderBy(sort: LeadSort): Prisma.LeadOrderByWithRelationInput {
  switch (sort.field) {
    case "name":
      return { name: sort.direction };
    case "priority":
      return { priority: sort.direction };
    case "status":
      return { status: sort.direction };
    case "followUpAt":
      // null תמיד בסוף, ללא קשר לכיוון — כך גם במימוש הזיכרון
      return { followUpAt: { sort: sort.direction, nulls: "last" } };
    case "createdAt":
    case "updatedAt":
    default:
      return { [sort.field]: sort.direction };
  }
}

const DEFAULT_SORT: LeadSort = { field: "updatedAt", direction: "desc" };

export const prismaLeadRepository: LeadRepository = {
  async list(
    filter: LeadFilter = {},
    sort: LeadSort = DEFAULT_SORT,
    page?: Page,
  ): Promise<Paginated<Lead>> {
    const where = buildWhere(filter);

    const [rows, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: buildOrderBy(sort),
        skip: page?.offset,
        take: page?.limit,
        include: { notes: true, history: true, activity: true },
      }),
      prisma.lead.count({ where }),
    ]);

    return { rows: rows.map(leadFromPrisma), total };
  },

  async getById(id: LeadId): Promise<Lead | null> {
    const row = await prisma.lead.findUnique({
      where: { id },
      include: {
        notes: true,
        history: { orderBy: { createdAt: "asc" } },
        activity: { orderBy: { createdAt: "asc" } },
      },
    });
    return row ? leadFromPrisma(row) : null;
  },

  async countByStatus(filter: LeadFilter = {}) {
    const where = buildWhere(filter);
    const grouped = await prisma.lead.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const counts = Object.fromEntries(
      STATUS_ORDER.map((s) => [s, 0]),
    ) as Record<LeadStatus, number>;

    for (const g of grouped) counts[g.status] = g._count._all;
    return counts;
  },

  async create(input: CreateLeadInput): Promise<Lead> {
    const row = await prisma.lead.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        kind: input.kind,
        priority: input.priority,
        category: input.category,
        currentProvider: input.currentProvider,
        assigneeId: input.assigneeId,
        source: input.source,
        createdById: input.createdById,
        city: input.city,
        notes: input.note
          ? { create: [{ authorId: input.createdById, body: input.note }] }
          : undefined,
        history: {
          create: [{ to: "new", actorId: input.createdById }],
        },
        activity: {
          create: [
            {
              type: input.source === "import" ? "imported" : "created",
              targetUserId: input.assigneeId,
              actorId: input.createdById,
            },
          ],
        },
      },
      include: { notes: true, history: true, activity: true },
    });

    return leadFromPrisma(row);
  },

  async createMany(inputs: CreateLeadInput[]): Promise<Lead[]> {
    // ייבוא CSV: לא batch יחיד, כי כל שורה צריכה גם רשומת היסטוריה
    // ולידציה משלה. הכמות הצפויה (ייבוא ידני) לא מצדיקה SQL גולמי.
    const created: Lead[] = [];
    for (const input of inputs) {
      created.push(await this.create(input));
    }
    return created;
  },

  async findPhones(phones: string[]): Promise<Set<string>> {
    if (phones.length === 0) return new Set();

    const rows = await prisma.lead.findMany({
      where: { phone: { in: phones } },
      select: { phone: true },
    });
    return new Set(rows.map((r) => r.phone));
  },

  async update(id: LeadId, input: UpdateLeadInput): Promise<Lead> {
    // ה-cast כאן נחוץ: Prisma לא מצליח להסיק אוטומטית בין
    // LeadUpdateInput ל-LeadUncheckedUpdateInput עבור אובייקט חלקי
    // עם שדות סקלריים כמו assigneeId. שני הטיפוסים תואמים בפועל.
    const row = await prisma.lead.update({
      where: { id },
      data: input as Prisma.LeadUncheckedUpdateInput,
      include: { notes: true, history: true, activity: true },
    });
    return leadFromPrisma(row);
  },

  async changeStatus({
    leadId,
    to,
    detail,
    actorId,
    followUpAt,
  }: ChangeStatusInput): Promise<Lead> {
    const clearsFollowUp = to !== "followUp" && to !== "futureTracking";

    // undefined = אל תיגע; null = נקה. אותה התנהגות כמו במימוש הזיכרון.
    const nextFollowUp = clearsFollowUp
      ? null
      : followUpAt
        ? new Date(followUpAt)
        : undefined;

    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { status: true },
      });

      await tx.leadStatusEvent.create({
        data: { leadId, from: current.status, to, detail, actorId },
      });

      return tx.lead.update({
        where: { id: leadId },
        data: {
          status: to,
          lastContactAt: new Date(),
          followUpAt: nextFollowUp,
        },
        include: { notes: true, history: true, activity: true },
      });
    });

    return leadFromPrisma(row);
  },

  async assign(
    ids: LeadId[],
    assigneeId: UserId | null,
    actorId: UserId,
  ): Promise<Lead[]> {
    // העדכון ורישום הפעילות חייבים לרדת יחד, אחרת נשאר שיוך בלי עקבות
    await prisma.$transaction([
      prisma.lead.updateMany({
        where: { id: { in: ids } },
        data: { assigneeId },
      }),
      prisma.leadActivity.createMany({
        data: ids.map((leadId) => ({
          leadId,
          type: assigneeId
            ? ("assigned" as const)
            : ("unassigned" as const),
          targetUserId: assigneeId,
          actorId,
        })),
      }),
    ]);

    const rows = await prisma.lead.findMany({
      where: { id: { in: ids } },
      include: { notes: true, history: true, activity: true },
    });
    return rows.map(leadFromPrisma);
  },

  async logActivity({
    leadId,
    type,
    detail,
    targetUserId,
    actorId,
  }: LogActivityInput): Promise<void> {
    await prisma.leadActivity.create({
      data: { leadId, type, detail, targetUserId, actorId },
    });
  },

  async addNote(leadId: LeadId, authorId: UserId, body: string): Promise<Lead> {
    const row = await prisma.lead.update({
      where: { id: leadId },
      data: { notes: { create: [{ authorId, body }] } },
      include: { notes: true, history: true, activity: true },
    });
    return leadFromPrisma(row);
  },

  async remove(ids: LeadId[]): Promise<void> {
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  },
};

