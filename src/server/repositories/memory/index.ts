import type { LeadCostTable, Package } from "@/lib/domain/types";
import type {
  DealRepository,
  PackageFilter,
  PackageRepository,
  Repositories,
  SettingsRepository,
  UserRepository,
} from "../types";
import { memoryLeadRepository } from "./leads";
import { memoryRegistrationRepository } from "./registrations";
import { state } from "./store";

const users: UserRepository = {
  async list() {
    return structuredClone(state.users);
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
    return structuredClone(state.users.filter((u) => u.active));
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
    return structuredClone(rows);
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

const deals: DealRepository = {
  async list() {
    return structuredClone(state.deals);
  },
  async listByAgent(agentId) {
    return structuredClone(state.deals.filter((d) => d.agentId === agentId));
  },
  async getById(id) {
    const found = state.deals.find((d) => d.id === id);
    return found ? structuredClone(found) : null;
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
  packages,
  deals,
  settings,
  registrations: memoryRegistrationRepository,
};
