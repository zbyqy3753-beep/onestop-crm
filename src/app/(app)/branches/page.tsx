import QRCode from "qrcode";
import { prisma } from "@/server/db/client";
import { requireRouteAccess } from "@/server/auth/session";
import {
  BRANCHES,
  REP_SEPARATOR,
  branchByCode,
  branchUrl,
  branchWorkers,
  mobicellCreditMarker,
  workerTag,
} from "@/lib/domain/branches";
import { branchReps } from "@/server/leads/branchRep";
import { BranchesClient, type BranchRow } from "@/components/branches/BranchesClient";

/**
 * סניפי מוביסל: קישור ו-QR לכל סניף, וכמה לידים כל אחד הביא.
 *
 * ה-QR נוצר כאן בשרת כ-SVG. הכפתור "הורדה" בצד הלקוח ממיר אותו ל-PNG
 * גדול להדפסה, כך שאין צורך בשירות חיצוני ואין תלות ברשת בזמן ההדפסה.
 *
 * הספירה היא לפי `sourceDetail` שמסתיים בשם הסניף — זה בדיוק מה שמסלול
 * ה-API כותב (`branchSourceDetail`), ולכן אין עמודה נפרדת ב-DB.
 *
 * `?rep=<תג>` מחליף את כל ה-QR ל-QR האישי של עובד CRM (ראה
 * `server/leads/branchRep.ts`), והספירה הופכת ללידים שלו בלבד.
 *
 * `?branch=<קוד>` מציג את עובדי המוביסל של הסניף, QR לכל אחד. הספירה
 * שלהם היא לפי הסימון `#<id>` בהערת הליד (`mobicellCreditLine`), כי
 * ליד מהם לא משויך אליהם.
 */
export default async function BranchesPage({
  searchParams,
}: {
  // ⚠️ Promise — ב-Next 16 `searchParams` א-סינכרוני
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRouteAccess("/branches");

  const { rep: repParam, branch: branchParam } = await searchParams;
  const since = thirtyDaysAgo();
  const reps = await branchReps();

  const workerBranch = branchByCode(branchParam);
  if (workerBranch) {
    const workers = branchWorkers(workerBranch);
    // ההערה הראשונה של הליד היא זו שמסלול ה-API כותב (`LeadNote`)
    const credited = await prisma.leadNote.findMany({
      where: {
        createdAt: { gte: since },
        body: { contains: `(עובד מוביסל #` },
        lead: { sourceDetail: { endsWith: ` – ${workerBranch.name}` } },
      },
      select: { leadId: true, body: true },
      distinct: ["leadId"],
    });
    const rows: BranchRow[] = await Promise.all(
      workers.map(async (w) => {
        const url = branchUrl(workerBranch, workerTag(w));
        const marker = `(עובד מוביסל ${mobicellCreditMarker(w)})`;
        return {
          code: `${workerBranch.code}${REP_SEPARATOR}${workerTag(w)}`,
          name: w.name,
          url,
          svg: await qrSvg(url),
          leads30d: credited.filter((n) => n.body.includes(marker)).length,
          whatsapp: false,
          workers: 0,
        };
      }),
    );
    return (
      <BranchesClient
        rows={rows}
        reps={[]}
        repTag=""
        workerBranch={{ code: workerBranch.code, name: workerBranch.name }}
      />
    );
  }

  const rep = reps.find((r) => r.tag === repParam);
  const grouped = await prisma.lead.groupBy({
    by: ["sourceDetail"],
    where: {
      createdAt: { gte: since },
      sourceDetail: { contains: " – " },
      ...(rep ? { assigneeId: rep.id } : {}),
    },
    _count: { _all: true },
  });

  const rows: BranchRow[] = await Promise.all(
    BRANCHES.map(async (branch) => {
      const url = branchUrl(branch, rep?.tag);
      const leads30d = grouped
        .filter((g) => g.sourceDetail?.endsWith(` – ${branch.name}`))
        .reduce((sum, g) => sum + g._count._all, 0);
      return {
        code: rep ? `${branch.code}${REP_SEPARATOR}${rep.tag}` : branch.code,
        name: branch.name,
        url,
        svg: await qrSvg(url),
        leads30d,
        whatsapp: Boolean(branch.whatsapp),
        // QR של עובדי מוביסל רלוונטי רק במסך הכללי, לא ב-QR של עובד CRM
        workers: rep ? 0 : branchWorkers(branch).length,
      };
    }),
  );

  return (
    <BranchesClient
      rows={rows}
      reps={reps.map((r) => ({ tag: r.tag, name: r.name }))}
      repTag={rep?.tag ?? ""}
    />
  );
}

function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
}

/** פונקציה ולא שורה ברכיב: `react-hooks/purity` אוסר `Date.now()` ברינדור. */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60_000);
}
