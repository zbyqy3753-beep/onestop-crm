"use client";

import { useMemo, useState } from "react";

import { parseDelimited, decodeSpreadsheetText } from "@/lib/csv";
import { readXlsxSheet } from "@/lib/xlsx";
import {
  buildRecipients,
  detectRecipientColumns,
  type DetectedRecipients,
  type ParsedRecipient,
} from "./recipientColumns";
import { emptyFieldsIn, renderMerge } from "@/lib/domain/mailMerge";
import { CampaignList } from "./CampaignList";
import type { MailerOverview } from "@/server/mailer/overview";

interface EnqueueResult {
  campaignId: string;
  queued: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
}

/**
 * אשף הדיוור — העלאה, כתיבה, אישור, שליחה.
 *
 * ⚠️ **הקובץ נקרא בדפדפן ואינו נשלח לשרת.** רק הרשימה המפוענחת
 * נשלחת, ורק אחרי שהמשתמש ראה את הספירות ואישר. קובץ נמענים הוא
 * מידע אישי של אנשים שלא ביקשו כלום — אין סיבה שהוא ינחת בשרת.
 */
export function MailerClient({
  configured,
  sender,
  overview,
}: {
  configured: boolean;
  sender: string | null;
  overview: MailerOverview;
}) {
  const [step, setStep] = useState<"upload" | "write" | "confirm" | "done">(
    "upload",
  );
  const [detected, setDetected] = useState<DetectedRecipients | null>(null);
  const [rows, setRows] = useState<ParsedRecipient[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("שלום {{שם}},\n\n");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnqueueResult | null>(null);

  async function onFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const matrix = file.name.toLowerCase().endsWith(".xlsx")
        ? await readXlsxSheet(buffer)
        : parseDelimited(decodeSpreadsheetText(buffer));

      const d = detectRecipientColumns(matrix);
      if (!d.mapping) {
        setError("לא נמצאה עמודת מייל בקובץ");
        return;
      }
      setDetected(d);
      setRows(buildRecipients(matrix, d));
      setStep("write");
    } catch {
      setError("לא הצלחנו לקרוא את הקובץ. שמור אותו כ-CSV או XLSX ונסה שוב.");
    }
  }

  const valid = useMemo(() => rows.filter((r) => r.email.length > 0), [rows]);
  const invalid = rows.length - valid.length;

  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (const r of valid) {
      if (seen.has(r.email)) count++;
      else seen.add(r.email);
    }
    return count;
  }, [valid]);

  /** כמה נמענים ייצאו עם שדה מיזוג ריק — הסיבה שהספירה הזו קיימת. */
  const withEmptyField = useMemo(
    () =>
      valid.filter(
        (r) =>
          emptyFieldsIn(`${subject}\n${body}`, { ...r.fields, שם: r.name })
            .length > 0,
      ).length,
    [valid, subject, body],
  );

  const preview = useMemo(() => {
    const first = valid[0];
    if (!first) return { subject: "", body: "" };
    const values = { ...first.fields, שם: first.name };
    return {
      subject: renderMerge(subject, values),
      body: renderMerge(body, values),
    };
  }, [valid, subject, body]);

  const fields = useMemo(
    () => (detected ? ["שם", ...detected.headers] : ["שם"]),
    [detected],
  );

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/email/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          subjectTemplate: subject,
          bodyTemplate: body,
          recipients: valid.map((r) => ({
            email: r.email,
            name: r.name,
            fields: r.fields,
          })),
        }),
      });
      const json = await response.json();
      if (!json.success) {
        setError(json.error ?? "השליחה נכשלה");
        return;
      }
      setResult(json as EnqueueResult);
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">דיוור במייל</h1>

      <CampaignList overview={overview} />

      {!configured && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-4 text-sm">
          השליחה אינה מוגדרת. חסרים <code>GMAIL_USER</code>,{" "}
          <code>GMAIL_APP_PASSWORD</code> או <code>MAILER_SECRET</code> — ראה{" "}
          <code>.env.example</code>. אפשר להכין דיוור, אבל הוא לא ייצא.
        </p>
      )}
      {configured && sender && (
        <p className="text-sm text-ink-2">המיילים ייצאו מהכתובת {sender}</p>
      )}

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/8 p-4 text-sm">
          {error}
        </p>
      )}

      {step === "upload" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line p-10 text-center">
          <span className="font-medium">בחר קובץ נמענים</span>
          <span className="text-sm text-ink-2">Excel (.xlsx) או CSV</span>
          <input
            type="file"
            accept=".xlsx,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>
      )}

      {step === "write" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            {valid.length} נמענים תקינים מתוך {rows.length} שורות
          </p>

          <input
            className="rounded-lg border border-line bg-surface-2 p-3"
            placeholder="שם הדיוור (פנימי)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg border border-line bg-surface-2 p-3"
            placeholder="נושא המייל"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="min-h-48 rounded-lg border border-line bg-surface-2 p-3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <p className="text-sm text-ink-2">
            שדות זמינים:{" "}
            {fields.map((f) => (
              <button
                key={f}
                type="button"
                className="mx-1 rounded bg-brand/8 px-2 py-0.5"
                onClick={() => setBody((b) => `${b}{{${f}}}`)}
              >
                {`{{${f}}}`}
              </button>
            ))}
          </p>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-2 text-xs text-ink-2">
              תצוגה מקדימה — {valid[0]?.email ?? "אין נמענים"}
            </p>
            <p className="font-medium">{preview.subject}</p>
            <p className="whitespace-pre-wrap text-sm">{preview.body}</p>
          </div>

          <button
            type="button"
            className="rounded-lg bg-brand p-3 font-medium disabled:opacity-50"
            disabled={
              !name.trim() ||
              !subject.trim() ||
              !body.trim() ||
              valid.length === 0
            }
            onClick={() => setStep("confirm")}
          >
            המשך לאישור
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <ul className="rounded-lg border border-line p-4 text-sm">
            <li>
              נמענים שיקבלו: <strong>{valid.length - duplicate}</strong>
            </li>
            <li>כתובות פסולות שידולגו: {invalid}</li>
            <li>כפילויות שיאוחדו: {duplicate}</li>
            {withEmptyField > 0 && (
              <li className="text-warn">
                ⚠️ {withEmptyField} נמענים עם שדה מיזוג ריק — הטקסט אצלם ייצא
                חסר
              </li>
            )}
          </ul>
          <p className="text-sm text-ink-2">
            מי שהסיר את עצמו בעבר ידולג אוטומטית, והספירה הסופית תוצג אחרי
            השליחה.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-brand p-3 font-medium disabled:opacity-50"
              disabled={busy || !configured}
              onClick={() => void send()}
            >
              {busy ? "מכניס לתור…" : `שלח ל-${valid.length - duplicate} נמענים`}
            </button>
            <button
              type="button"
              className="rounded-lg border border-line p-3"
              onClick={() => setStep("write")}
            >
              חזרה
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <p className="font-medium">{result.queued} מיילים נכנסו לתור</p>
          <ul className="text-sm text-ink-2">
            <li>כתובות פסולות: {result.invalid}</li>
            <li>כפילויות: {result.duplicate}</li>
            <li>מוסרים מרשימת התפוצה: {result.optedOut}</li>
          </ul>
          <p className="text-sm text-ink-2">
            השליחה מתפרסת לפי חלון השליחה והתקרה היומית ואינה יוצאת בבת אחת.
          </p>
        </div>
      )}
    </main>
  );
}
