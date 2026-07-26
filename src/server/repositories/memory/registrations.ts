import type { Registration, RegistrationId, UserId } from "@/lib/domain/types";
import type {
  CreateRegistrationInput,
  RegistrationFilter,
  RegistrationRepository,
} from "../types";
import { nextId, state } from "./store";

function nowIso(): string {
  return new Date().toISOString();
}

function matches(reg: Registration, f: RegistrationFilter): boolean {
  if (f.status?.length && !f.status.includes(reg.status)) return false;
  if (f.referredByUserId?.length) {
    if (!reg.referredByUserId || !f.referredByUserId.includes(reg.referredByUserId))
      return false;
  }
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q) {
      const haystack = `${reg.businessName} ${reg.contactName} ${reg.phone}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
  }
  return true;
}

export const memoryRegistrationRepository: RegistrationRepository = {
  async list(filter: RegistrationFilter = {}): Promise<Registration[]> {
    const rows = state.registrations.filter((r) => matches(r, filter));
    return structuredClone(
      rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  },

  async getById(id: RegistrationId): Promise<Registration | null> {
    const found = state.registrations.find((r) => r.id === id);
    return found ? structuredClone(found) : null;
  },

  async create(input: CreateRegistrationInput): Promise<Registration> {
    const registration: Registration = {
      id: nextId("reg"),
      businessName: input.businessName,
      contactName: input.contactName,
      phone: input.phone,
      email: input.email,
      referralSource: input.referralSource,
      referredByUserId: input.referredByUserId,
      status: "pending",
      createdAt: nowIso(),
    };

    state.registrations.unshift(registration);
    return structuredClone(registration);
  },

  async updateStatus(
    id: RegistrationId,
    status: Registration["status"],
    handledById: UserId,
  ): Promise<Registration> {
    const reg = state.registrations.find((r) => r.id === id);
    if (!reg) throw new Error(`פנייה ${id} לא נמצאה`);

    reg.status = status;
    reg.handledAt = nowIso();
    reg.handledById = handledById;

    return structuredClone(reg);
  },
};
