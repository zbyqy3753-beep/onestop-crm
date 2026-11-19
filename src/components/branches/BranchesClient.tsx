"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { REP_SEPARATOR } from "@/lib/domain/branches";

export type BranchRow = {
  code: string;
  name: string;
  url: string;
  /** ה-QR כ-SVG, נוצר בשרת. */
  svg: string;
  leads30d: number;
  /** האם לסניף מוגדר מספר וואטסאפ להתראות. */
  whatsapp: boolean;
  /** כמה עובדי מוביסל פעילים יש לסניף (0 בכרטיס של עובד). */
  workers: number;
};

export type RepOption = { tag: string; name: string };

/** גודל ה-PNG שיורד להדפסה — מספיק למדבקה של 10 ס"מ ב-300dpi. */
const PNG_SIZE = 1200;

/**
 * מסך סניפי מוביסל: כרטיס לכל סניף עם QR, קישור, העתקה והורדה.
 *
 * בחירת נציג מחליפה את כל ה-QR ל-QR האישי שלו (`?rep=<תג>`): ליד שמגיע
 * ממנו משויך אליו אוטומטית. ה-QR נוצר בשרת, ולכן הבחירה היא ניווט.
 */
export function BranchesClient({
  rows,
  reps,
  repTag,
  workerBranch,
}: {
  rows: BranchRow[];
  reps: RepOption[];
  /** הנציג שנבחר, או "" ל-QR הכללי של הסניף. */
  repTag: string;
  /** במסך עובדי המוביסל של סניף: הסניף. אחרת `undefined`. */
  workerBranch?: { code: string; name: string };
}) {
  const router = useRouter();
  const repName = reps.find((r) => r.tag === repTag)?.name;
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim();
    return q ? rows.filter((r) => r.name.includes(q) || r.code.split(REP_SEPARATOR)[0].includes(q.toLowerCase())) : rows;
  }, [rows, query]);

  const totalWorkers = rows.reduce((sum, r) => sum + r.workers, 0);

  const total = rows.reduce((sum, r) => sum + r.leads30d, 0);

  async function copy(row: BranchRow) {
    try {
      await navigator.clipboard.writeText(row.url);
      setCopied(row.code);
      setTimeout(() => setCopied((c) => (c === row.code ? null : c)), 1500);
    } catch {
      // הדפדפן חסם גישה ללוח — הקישור גלוי בכרטיס וניתן לסמן ידנית
    }
  }

  function download(row: BranchRow) {
    const img = new Image();
    const blobUrl = URL.createObjectURL(new Blob([row.svg], { type: "image/svg+xml" }));
    // QR של עובד יוצא עם השם שלו מתחתיו: מדבקות של כמה עובדים באותה
    // חנות נראות זהות, ובלי השם אי אפשר לדעת של מי כל אחת.
    const label = workerBranch ? [row.name, workerBranch.name] : null;
    const height = label ? PNG_SIZE + 220 : PNG_SIZE;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, PNG_SIZE, height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      if (label) {
        ctx.fillStyle = "#111";
        ctx.textAlign = "center";
        ctx.direction = "rtl";
        ctx.font = "bold 96px Heebo, Arial, sans-serif";
        ctx.fillText(label[0], PNG_SIZE / 2, PNG_SIZE + 90, PNG_SIZE - 80);
        ctx.font = "56px Heebo, Arial, sans-serif";
        ctx.fillText(label[1], PNG_SIZE / 2, PNG_SIZE + 180, PNG_SIZE - 80);
      }
      URL.revokeObjectURL(blobUrl);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr-${row.code}.png`;
      a.click();
    };
    img.src = blobUrl;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {workerBranch ? (
            <button
              type="button"
              onClick={() => router.push("/branches")}
              className="mb-1 text-xs text-ink-3 hover:text-ink-1"
            >
              → כל הסניפים
            </button>
          ) : null}
          <h1 className="text-xl font-bold text-ink-1">
            {workerBranch ? `עובדי ${workerBranch.name}` : "סניפי מוביסל"}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {workerBranch ? (
              <>
                QR אישי לכל עובד. ליד מסריקה שלו נכנס לחלוקה הרגילה, ועליו רשום שהעובד הביא אותו.
                {" "}
                <span className="nums">{total}</span> לידים מעובדי הסניף ב-30 הימים האחרונים.
              </>
            ) : repName ? (
              <>
                QR אישי של {repName}. ליד מסריקה שלו נכנס משויך אליו, עם התראת ליד חם.
                {" "}
                <span className="nums">{total}</span> לידים שלו מסניפים ב-30 הימים האחרונים.
              </>
            ) : (
              <>
                QR לכל סניף. לקוח שסורק נכנס לאתר, וכל ליד שהוא משאיר מגיע לכאן עם שם הסניף.
                {" "}
                <span className="nums">{total}</span> לידים מסניפים ב-30 הימים האחרונים.
                {totalWorkers > 0 ? (
                  <>
                    {" "}
                    <span className="nums">{totalWorkers}</span> עובדי מוביסל עם QR אישי.
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {workerBranch ? null : (
        <select
          value={repTag}
          onChange={(e) => {
            const tag = e.target.value;
            router.push(tag ? `/branches?rep=${tag}` : "/branches");
          }}
          aria-label="QR של"
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink-1 sm:w-56"
        >
          <option value="">QR כללי של הסניף (בלי שיוך)</option>
          {reps.map((r) => (
            <option key={r.tag} value={r.tag}>
              QR אישי: {r.name}
            </option>
          ))}
        </select>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={workerBranch ? "חיפוש עובד" : "חיפוש סניף"}
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink-1 sm:w-64"
        />
        </div>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((row) => (
          <li
            key={row.code}
            className="flex gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <div
              className="size-28 shrink-0 overflow-hidden rounded-lg bg-white [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: row.svg }}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="font-semibold text-ink-1">{row.name}</div>
              <div dir="ltr" className="truncate text-left text-xs text-ink-3">
                {row.url.replace(/^https:\/\//, "")}
              </div>
              <div className="mt-1 text-xs text-ink-2">
                <span className="nums">{row.leads30d}</span> לידים ב-30 יום
                {row.whatsapp ? " · מקבל וואטסאפ" : ""}
              </div>
              <div className="mt-auto flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => download(row)}
                  className="h-8 rounded-lg bg-brand px-3 text-xs font-semibold text-on-brand hover:bg-brand-hover"
                >
                  הורדת QR
                </button>
                <button
                  type="button"
                  onClick={() => copy(row)}
                  className="h-8 rounded-lg border border-line px-3 text-xs text-ink-2 hover:bg-surface-2"
                >
                  {copied === row.code ? "הועתק" : "העתקת קישור"}
                </button>
                {row.workers > 0 ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/branches?branch=${row.code}`)}
                    className="h-8 rounded-lg border border-line px-3 text-xs text-ink-2 hover:bg-surface-2"
                  >
                    עובדים (<span className="nums">{row.workers}</span>)
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
