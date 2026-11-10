"use client";

import { useMemo, useState } from "react";

export type BranchRow = {
  code: string;
  name: string;
  url: string;
  /** ה-QR כ-SVG, נוצר בשרת. */
  svg: string;
  leads30d: number;
  /** האם לסניף מוגדר מספר וואטסאפ להתראות. */
  whatsapp: boolean;
};

/** גודל ה-PNG שיורד להדפסה — מספיק למדבקה של 10 ס"מ ב-300dpi. */
const PNG_SIZE = 1200;

/**
 * מסך סניפי מוביסל: כרטיס לכל סניף עם QR, קישור, העתקה והורדה.
 */
export function BranchesClient({ rows }: { rows: BranchRow[] }) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim();
    return q ? rows.filter((r) => r.name.includes(q) || r.code.includes(q.toLowerCase())) : rows;
  }, [rows, query]);

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
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
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
          <h1 className="text-xl font-bold text-ink-1">סניפי מוביסל</h1>
          <p className="mt-1 text-sm text-ink-3">
            QR לכל סניף. לקוח שסורק נכנס לאתר, וכל ליד שהוא משאיר מגיע לכאן עם שם הסניף.
            {" "}
            <span className="nums">{total}</span> לידים מסניפים ב-30 הימים האחרונים.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש סניף"
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink-1 sm:w-64"
        />
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
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
