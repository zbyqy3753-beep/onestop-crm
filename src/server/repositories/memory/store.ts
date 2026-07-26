import type {
  Deal,
  Lead,
  LeadCostTable,
  Package,
  Registration,
  User,
} from "@/lib/domain/types";
import { SEED_LEAD_COSTS, SEED_PACKAGES } from "@/lib/domain/catalog";
import {
  SEED_DEALS,
  SEED_LEADS,
  SEED_REGISTRATIONS,
  SEED_USERS,
} from "@/lib/domain/seed";

/**
 * המצב המשותף של מימוש הזיכרון.
 *
 * ⚠️ הנתונים חיים בזיכרון התהליך בלבד — הם נמחקים בכל אתחול שרת,
 * ובפריסה מרובת-אינסטנסים כל אינסטנס יראה מצב אחר. זה מכוון:
 * המימוש הזה קיים כדי שהאפליקציה תרוץ בלי DB, ולא כאחסון אמיתי.
 *
 * ב-dev, Next מרענן מודולים בכל שינוי קוד. globalThis שומר על המצב
 * בין רענונים כדי שעריכת קוד לא תאפס לידים שיצרת בזמן פיתוח.
 */

interface MemoryState {
  leads: Lead[];
  users: User[];
  packages: Package[];
  deals: Deal[];
  registrations: Registration[];
  leadCosts: LeadCostTable;
  /** מונה לייצור מזהים חדשים */
  seq: number;
}

const GLOBAL_KEY = Symbol.for("onestop.memoryStore");

type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: MemoryState };

function createState(): MemoryState {
  return {
    // עותקים עמוקים — כדי שמוטציות לא ידרסו את נתוני הזרע עצמם
    leads: structuredClone(SEED_LEADS),
    users: structuredClone(SEED_USERS),
    packages: structuredClone(SEED_PACKAGES),
    deals: structuredClone(SEED_DEALS),
    registrations: structuredClone(SEED_REGISTRATIONS),
    leadCosts: structuredClone(SEED_LEAD_COSTS),
    seq: SEED_LEADS.length + 1,
  };
}

const g = globalThis as GlobalWithStore;

export const state: MemoryState = (g[GLOBAL_KEY] ??= createState());

/** מזהה ייחודי חדש בתוך התהליך. ב-DB אמיתי זה יהיה cuid/uuid. */
export function nextId(prefix: string): string {
  state.seq += 1;
  return `${prefix}-${state.seq}`;
}

/** מאפס את המצב לנתוני הזרע. שימושי לבדיקות. */
export function resetStore(): void {
  Object.assign(state, createState());
}
