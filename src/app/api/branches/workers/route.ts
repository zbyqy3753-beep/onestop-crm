import type { NextRequest } from "next/server";
import { apiKeyFromRequest, partnerFromKey } from "@/server/auth/apiKeys";
import { branchByCode, branchWorkers, workerTag } from "@/lib/domain/branches";

/**
 * עובדי המוביסל של סניף, לאתר הציבורי.
 *
 * `GET /api/branches/workers?code=<קוד סניף>` → `{ branch, workers: [{ name, tag }] }`
 *
 * לקוח שסורק את ה-QR של הסניף בוחר באתר איזה עובד הפנה אותו, והאתר
 * שומר `<סניף>--<tag>` בקוקי. משם הקרדיט עובר ל-CRM כמו ב-QR אישי
 * (`workerByTag` ב-`lib/domain/branches.ts`).
 *
 * ⚠️ מוגן במפתח של שותף (כמו `/api/leads`). רק שמות ותגים, בלי מזהה
 * פנימי נוסף: זה מה שהלקוח רואה על המסך בכל מקרה.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!partnerFromKey(apiKeyFromRequest(request))) {
    return Response.json({ success: false, error: "מפתח API חסר או לא תקין" }, { status: 401 });
  }

  const branch = branchByCode(request.nextUrl.searchParams.get("code"));
  if (!branch) {
    return Response.json({ success: false, error: "סניף לא מוכר" }, { status: 404 });
  }

  return Response.json({
    success: true,
    branch: branch.name,
    workers: branchWorkers(branch).map((w) => ({ name: w.name, tag: workerTag(w) })),
  });
}
