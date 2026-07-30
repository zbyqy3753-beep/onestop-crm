"use client";

import { useRef, useState, useTransition } from "react";
import { importLeadsAction, type ImportRow } from "@/app/(app)/leads/actions";
import { decodeSpreadsheetText, parseDelimited } from "@/lib/csv";
import { readXlsxSheet } from "@/lib/xlsx";
import {
  matchImportField,
  matchLeadCategory,
  type LeadImportField,
} from "@/lib/domain/types";
import { isIsraeliPhone, phone as formatPhone } from "@/lib/format";
import { Button, Modal, type Toast } from "@/components/ui/primitives";

/**
 * ייבוא לידים מקובץ.
 *
 * שני שלבים במכוון: קוראים את הקובץ, מראים מה נמצא, ורק אז כותבים.
 * בלי התצוגה המקדימה הפעולה בשרת זורקת שורות פסולות בשקט ומחזירה
 * מספר — וזה בדיוק הרגע שבו משתמש מגלה שחצי מהקובץ נעלם.
 *
 * .xlsx נקרא בצד הלקוח דרך `xlsx.ts` (מנתח ZIP+XML עצמאי, בלי
 * ספרייה). .xls בינארי (פורמט BIFF ישן) נשאר לא נתמך — אין דרך
 * סבירה לפענח אותו בלי ספרייה ייעודית.
 */

const ACCEPT = ".csv,.txt,.tsv,.xlsx";
const PREVIEW_ROWS = 5;

interface Parsed {
  filename: string;
  rows: ImportRow[];
  /** שורות שנקראו מהקובץ אבל לא עברו ולידציה */
  invalid: number;
  /** האם זוהתה שורת כותרות */
  hadHeader: boolean;
}

