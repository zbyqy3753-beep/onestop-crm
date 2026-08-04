"use client";

import { useRef, useState, useTransition } from "react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { relative } from "@/lib/format";
import { useNow } from "@/components/ui/primitives";
import {
  deleteRenewalDocAction,
  uploadRenewalDocsAction,
  type UploadOutcome,
} from "@/app/(app)/renewals/actions";
import { extractContactsAction } from "@/app/(app)/renewals/campaignActions";
import { ContactList, type RenewalContactRow } from "./ContactList";

/**
 * העלאת מסמכי חידוש והצגת מה שחולץ מהם.
 *
 * המסך הזה הוא **שלב ראשון מכוון**: הוא מעלה, שומר ומראה את הטקסט
 * הגולמי — ולא מנסה לזהות שם, טלפון או חבילה. חילוץ שדות מחשבונית
 * תלוי לגמרי במבנה שלה, ובלי לראות מסמכים אמיתיים כל כלל שהיינו
 * כותבים היה ניחוש. הטקסט שמוצג כאן הוא מה שיאפשר לכתוב אותם נכון,
 * בלי להעלות שוב את כל האצווה.
 */

export interface RenewalDoc {
  id: string;
  fileName: string;
  byteSize: number;
  status: "uploaded" | "extracted" | "failed";
  pageCount: number | null;
  error: string | null;
  textPreview: string | null;
  textLength: number;
  createdAt: string;
  uploadedByName: string;
  contactCount: number;
}

