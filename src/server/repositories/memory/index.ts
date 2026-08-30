import type { Deal, LeadCostTable, Package } from "@/lib/domain/types";
import type {
  DealRepository,
  PackageFilter,
  PackageRepository,
  Repositories,
  SessionRecord,
  SessionRepository,
  SettingsRepository,
  UserRepository,
} from "../types";
import { memoryLeadRepository } from "./leads";
import { memoryRegistrationRepository } from "./registrations";
import { nextId, state } from "./store";

/**
 * מיון לפי שם, זהה ל-`orderBy: { name: "asc" }` במימוש Prisma.
 *
 * ⚠️ לא קוסמטיקה. `nextAssignee` ב-`api/leads/route.ts` שובר שוויון
 * בין נציגים בעלי אותו עומס לפי סדר הרשימה, ומתעד את זה כהתנהגות
 * דטרמיניסטית. בסדר הכנסה זה היה בוחר נציג אחר מאשר ב-Postgres.
 */
function byName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "he"));
}

const users: UserRepository = {
  async list() {
    return structuredClone(byName(state.users));
  },
  async getById(id) {
    const found = state.users.find((u) => u.id === id);
    return found ? structuredClone(found) : null;
  },
  async getByEmail(email) {
    const found = state.users.find((u) => u.email === email);
    return found ? structuredClone(found) : null;
  },
  async listActive() {
    return structuredClone(byName(state.users.filter((u) => u.active)));
  },
  async create(input) {
    const user = {
      id: nextId("user"),
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      store: input.store,
      leadSourceName: input.leadSourceName,
      active: true,
    };
    state.users.push(user);
    return structuredClone(user);
  },
  async update(id, input) {
    const user = state.users.find((u) => u.id === id);
    if (!user) throw new Error(`משתמש ${id} לא נמצא`);

    // כמו בלידים: לא Object.assign — undefined מדלגים, null מנקה
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      Reflect.set(user, key, value === null ? undefined : value);
    }
    return structuredClone(user);
  },
  /*
   * אותן שבע ספירות כמו במימוש Prisma, על אותם שדות בדיוק. חידושי
   * מסמכים אינם קיימים בזיכרון ולכן תמיד 0 — זה לא "חסר" אלא היעדר
   * הישות כולה במימוש הזה.
   */
  async historyCounts(id) {
    let notes = 0;
    let statusEvents = 0;
    let activity = 0;
    for (const lead of state.leads) {
      notes += lead.notes.filter((n) => n.authorId === id).length;
      statusEvents += lead.history.filter((e) => e.actorId === id).length;
      activity += lead.activity.filter((a) => a.actorId === id).length;
    }

    return {
      createdLeads: state.leads.filter((l) => l.createdById === id).length,
      notes,
      statusEvents,
      activity,
      deals: state.deals.filter((d) => d.agentId === id).length,
      dealStageEvents: state.deals.reduce(
        (sum, d) => sum + d.stageHistory.filter((e) => e.actorId === id).length,
        0,
      ),
      renewalDocuments: 0,
    };
  },
  async delete(id) {
    const index = state.users.findIndex((u) => u.id === id);
    if (index === -1) throw new Error(`משתמש ${id} לא נמצא`);
    state.users.splice(index, 1);

    // מה שב-Postgres עושים Cascade ו-SetNull, כאן צריך ביד — אחרת
    // נשארים סשן תקף למשתמש מחוק ולידים שמצביעים לשום מקום.
    state.sessions = state.sessions.filter(
      (s) => s.userId !== id && s.impersonatingId !== id,
    );
    for (const lead of state.leads) {
      if (lead.assigneeId === id) lead.assigneeId = undefined;
    }
  },
};

const packages: PackageRepository = {
  async list(filter: PackageFilter = {}) {
    const rows = state.packages.filter((p) => {
      if (filter.activeOnly && !p.active) return false;
      if (filter.provider?.length && !filter.provider.includes(p.provider))
        return false;
      if (filter.category?.length && !filter.category.includes(p.category))
        return false;
      if (filter.query) {
        const q = filter.query.trim().toLowerCase();
        if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
    return structuredClone(byName(rows));
  },
  async getById(id) {
    const found = state.packages.find((p) => p.id === id);
    return found ? structuredClone(found) : null;
  },
  async update(id, input: Partial<Package>) {
    const pkg = state.packages.find((p) => p.id === id);
    if (!pkg) throw new Error(`חבילה ${id} לא נמצאה`);
    Object.assign(pkg, input);
    return structuredClone(pkg);
  },
};

/** החדשות קודם — זהה ל-`orderBy: { closedAt: "desc" }` ב-Prisma. */
function byClosedAtDesc(rows: Deal[]): Deal[] {
  return [...rows].sort(
    (a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt),
  );
}

const deals: DealRepository = {
  async list() {
    return structuredClone(byClosedAtDesc(state.deals));
  },
  async listByAgent(agentId) {
    return structuredClone(
      byClosedAtDesc(state.deals.filter((d) => d.agentId === agentId)),
    );
  },
  async getById(id) {
    const found = state.deals.find((d) => d.id === id);
    return found ? structuredClone(found) : null;
  },
};

/**
 * סשנים בזיכרון. אין כאן `structuredClone` כמו בשאר המאגרים: הסשן
 * נצרך מיד ואינו נשמר בשום מצב לקוח, והשכפול היה רק עולה.
 */
const sessions: SessionRepository = {
  async create({ tokenHash, userId, expiresAt }) {
    const row: SessionRecord = {
      tokenHash,
      userId,
      impersonatingId: null,
      expiresAt,
      lastSeenAt: new Date(),
    };
    state.sessions.push(row);
    return { ...row };
  },

  async find(tokenHash) {
    const found = state.sessions.find((s) => s.tokenHash === tokenHash);
    return found ? { ...found } : null;
  },

  async touch(tokenHash, expiresAt) {
    const found = state.sessions.find((s) => s.tokenHash === tokenHash);
    if (!found) return;
    found.expiresAt = expiresAt;
    found.lastSeenAt = new Date();
  },

  async setImpersonating(tokenHash, impersonatingId) {
    const found = state.sessions.find((s) => s.tokenHash === tokenHash);
    if (found) found.impersonatingId = impersonatingId;
  },

  async delete(tokenHash) {
    const at = state.sessions.findIndex((s) => s.tokenHash === tokenHash);
    if (at !== -1) state.sessions.splice(at, 1);
  },

  async deleteAllForUser(userId) {
    const before = state.sessions.length;
    state.sessions = state.sessions.filter(
      (s) => s.userId !== userId && s.impersonatingId !== userId,
    );
    return before - state.sessions.length;
  },
};

const settings: SettingsRepository = {
  async getLeadCosts() {
    return structuredClone(state.leadCosts);
  },
  async setLeadCosts(costs: LeadCostTable) {
    state.leadCosts = { ...costs };
    return structuredClone(state.leadCosts);
  },
};

export const memoryRepositories: Repositories = {
  leads: memoryLeadRepository,
  users,
  sessions,
  packages,
  deals,
  settings,
  registrations: memoryRegistrationRepository,
};
