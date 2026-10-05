"use client";

import { Amatic_SC, Heebo } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioPackage } from "@/lib/posts/catalog";
import {
  afterPromoPost,
  comparePost,
  shekel,
  spotlightPost,
  TEMPLATES,
  tipPost,
  type Post,
  type TemplateId,
} from "@/lib/posts/templates";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { drawSlide, loadLogos } from "./renderSlide";
import { RequestPanel, type RequestView } from "./RequestPanel";

/** גופני המותג. נטענים כאן ולא ב-layout: רק המסך הזה מצייר בהם. */
const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["600", "700", "800", "900"] });
/** כתב היד של "שירות אישי ומקצועי". */
const amatic = Amatic_SC({ subsets: ["hebrew", "latin"], weight: ["700"] });

const MAX_PICK = 4;

const CATEGORY_LABEL: Record<StudioPackage["category"], string> = {
  cellular: "סלולר",
  home: "אינטרנט וטלוויזיה",
  electricity: "חשמל",
};

function packageLine(p: StudioPackage) {
  const price = p.category === "electricity" ? `${p.discountPercent}%` : shekel(p.price!);
  const after = p.after != null ? ` ← ${shekel(p.after)}` : "";
  return `${p.provider} · ${p.name} · ${price}${after}`;
}

