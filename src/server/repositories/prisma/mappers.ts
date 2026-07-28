import type {
  Deal as PDeal,
  DealPackage as PDealPackage,
  DealStageEvent as PDealStageEvent,
  Lead as PLead,
  LeadActivity as PActivity,
  LeadNote as PLeadNote,
  LeadStatusEvent as PEvent,
  Package as PPackage,
  Registration as PRegistration,
  User as PUser,
} from "@/generated/prisma/client";
import type {
  Deal,
  DealStageEvent,
  Lead,
  LeadActivityEvent,
  LeadNote,
  LeadStatusEvent,
  Package,
  Registration,
  User,
} from "@/lib/domain/types";

/**
 * הגבול בין Prisma לדומיין.
 *
 * שני הבדלים חייבים המרה מפורשת כאן, ולא מאוחר יותר:
 *
 *  - `Decimal` → `number`. Prisma מחזיר אובייקטי Decimal עבור שדות
 *    כספיים (כדי לא לאבד דיוק). מודל הדומיין עובד עם number רגיל,
 *    ו-Decimal לא עובר סריאליזציה נקייה ל-Client Components.
 *  - `Date` → ISO string. מודל הדומיין מצפה למחרוזות בכל מקום
 *    (ראה seed.ts), כדי שתאריכים יהיו ניתנים להשוואה עם Date.parse
 *    בלי הבדל בין המימושים.
 *
 * שמות השדות והערכים של ה-enum-ים ב-Prisma זהים למודל הדומיין,
 * ולכן אין צורך במיפוי נוסף מלבד cast של הטיפוס.
 */

export function toNumber(d: { toString(): string }): number {
  return Number(d.toString());
}

export function leadFromPrisma(
  row: PLead & {
    notes?: PLeadNote[];
    history?: PEvent[];
    activity?: PActivity[];
  },
): Lead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    source: row.source,
    category: row.category ?? undefined,
    currentProvider: row.currentProvider ?? undefined,
    // בדיקת null מפורשת ולא `?? undefined`: Decimal(0) הוא אובייקט
    // truthy, אבל 0 ו"לא הוגדר" הם שני מצבים שונים ואסור לאחד אותם
    cost: row.cost === null ? undefined : toNumber(row.cost),
    isStarred: row.isStarred,
    assigneeId: row.assigneeId ?? undefined,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastContactAt: row.lastContactAt?.toISOString(),
    followUpAt: row.followUpAt?.toISOString(),
    city: row.city ?? undefined,
    notes: (row.notes ?? []).map(noteFromPrisma),
    history: (row.history ?? []).map(eventFromPrisma),
    activity: (row.activity ?? []).map(activityFromPrisma),
  };
}

export function activityFromPrisma(row: PActivity): LeadActivityEvent {
  return {
    id: row.id,
    leadId: row.leadId,
    type: row.type,
    detail: row.detail ?? undefined,
    targetUserId: row.targetUserId ?? undefined,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function noteFromPrisma(row: PLeadNote): LeadNote {
  return {
    id: row.id,
    leadId: row.leadId,
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function eventFromPrisma(row: PEvent): LeadStatusEvent {
  return {
    id: row.id,
    leadId: row.leadId,
    from: row.from ?? null,
    to: row.to,
    detail: row.detail ?? undefined,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function userFromPrisma(row: PUser): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone ?? undefined,
    active: row.active,
    store: row.store ?? undefined,
    subscriptionEndsAt: row.subscriptionEndsAt?.toISOString(),
  };
}

export function packageFromPrisma(row: PPackage): Package {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    category: row.category,
    price: row.price ? toNumber(row.price) : null,
    commission: toNumber(row.commission),
    spec: (row.spec ?? {}) as Package["spec"],
    description: row.description ?? undefined,
    active: row.active,
  };
}

export function dealStageEventFromPrisma(row: PDealStageEvent): DealStageEvent {
  return {
    id: row.id,
    dealId: row.dealId,
    from: row.from ?? null,
    to: row.to,
    detail: row.detail ?? undefined,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function dealFromPrisma(
  row: PDeal & { packages: PDealPackage[]; stageHistory?: PDealStageEvent[] },
): Deal {
  return {
    id: row.id,
    displayId: row.displayId,
    leadId: row.leadId,
    packageIds: row.packages.map((p) => p.packageId),
    agentId: row.agentId,
    category: row.category,
    revenue: toNumber(row.revenue),
    currentStage: row.currentStage,
    stageHistory: (row.stageHistory ?? []).map(dealStageEventFromPrisma),
    closedAt: row.closedAt.toISOString(),
    note: row.note ?? undefined,
  };
}

export function registrationFromPrisma(row: PRegistration): Registration {
  return {
    id: row.id,
    businessName: row.businessName,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email ?? undefined,
    referralSource: row.referralSource,
    referredByUserId: row.referredByUserId ?? undefined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    handledAt: row.handledAt?.toISOString(),
    handledById: row.handledById ?? undefined,
  };
}
