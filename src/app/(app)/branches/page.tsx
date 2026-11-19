import QRCode from "qrcode";
import { prisma } from "@/server/db/client";
import { requireRouteAccess } from "@/server/auth/session";
import {
  BRANCHES,
  REP_SEPARATOR,
  branchByCode,
  branchUrl,
  branchWorkers,
  isBranchSource,
  mobicellCreditMarker,
  workerTag,
} from "@/lib/domain/branches";
import { MOBICELL_WORKERS } from "@/lib/domain/mobicellWorkers";
import {
  BranchesClient,
  type BranchRow,
  type WorkerOption,
} from "@/components/branches/BranchesClient";

/**
 * סניפי מוביסל: קישור ו-QR לכל סניף, וכמה לידים כל אחד הביא.
 *
 * ה-QR נוצר כאן בשרת כ-SVG. הכפתור "הורדה" בצד הלקוח ממיר אותו ל-PNG
 * גדול להדפסה, כך שאין צורך בשירות חיצוני ואין תלות ברשת בזמן ההדפסה.
 *
 * הספירה היא לפי `sourceDetail` שמכיל את שם הסניף כמקטע (`isBranchSource`) — זה בדיוק מה שמסלול
 * ה-API כותב (`branchSourceDetail`), ולכן אין עמודה נפרדת ב-DB.
 *
 * ⚠️ QR אישי לעובד CRM (`?rep=`) הוסר מהמסך ב-19.11.2026, לבקשת המשתמש.
 * מסלול ה-API עדיין מכבד תג כזה, כדי שמדבקה שכבר הודפסה תמשיך לעבוד.
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

  const { branch: branchParam, worker: workerParam } = await searchParams;
  const since = thirtyDaysAgo();

  // תפריט "QR אישי": עובדי מוביסל בלבד, לפי סדר הסניפים
  const workerOptions: WorkerOption[] = BRANCHES.flatMap((b) =>
    branchWorkers(b).map((w) => ({ id: w.id, name: w.name, branchName: b.name })),
  );
  const picked = MOBICELL_WORKERS.find(
    (w) => w.active && String(w.id) === workerParam,
  );

  const workerBranch = branchByCode(picked?.branch ?? branchParam);
  if (workerBranch) {
    const workers = picked ? [picked] : branchWorkers(workerBranch);
    // ההערה הראשונה של הליד היא זו שמסלול ה-API כותב (`LeadNote`)
    const credited = await prisma.leadNote.findMany({
      where: {
        createdAt: { gte: since },
        body: { contains: `(עובד מוביסל #` },
        lead: { sourceDetail: { contains: ` – ${workerBranch.name}` } },
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
        workerBranch={{ code: workerBranch.code, name: workerBranch.name }}
        workerOptions={workerOptions}
        workerId={picked?.id}
      />
    );
  }

  const grouped = await prisma.lead.groupBy({
    by: ["sourceDetail"],
    where: {
      createdAt: { gte: since },
      sourceDetail: { contains: " – " },
    },
    _count: { _all: true },
  });

  const rows: BranchRow[] = await Promise.all(
    BRANCHES.map(async (branch) => {
      const url = branchUrl(branch);
      const leads30d = grouped
        .filter((g) => isBranchSource(g.sourceDetail, branch))
        .reduce((sum, g) => sum + g._count._all, 0);
      return {
        code: branch.code,
        name: branch.name,
        url,
        svg: await qrSvg(url),
        leads30d,
        whatsapp: Boolean(branch.whatsapp),
        workers: branchWorkers(branch).length,
      };
    }),
  );

  return (
    <BranchesClient rows={rows} workerOptions={workerOptions} />
  );
}

function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
}

/** פונקציה ולא שורה ברכיב: `react-hooks/purity` אוסר `Date.now()` ברינדור. */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60_000);
}
