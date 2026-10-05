import { PostStudio } from "@/components/posts/PostStudio";
import { studioPackages } from "@/lib/posts/catalog";
import { prisma } from "@/server/db/client";
import { requireStaffUser } from "@/server/auth/session";

/**
 * סטודיו הפוסטים של אלירן: יוצר שקפים לאינסטגרם מהקטלוג של `/lp`, או
 * מבקש מ-Claude להכין ולפרסם פוסט (תור `PostRequest`).
 *
 * דינמי כי רשימת הבקשות משתנה מחוץ לתהליך: המשימה המתוזמנת מעדכנת
 * אותה דרך `/api/posts/requests`.
 */
export const dynamic = "force-dynamic";

export default async function PostsPage() {
  await requireStaffUser();

  const requests = await prisma.postRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <PostStudio
      packages={studioPackages()}
      requests={requests.map((r) => ({
        id: r.id,
        topic: r.topic,
        notes: r.notes,
        status: r.status,
        resultUrl: r.resultUrl,
        resultNote: r.resultNote,
        by: r.createdBy?.name ?? null,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
