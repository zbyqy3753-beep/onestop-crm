import { notFound } from "next/navigation";
import { prisma } from "@/server/db/client";
import { requireSessionUser } from "@/server/auth/session";
import { RenewalsClient } from "@/components/renewals/RenewalsClient";

/**
 * מסך החידושים — העלאת מסמכי לקוחות שהשנה שלהם הסתיימה.
 *
 * ⚠️ המסמכים כאן הם חשבוניות של לקוחות אמיתיים: שם, טלפון, כתובת
 * וצריכה. לכן אותה בדיקת הרשאה כמו במסך ניהול המערכת, ו-`notFound()`
 * ולא הפניה — מי שאין לו הרשאה לא צריך ללמוד שהמסך קיים.
 */
const ALLOWED = ["owner", "manager"] as const;

export default async function RenewalsPage() {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) notFound();

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
      }))}
    />
  );
}