export function ImportLeadsModal({
  open,
  onClose,
  onNotify,
}: {
  open: boolean;
  onClose: () => void;
  onNotify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setParsed(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  async function readFile(file: File) {
    setError(null);
    setParsed(null);

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xls")) {
      setError(
        "קובץ .xls (פורמט אקסל ישן) לא נתמך. פתח אותו באקסל ושמור בשם .xlsx או CSV, ונסה שוב.",
      );
      return;
    }

    let matrix: string[][];
    try {
      matrix = lower.endsWith(".xlsx")
        ? await readXlsxSheet(await file.arrayBuffer())
        : parseDelimited(decodeSpreadsheetText(await file.arrayBuffer()));
    } catch (e) {
      setError(
        e instanceof Error
          ? `קריאת הקובץ נכשלה: ${e.message}`
          : "קריאת הקובץ נכשלה — ודא שזה קובץ CSV או XLSX תקין.",
      );
      return;
    }

    if (matrix.length === 0) {
      setError("הקובץ ריק");
      return;
    }

    const { mapping, hadHeader } = detectColumns(matrix[0]);
    const body = hadHeader ? matrix.slice(1) : matrix;

    const rows: ImportRow[] = [];
    let invalid = 0;

    for (const cells of body) {
      const row = buildRow(cells, mapping);
      if (row.name.trim().length >= 2 && isIsraeliPhone(row.phone)) rows.push(row);
      else invalid++;
    }

    if (rows.length === 0) {
      // כשזוהתה כותרת אבל לא נמצאה עמודת שם/טלפון, האשם הוא הכותרת
      // ולא הנתונים. ההודעה הישנה ("לא נמצאה אף שורה תקינה") שלחה את
      // המשתמש לבדוק את הטלפונים בקובץ, בזמן שהבעיה הייתה שהעמודה
      // בכלל לא מופתה. מניית הכותרות שכן זוהו הופכת את זה לפתיר.
      const missing: string[] = [];
      if (hadHeader && mapping.name === undefined) missing.push("שם");
      if (hadHeader && mapping.phone === undefined) missing.push("טלפון");

      if (missing.length > 0) {
        const found = matrix[0].map((c) => c.trim()).filter(Boolean).join(", ");
        setError(
          `לא זוהתה עמודת ${missing.join(" ועמודת ")}. הכותרות שנמצאו בקובץ: ${found}`,
        );
        return;
      }

      setError(
        hadHeader
          ? "לא נמצאה אף שורה תקינה. כל שורה צריכה שם (2 תווים לפחות) וטלפון ישראלי."
          : "לא זוהו כותרות ולא נמצאה אף שורה תקינה. ודא שהעמודה הראשונה היא שם והשנייה טלפון.",
      );
      return;
    }

    setParsed({ filename: file.name, rows, invalid, hadHeader });
  }

  function confirm() {
    if (!parsed) return;

    startTransition(async () => {
      const res = await importLeadsAction(parsed.rows);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const { imported, duplicates } = res.data!;
      const parts = [`${imported} לידים יובאו`];
      if (duplicates) parts.push(`${duplicates} כפולים דולגו`);
      if (parsed.invalid) parts.push(`${parsed.invalid} שורות נפסלו`);

      onNotify(parts.join(", "));
      close();
    });
  }

  return (
    <Modal open={open} onClose={close} title="ייבוא לידים מקובץ" wide>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readFile(file);
        }}
      />

      {!parsed && (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-sm text-ink-2">
            בחר קובץ CSV או Excel (.xlsx) עם עמודות של שם וטלפון.
          </p>
          <p className="mt-1 text-xs text-ink-3">
            שורת כותרות בעברית או באנגלית תזוהה אוטומטית. אם אין כותרות, העמודה
            הראשונה תיקרא כשם והשנייה כטלפון.
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              icon="upload"
              onClick={() => fileRef.current?.click()}
            >
              בחירת קובץ
            </Button>
          </div>
        </div>
      )}

      {parsed && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-semibold text-ink-1">{parsed.filename}</span>
              <span className="text-ink-3">
                {" · "}
                <span className="nums">{parsed.rows.length}</span> שורות תקינות
                {parsed.invalid > 0 && (
                  <>
                    {" · "}
                    <span className="nums text-warn">{parsed.invalid}</span> נפסלו
                  </>
                )}
              </span>
            </p>
            <Button variant="ghost" onClick={reset}>
              בחירת קובץ אחר
            </Button>
          </div>

          {!parsed.hadHeader && (
            <p className="mb-3 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
              לא זוהתה שורת כותרות — העמודה הראשונה נקראת כשם והשנייה כטלפון.
            </p>
          )}

          <div className="scroll-thin overflow-x-auto rounded-card border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface-2 text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-start font-medium">שם</th>
                  <th className="px-3 py-2 text-start font-medium">טלפון</th>
                  <th className="px-3 py-2 text-start font-medium">אימייל</th>
                  <th className="px-3 py-2 text-start font-medium">עיר</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-1">{row.name}</td>
                    <td className="ltr-num px-3 py-2 text-ink-2">
                      {formatPhone(row.phone)}
                    </td>
                    <td className="px-3 py-2 text-ink-3">{row.email ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-3">{row.city ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsed.rows.length > PREVIEW_ROWS && (
            <p className="mt-2 text-xs text-ink-3">
              ועוד <span className="nums">{parsed.rows.length - PREVIEW_ROWS}</span>{" "}
              שורות…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={pending}>
          ביטול
        </Button>
        <Button
          variant="primary"
          onClick={confirm}
          disabled={!parsed || pending}
        >
          {pending ? "מייבא…" : "ייבוא"}
        </Button>
      </div>
    </Modal>
  );
}

/* ── זיהוי עמודות ─────────────────────────────────────────────────────── */

type Mapping = Partial<Record<LeadImportField, number>>;

/**
 * מנסה לקרוא את השורה הראשונה ככותרות. אם אף עמודה לא מזוהה, נופל
 * למיפוי לפי מיקום — כך שקובץ בלי כותרות עדיין עובד.
 */
function detectColumns(first: string[]): { mapping: Mapping; hadHeader: boolean } {
  const mapping: Mapping = {};

  first.forEach((cell, i) => {
    const field = matchImportField(cell);
    if (field !== undefined && mapping[field] === undefined) mapping[field] = i;
  });

  // כותרות אמיתיות מזהות לפחות שם או טלפון
  if (mapping.name !== undefined || mapping.phone !== undefined) {
    return { mapping, hadHeader: true };
  }

  return { mapping: { name: 0, phone: 1, email: 2, city: 3 }, hadHeader: false };
}

function buildRow(cells: string[], mapping: Mapping): ImportRow {
  const at = (field: LeadImportField): string => {
    const i = mapping[field];
    return i === undefined ? "" : (cells[i] ?? "").trim();
  };

  const category = matchLeadCategory(at("category"));

  return {
    name: at("name"),
    phone: at("phone"),
    email: at("email") || undefined,
    city: at("city") || undefined,
    note: at("note") || undefined,
    sourceDetail: at("sourceDetail") || undefined,
    category,
  };
}