export function PostStudio({
  packages,
  requests,
}: {
  packages: StudioPackage[];
  requests: RequestView[];
}) {
  const [template, setTemplate] = useState<TemplateId>("afterPromo");
  const [picked, setPicked] = useState<string[]>([]);
  const [spotlightId, setSpotlightId] = useState("");
  const [compareCat, setCompareCat] = useState<StudioPackage["category"]>("cellular");
  const [tip, setTip] = useState({ title: "", mark: "", points: "" });
  const [post, setPost] = useState<Post | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // מפתח ל-Preview: כל פוסט חדש מרכיב אותו מחדש, עם מצב "לא מוכן" נקי
  const [buildId, setBuildId] = useState(0);

  const byId = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);

  const choices = useMemo(() => {
    if (template === "afterPromo") {
      return packages.filter((p) => p.category === "cellular" && p.after != null);
    }
    if (template === "compare") return packages.filter((p) => p.category === compareCat);
    return [];
  }, [packages, template, compareCat]);

  function switchTemplate(t: TemplateId) {
    setTemplate(t);
    setPicked([]);
    setPost(null);
    setError(null);
  }

  function toggle(id: string) {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_PICK ? cur : [...cur, id],
    );
  }

  function build() {
    setError(null);
    try {
      const chosen = picked.map((id) => byId.get(id)!).filter(Boolean);
      let next: Post;
      if (template === "afterPromo") next = afterPromoPost(chosen);
      else if (template === "compare") next = comparePost(chosen);
      else if (template === "spotlight") {
        const p = byId.get(spotlightId);
        if (!p) throw new Error("בחר חבילה.");
        next = spotlightPost(p);
      } else {
        next = tipPost({ title: tip.title, mark: tip.mark, points: tip.points.split("\n") });
      }
      setPost(next);
      setCaption(next.caption);
      setBuildId((n) => n + 1);
    } catch (e) {
      setPost(null);
      setError(e instanceof Error ? e.message : "משהו השתבש ביצירת הפוסט.");
    }
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-xl font-bold">סטודיו פוסטים</h1>
        <p className="mt-1 text-sm text-ink-3">
          פוסטים לאינסטגרם בעיצוב של אלירן תקשורת, עם המחירים מהקטלוג של האתר. אפשר ליצור לבד, או
          לבקש מ-Claude שיכין ויפרסם.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-4 font-display text-base font-semibold">יצירה עצמית</h2>

            <div className="mb-4 grid grid-cols-2 gap-1.5">
              {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTemplate(t)}
                  aria-pressed={template === t}
                  className={`min-h-11 rounded-md border px-2 py-1.5 text-[13px] font-medium transition-colors lg:min-h-0 ${
                    template === t
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink-1"
                  }`}
                >
                  {TEMPLATES[t].label}
                </button>
              ))}
            </div>
            <p className="mb-4 text-xs text-ink-4">{TEMPLATES[template].hint}</p>

            {template === "compare" && (
              <div className="mb-3">
                <Field label="קטגוריה">
                  <select
                    className={inputClass}
                    value={compareCat}
                    onChange={(e) => {
                      setCompareCat(e.target.value as StudioPackage["category"]);
                      setPicked([]);
                    }}
                  >
                    {(Object.keys(CATEGORY_LABEL) as StudioPackage["category"][]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {(template === "afterPromo" || template === "compare") && (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-ink-2">
                  חבילות ({picked.length}/{MAX_PICK})
                </span>
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-line p-1.5">
                  {choices.map((p) => (
                    <li key={p.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-surface-2 lg:min-h-0">
                        <input
                          type="checkbox"
                          checked={picked.includes(p.id)}
                          onChange={() => toggle(p.id)}
                          disabled={!picked.includes(p.id) && picked.length >= MAX_PICK}
                        />
                        <span className="min-w-0 truncate">{packageLine(p)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {template === "spotlight" && (
              <Field label="חבילה">
                <select
                  className={inputClass}
                  value={spotlightId}
                  onChange={(e) => setSpotlightId(e.target.value)}
                >
                  <option value="">בחר חבילה…</option>
                  {(Object.keys(CATEGORY_LABEL) as StudioPackage["category"][]).map((c) => (
                    <optgroup key={c} label={CATEGORY_LABEL[c]}>
                      {packages
                        .filter((p) => p.category === c)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {packageLine(p)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            )}

            {template === "tip" && (
              <div className="space-y-3">
                <Field label="כותרת">
                  <input
                    className={inputClass}
                    value={tip.title}
                    onChange={(e) => setTip({ ...tip, title: e.target.value })}
                    placeholder="למשל: 3 דברים לבדוק בחשבון הסלולר"
                  />
                </Field>
                <Field label="מילה להדגשה בצהוב" hint="לא חובה. חייבת להופיע בכותרת בדיוק כך.">
                  <input
                    className={inputClass}
                    value={tip.mark}
                    onChange={(e) => setTip({ ...tip, mark: e.target.value })}
                  />
                </Field>
                <Field label="נקודות" hint="נקודה בכל שורה, עד 5.">
                  <textarea
                    className={`${inputClass} min-h-28`}
                    value={tip.points}
                    onChange={(e) => setTip({ ...tip, points: e.target.value })}
                  />
                </Field>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-bad">{error}</p>}
            <Button variant="primary" className="mt-4 w-full" onClick={build}>
              צור פוסט
            </Button>
          </section>

          <RequestPanel requests={requests} />
        </div>

        <section className="min-w-0">
          {post ? (
            <Preview key={buildId} post={post} caption={caption} setCaption={setCaption} copied={copied} onCopy={copyCaption} />
          ) : (
            <div className="grid min-h-64 place-items-center rounded-card border border-dashed border-line p-8 text-center text-sm text-ink-3">
              בחר תבנית ולחץ “צור פוסט”. השקפים יופיעו כאן, מוכנים להורדה.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Preview({
  post,
  caption,
  setCaption,
  copied,
  onCopy,
}: {
  post: Post;
  caption: string;
  setCaption: (s: string) => void;
  copied: boolean;
  onCopy: () => void;
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [overflow, setOverflow] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const family = heebo.style.fontFamily;
  const script = amatic.style.fontFamily;

  useEffect(() => {
    let alive = true;
    // בלי זה השקף הראשון מצויר בגופן מערכת, כי הגופן עוד לא ירד
    Promise.all([
      loadLogos(),
      ...[600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px ${family}`)),
      document.fonts.load(`700 48px ${script}`),
    ]).then(([imgs]) => {
      if (!alive) return;
      const bad: number[] = [];
      post.slides.forEach((s, i) => {
        const c = canvases.current[i];
        if (c && !drawSlide(c, s, i, post.slides.length, { sans: family, script }, imgs)) bad.push(i + 1);
      });
      setOverflow(bad);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [post, family, script]);

  function blobs(): Promise<File[]> {
    return Promise.all(
      post.slides.map(
        (_, i) =>
          new Promise<File>((resolve) =>
            canvases.current[i]!.toBlob(
              (b) => resolve(new File([b!], `slide-${i + 1}.png`, { type: "image/png" })),
              "image/png",
            ),
          ),
      ),
    );
  }

  async function share() {
    const files = await blobs();
    // בטלפון: גיליון השיתוף של המערכת, משם ישר לאינסטגרם
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, text: caption }).catch(() => {});
      return;
    }
    download(files);
  }

  function download(files?: File[]) {
    const run = (list: File[]) =>
      list.forEach((f, i) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(f);
          a.download = f.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }, i * 350);
      });
    if (files) run(files);
    else blobs().then(run);
  }

  return (
    <div className="space-y-4">
      {overflow.length > 0 && (
        <p className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          התוכן בשקף {overflow.join(", ")} ארוך מדי ונחתך. קצר את הטקסט או בחר פחות חבילות.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {post.slides.map((_, i) => (
          <canvas
            key={i}
            ref={(el) => {
              canvases.current[i] = el;
            }}
            className="aspect-[4/5] w-full rounded-md border border-line bg-surface-2"
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon="upload" disabled={!ready} onClick={share}>
          שיתוף לאינסטגרם
        </Button>
        <Button icon="download" disabled={!ready} onClick={() => download()}>
          הורדת השקפים
        </Button>
      </div>

      <section className="rounded-card border border-line bg-surface p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">כיתוב</h2>
          <Button variant="ghost" onClick={onCopy}>
            {copied ? "הועתק ✓" : "העתקה"}
          </Button>
        </div>
        <textarea
          className={`${inputClass} min-h-56 leading-relaxed`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="mt-2 text-xs text-ink-4">
          באינסטגרם מהמחשב החיתוך מתחיל ב-1:1. בחרו 4:5 כדי שהשקף לא ייחתך.
        </p>
      </section>
    </div>
  );
}
