import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { LeadCostTable, Package } from "@/lib/domain/types";
import { LEAD_CATEGORY_ORDER } from "@/lib/domain/types";
import type {
  CreateRegistrationInput,
  DealRepository,
  PackageFilter,
  PackageRepository,
  RegistrationFilter,
  RegistrationRepository,
  Repositories,
  SessionRepository,
  SettingsRepository,
  UserRepository,
} from "../types";
import {
  dealFromPrisma,
  packageFromPrisma,
  registrationFromPrisma,
  sessionFromPrisma,
  toNumber,
  userFromPrisma,
} from "./mappers";
import { prismaLeadRepository } from "./leads";

const users: UserRepository = {
  async list() {
    const rows = await prisma.user.findMany({ orderBy: { name: "asc" } });
    return rows.map(userFromPrisma);
  },
  async getById(id) {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? userFromPrisma(row) : null;
  },
  async getByEmail(email) {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? userFromPrisma(row) : null;
  },
  async listActive() {
    const rows = await prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return rows.map(userFromPrisma);
  },
  async create(input) {
    const row = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        store: input.store,
        leadSourceName: input.leadSourceName,
      },
    });
    return userFromPrisma(row);
  },
  async update(id, input) {
    // אותה סמנטיקה כמו לידים: undefined = אל תיגע, null = נקה.
    // Prisma מפרש את זה כך בדיוק, ולכן ההעברה ישירה.
    const row = await prisma.user.update({ where: { id }, data: input });
    return userFromPrisma(row);
  },
  /*
   * שבע ספירות בטרנזקציה אחת ולא שבע נסיעות: המסך קורא לזה לפני כל
   * מחיקה, והמספרים חייבים לתאר את אותו רגע — אחרת ההודעה "יש לו 3
   * לידים" עלולה להיות מורכבת משני מצבים שונים של המסד.
   */
  async historyCounts(id) {
    const [
      createdLeads,
      notes,
      statusEvents,
      activity,
      deals,
      dealStageEvents,
      renewalDocuments,
    ] = await prisma.$transaction([
      prisma.lead.count({ where: { createdById: id } }),
      prisma.leadNote.count({ where: { authorId: id } }),
      prisma.leadStatusEvent.count({ where: { actorId: id } }),
      prisma.leadActivity.count({ where: { actorId: id } }),
      prisma.deal.count({ where: { agentId: id } }),
      prisma.dealStageEvent.count({ where: { actorId: id } }),
      prisma.renewalDocument.count({ where: { uploadedById: id } }),
    ]);

    return {
      createdLeads,
      notes,
      statusEvents,
      activity,
      deals,
      dealStageEvents,
      renewalDocuments,
    };
  },
  async delete(id) {
    // הסשנים, הטוקנים והשיוכים נופלים לבד: Cascade ו-SetNull מוגדרים
    // על הקשרים עצמם ב-schema.prisma.
    await prisma.user.delete({ where: { id } });
  },
};

const packages: PackageRepository = {
  async list(filter: PackageFilter = {}) {
    const where: Prisma.PackageWhereInput = {};
    const and: Prisma.PackageWhereInput[] = [];

    if (filter.activeOnly) and.push({ active: true });
    if (filter.provider?.length) and.push({ provider: { in: filter.provider } });
    if (filter.category?.length) and.push({ category: { in: filter.category } });
    if (filter.query?.trim()) {
      const q = filter.query.trim();
      and.push({
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      });
    }
    if (and.length) where.AND = and;

    const rows = await prisma.package.findMany({ where, orderBy: { name: "asc" } });
    return rows.map(packageFromPrisma);
  },
  async getById(id) {
    const row = await prisma.package.findUnique({ where: { id } });
    return row ? packageFromPrisma(row) : null;
  },
  async update(id, input: Partial<Package>) {
    const row = await prisma.package.update({
      where: { id },
      data: {
        name: input.name,
        provider: input.provider,
        category: input.category,
        price: input.price,
        commission: input.commission,
        spec: input.spec as Prisma.InputJsonValue | undefined,
        description: input.description,
        active: input.active,
      },
    });
    return packageFromPrisma(row);
  },
};

const deals: DealRepository = {
  async list() {
    const rows = await prisma.deal.findMany({
      include: { packages: true, stageHistory: true },
      orderBy: { closedAt: "desc" },
    });
    return rows.map(dealFromPrisma);
  },
  async listByAgent(agentId) {
    const rows = await prisma.deal.findMany({
      where: { agentId },
      include: { packages: true, stageHistory: true },
      orderBy: { closedAt: "desc" },
    });
    return rows.map(dealFromPrisma);
  },
  async getById(id) {
    const row = await prisma.deal.findUnique({
      where: { id },
      include: { packages: true, stageHistory: true },
    });
    return row ? dealFromPrisma(row) : null;
  },
};

