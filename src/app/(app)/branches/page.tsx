import QRCode from "qrcode";
import { prisma } from "@/server/db/client";
import { requireRouteAccess } from "@/server/auth/session";
import { BRANCHES, branchUrl } from "@/lib/domain/branches";
import { BranchesClient, type BranchRow } from "@/components/branches/BranchesClient";

/**
 * סניפי מוביסל: קישור ו-QR לכל סניף, וכמה לידים כל אחד הביא.
 *
 * ה-QR נוצר כאן בשרת כ-SVG. הכפתור "הורדה" בצד הלקוח ממיר אותו ל-PNG
 * גדול להדפסה, כך שאין צורך בשירות חיצוני ואין תלות ברשת בזמן ההדפסה.
 *
 * הספירה היא לפי `sourceDetail` שמסתיים בשם הסניף — זה בדיוק מה שמסלול
 * ה-API כותב (`branchSourceDetail`), ולכן אין עמודה נפרדת ב-DB.
 */
export default async function BranchesPage() {
  await requireRouteAccess("/branches");

  const since = thirtyDaysAgo();
  const grouped = await prisma.lead.groupBy({
    by: ["sourceDetail"],
    where: { createdAt: { gte: since }, sourceDetail: { contains: " – " } },
    _count: { _all: true },
  });

  const rows: BranchRow[] = await Promise.all(
    BRANCHES.map(async (branch) => {
      const url = branchUrl(branch);
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
      });
      const leads30d = grouped
        .filter((g) => g.sourceDetail?.endsWith(` – ${branch.name}`))
        .reduce((sum, g) => sum + g._count._all, 0);
      return {
        code: branch.code,
        name: branch.name,
        url,
        svg,
        leads30d,
        whatsapp: Boolean(branch.whatsapp),
      };
    }),
  );

  return <BranchesClient rows={rows} />;
}

/** פונקציה ולא שורה ברכיב: `react-hooks/purity` אוסר `Date.now()` ברינדור. */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60_000);
}