export function RenewalsClient({
  docs,
  contacts,
}: {
  docs: RenewalDoc[];
  contacts: RenewalContactRow[];
}) {
  const [pending, start] = useTransition();
  const [outcomes, setOutcomes] = useState<UploadOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0) return;

    const fd = new FormData();
    for (const f of list) fd.append("files", f);

    setError(null);
    setOutcomes(null);
    start(async () => {
      const res = await uploadRenewalDocsAction(fd);
      if (res.ok) setOutcomes(res.data ?? []);
      else setError(res.error);
    });
  };

  const extracted = docs.filter((d) => d.status === "extracted").length;
  const failed = docs.filter((d) => d.status === "failed").length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
          חידושים
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          מסמכים של לקוחות שהשנה שלהם הסתיימה.{" "}
          {docs.length > 0 && (
            <>
              <span className="nums font-semibold text-ink-1">{extracted}</span>{" "}
              נקראו
              {failed > 0 && (
                <>
                  {" · "}
                  <span className="nums font-semibold text-bad">{failed}</span>{" "}
                  נכשלו
                </>
              )}
            </>
          )}
        </p>
      </header>

      <DropZone pending={pending} onFiles={send} />

      {error && (
        <p className="mt-3 rounded-card border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
          {error}
        </p>
      )}

      {outcomes && <UploadReport outcomes={outcomes} />}

      <div className="mt-6">
        {docs.length === 0 ? (
          <EmptyState
            icon="upload"
            title="עדיין לא הועלו מסמכים"
            body="גרור לכאן קובצי PDF של לקוחות שהשנה שלהם הסתיימה."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((d) => (
              <DocRow key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </div>

      <ContactList rows={contacts} />
    </div>
  );
}

/* ── אזור הגרירה ──────────────────────────────────────────────────────── */

function DropZone({
  pending,
  onFiles,
}: {
  pending: boolean;
  onFiles: (files: FileList | File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors ${
        over ? "border-brand bg-brand/8" : "border-line bg-surface"
      }`}
    >
      <Icon
        name="upload"
        size={28}
        className="mx-auto mb-2 text-ink-4"
      />

      <p className="text-sm font-medium text-ink-1">
        {pending ? "מעלה וקורא…" : "גרור לכאן קובצי PDF"}
      </p>
      <p className="mt-1 text-xs text-ink-4">
        אפשר כמה קבצים יחד · עד 10MB לקובץ
      </p>

      {/* הקלט מוסתר ולא `hidden`: דפדפנים מדלגים על שדה עם display:none
          בניווט מקלדת, וזו הדרך היחידה להעלות בלי עכבר */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          // איפוס, אחרת בחירת אותו קובץ פעמיים ברצף לא מפעילה change
          e.target.value = "";
        }}
      />

      <Button
        variant="secondary"
        className="mt-3"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        בחירת קבצים
      </Button>
    </div>
  );
}

/* ── סיכום ההעלאה ─────────────────────────────────────────────────────── */

function UploadReport({ outcomes }: { outcomes: UploadOutcome[] }) {
  const good = outcomes.filter((o) => o.ok).length;
  const bad = outcomes.length - good;

  return (
    <div className="mt-3 rounded-card border border-line bg-surface px-3 py-2.5">
      <p className="text-sm font-medium text-ink-1">
        <span className="nums">{good}</span> נקלטו
        {bad > 0 && (
          <>
            {" · "}
            <span className="nums text-bad">{bad}</span> נכשלו
          </>
        )}
      </p>

      <ul className="mt-1.5 flex flex-col gap-1">
        {outcomes.map((o, i) => (
          <li
            key={`${o.fileName}-${i}`}
            className="flex items-center gap-2 text-xs"
          >
            <Icon
              name={o.ok ? "check" : "close"}
              size={13}
              className={o.ok ? "shrink-0 text-good" : "shrink-0 text-bad"}
            />
            <span className="truncate text-ink-2">{o.fileName}</span>
            {o.note && <span className="text-ink-4">— {o.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── שורת מסמך ────────────────────────────────────────────────────────── */

function DocRow({ doc }: { doc: RenewalDoc }) {
  const now = useNow();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const kb = Math.max(1, Math.round(doc.byteSize / 1024));

  return (
    <li className="rounded-card border border-line bg-surface">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-1">
            <span className="truncate">{doc.fileName}</span>
            {doc.status === "extracted" ? (
              <Badge tone="good">נקרא</Badge>
            ) : (
              <Badge tone="bad">נכשל</Badge>
            )}
          </p>

          <p className="mt-0.5 text-xs text-ink-4">
            <span className="nums">{kb}</span> KB
            {doc.pageCount !== null && (
              <>
                {" · "}
                <span className="nums">{doc.pageCount}</span> עמ׳
              </>
            )}
            {doc.textLength > 0 && (
              <>
                {" · "}
                <span className="nums">{doc.textLength}</span> תווים
              </>
            )}
            {" · "}
            {doc.uploadedByName}
            {now !== null && <> · {relative(doc.createdAt, now)}</>}
          </p>

          {doc.error && (
            <p className="mt-1 text-xs text-bad">{doc.error}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          {/*
            החילוץ מופרד מההעלאה בכוונה, והוא **לא** שולח כלום — הוא
            רק ממלא את רשימת הלקוחות למטה, שם יש שער אישור נפרד.
          */}
          {doc.status === "extracted" && (
            <Button
              variant={doc.contactCount > 0 ? "ghost" : "secondary"}
              className="h-8 px-2 text-xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await extractContactsAction(doc.id);
                  if (res.ok && res.data) {
                    const { created, skippedPages, duplicates } = res.data;
                    setNote(
                      [
                        `${created} לקוחות חולצו`,
                        duplicates.length
                          ? `${duplicates.length} כבר קיימים (${duplicates.join(", ")})`
                          : null,
                        skippedPages.length
                          ? `עמודים שלא נקראו: ${skippedPages.join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    );
                  }
                })
              }
            >
              {doc.contactCount > 0
                ? `${doc.contactCount} לקוחות`
                : "חלץ לקוחות"}
            </Button>
          )}

          <Button
            variant="ghost"
            icon="trash"
            className="h-8 px-2 text-xs"
            disabled={pending}
            aria-label={`מחיקת ${doc.fileName}`}
            onClick={() =>
              start(() => deleteRenewalDocAction(doc.id).then(() => {}))
            }
          >
            מחיקה
          </Button>
        </div>
      </div>

      {note && (
        <p className="border-t border-line px-3 py-1.5 text-xs text-ink-3">
          {note}
        </p>
      )}

      {doc.textPreview && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-3 py-2 text-xs text-ink-3">
            הטקסט שחולץ
          </summary>
          {/*
           * ⚠️ `dir="ltr"` ו-`whitespace-pre-wrap` בכוונה, גם שהתוכן
           * עברי. זו תצוגת אבחון: הסדר שבו התווים יצאו מה-PDF הוא בדיוק
           * המידע שצריך כדי לכתוב את חילוץ השדות, ו-RTL אוטומטי היה
           * מסדר אותם מחדש ומסתיר את מה שבאנו לראות.
           */}
          <pre
            dir="ltr"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-t border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-2"
          >
            {doc.textPreview}
            {doc.textLength > doc.textPreview.length && "\n\n… (מקוצר)"}
          </pre>
        </details>
      )}
    </li>
  );
}