const settings: SettingsRepository = {
  async getLeadCosts(): Promise<LeadCostTable> {
    const rows = await prisma.leadCost.findMany();
    const byCategory = new Map(rows.map((r) => [r.category, toNumber(r.cost)]));

    // קטגוריה בלי שורה עדיין (למשל אחרי הוספת קטגוריה חדשה) = 0,
    // לא שגיאה — כך גם מימוש הזיכרון מתנהג עם ברירת המחדל שלו
    return Object.fromEntries(
      LEAD_CATEGORY_ORDER.map((c) => [c, byCategory.get(c) ?? 0]),
    ) as LeadCostTable;
  },

  async setLeadCosts(costs) {
    await prisma.$transaction(
      LEAD_CATEGORY_ORDER.map((category) =>
        prisma.leadCost.upsert({
          where: { category },
          create: { category, cost: costs[category] },
          update: { cost: costs[category] },
        }),
      ),
    );
    return this.getLeadCosts();
  },
};

const registrations: RegistrationRepository = {
  async list(filter: RegistrationFilter = {}) {
    const where: Prisma.RegistrationWhereInput = {};
    const and: Prisma.RegistrationWhereInput[] = [];

    if (filter.status?.length) and.push({ status: { in: filter.status } });
    if (filter.referredByUserId?.length)
      and.push({ referredByUserId: { in: filter.referredByUserId } });
    if (filter.query?.trim()) {
      const q = filter.query.trim();
      and.push({
        OR: [
          { businessName: { contains: q } },
          { contactName: { contains: q } },
          { phone: { contains: q } },
        ],
      });
    }
    if (and.length) where.AND = and;

    const rows = await prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(registrationFromPrisma);
  },

  async getById(id) {
    const row = await prisma.registration.findUnique({ where: { id } });
    return row ? registrationFromPrisma(row) : null;
  },

  async create(input: CreateRegistrationInput) {
    const row = await prisma.registration.create({
      data: {
        businessName: input.businessName,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        referralSource: input.referralSource,
        referredByUserId: input.referredByUserId,
      },
    });
    return registrationFromPrisma(row);
  },

  async updateStatus(id, status, handledById) {
    const row = await prisma.registration.update({
      where: { id },
      data: { status, handledById, handledAt: new Date() },
    });
    return registrationFromPrisma(row);
  },
};

/**
 * סשנים.
 *
 * ⚠️ `find` לא מסנן תפוגה בכוונה — הקורא (`server/auth/session.ts`)
 * הוא זה שמחליט מה לעשות עם סשן שפג, והוא גם מוחק אותו. סינון כאן
 * היה מסתיר את ההבחנה בין "אין סשן כזה" ל"היה וכבר לא", ובלעדיה אין
 * דרך לנקות שורות מתות.
 */
const sessions: SessionRepository = {
  async create({ tokenHash, userId, expiresAt }) {
    const row = await prisma.session.create({
      data: { tokenHash, userId, expiresAt },
    });
    return sessionFromPrisma(row);
  },

  async find(tokenHash) {
    const row = await prisma.session.findUnique({ where: { tokenHash } });
    return row ? sessionFromPrisma(row) : null;
  },

  async touch(tokenHash, expiresAt) {
    await prisma.session.update({
      where: { tokenHash },
      data: { expiresAt, lastSeenAt: new Date() },
    });
  },

  async setImpersonating(tokenHash, impersonatingId) {
    await prisma.session.update({
      where: { tokenHash },
      data: { impersonatingId },
    });
  },

  async delete(tokenHash) {
    // deleteMany ולא delete: התנתקות עם עוגייה שכבר נמחקה (טאב שני,
    // כפתור שנלחץ פעמיים) היא מצב תקין, לא שגיאה
    await prisma.session.deleteMany({ where: { tokenHash } });
  },

  async deleteAllForUser(userId) {
    // גם סשנים שבהם המשתמש הוא היעד המתוחזה: אחרת הבעלים היה ממשיך
    // לפעול בתור עובד שהושבת זה עתה
    const { count } = await prisma.session.deleteMany({
      where: { OR: [{ userId }, { impersonatingId: userId }] },
    });
    return count;
  },
};

export function createPrismaRepositories(): Repositories {
  return {
    leads: prismaLeadRepository,
    users,
    sessions,
    packages,
    deals,
    settings,
    registrations,
  };
}
