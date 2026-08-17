import { prisma } from "@/server/db/client";
import { requireRouteAccess } from "@/server/auth/session";
import { RenewalsClient } from "@/components/renewals/RenewalsClient";

/**
 * מסך החידושים — העלאת מסמכי לקוחות שהשנה שלהם הסתיימה.
 *
 * ⚠️ המסמכים כאן הם חשבוניות של לקוחות אמיתיים: שם, טלפון, כתובת
 * וצריכה. ההרשאה מוגדרת ב-`ROUTE_ROLES` יחד עם כל שאר המסכים
 * המוגבלים — קודם ישב כאן קבוע `ALLOWED` מקומי, וריבוי הרשימות הוא
 * בדיוק מה שאיפשר ל-`/deals` להיסחף.
 */
export default async function RenewalsPage() {
  await requireRouteAccess("/renewals");

  const contacts = await prisma.renewalContact.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  const docs = await prisma.renewalDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      fileName: true,
      byteSize: true,
      status: true,
      pageCount: true,
      error: true,
      extractedText: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  return (
    <RenewalsClient
      docs={docs.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        byteSize: d.byteSize,
        status: d.status,
        pageCount: d.pageCount,
        error: d.error,
        // ⚠️ רק תחילת הטקסט נשלחת ללקוח. חשבונית שלמה היא אלפי תווים,
        // ו-200 מהן היו הופכות את ה-HTML של המסך למגהבייטים.
        textPreview: d.extractedText?.slice(0, 4000) ?? null,
        textLength: d.extractedText?.length ?? 0,
        createdAt: d.createdAt.toISOString(),
        uploadedByName: d.uploadedBy.name,
        contactCount: contacts.filter((c) => c.documentId === d.id).length,
      }))}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        city: c.city,
        provider: c.provider,
        packageName: c.packageName,
        // Decimal של Prisma לא עובר סריאליזציה לקליינט כמו שהוא
        currentPrice: c.currentPrice ? Number(c.currentPrice) : null,
        futurePrice: c.futurePrice ? Number(c.futurePrice) : null,
        status: c.status,
        agreedAt: c.agreedAt?.toISOString() ?? null,
        leadId: c.leadId,
        sentAt: c.sentAt?.toISOString() ?? null,
        lastInboundText: c.lastInboundText,
        lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
      }))}
    />
  );
}
