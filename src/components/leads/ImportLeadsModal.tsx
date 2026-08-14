"use client";

import { useRef, useState, useTransition } from "react";
import { importLeadsAction, type ImportRow } from "@/app/(app)/leads/actions";
import { decodeSpreadsheetText, parseDelimited } from "@/lib/csv";
import { readXlsxSheet } from "@/lib/xlsx";
import {
  LEAD_CATEGORY_CONFIG,
  PROVIDER_CONFIG,
  matchImportField,
  matchLeadCategory,
  type LeadImportField,
} from "@/lib/domain/types";
import { cleanText, matchProvider, parseInterest } from "@/lib/domain/interest";
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
          <p className="mt-2 text-xs text-ink-4">
            עמודות שנקלטות: שם · טלפון · אימייל · עיר · קטגוריה · חבילה (או
            &quot;שם חבילה&quot;) · ספק (או &quot;שם חברה&quot;) · מקור · הערה ·
            מזהה
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

          {/*
            ⚠️ `min-w-[520px]` ו-`whitespace-nowrap` — בלעדיהם `w-full`
            ניצח והדחיס שש עמודות לכ-40px כל אחת בתוך המודל של 288px
            בטלפון. כלומר בדיוק המסך שכל תכליתו היא **לוודא שהפענוח יצא
            נכון** לפני הכתיבה, היה בלתי קריא. עדיף לגלול לצדדים ולראות
            ערכים שלמים מאשר לראות את כולם חתוכים.
            `scroll-x-cue` נותן את הסימן שיש לאן לגלול.
          */}
          <div className="scroll-thin scroll-x-cue overflow-x-auto rounded-card border border-line [--scroll-cue-bg:var(--c-surface)]">
            <table className="w-full min-w-[520px] border-collapse whitespace-nowrap text-sm">
              <thead className="bg-surface-2 text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-start font-medium">שם</th>
                  <th className="px-3 py-2 text-start font-medium">טלפון</th>
                  {/* קטגוריה וחבילה מוצגות כי הן מה שנגזר מהקובץ ולא
                      נקרא ממנו ישירות — זו הנקודה היחידה לראות שהפענוח
                      של "פלאפון – 300GB Perfect" יצא נכון, לפני הכתיבה */}
                  <th className="px-3 py-2 text-start font-medium">קטגוריה</th>
                  <th className="px-3 py-2 text-start font-medium">חבילה</th>
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
                    <td className="px-3 py-2 text-ink-3">
                      {row.category ? LEAD_CATEGORY_CONFIG[row.category].label : "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-3">
                      {packageLabel(row) || "—"}
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

/**
 * ספק + חבילה כמחרוזת אחת — אותה תצוגה כמו בטבלת הלידים ובכרטיס.
 * "ULTIMATE" בלי "יס" הוא לא שם חבילה שאפשר לאמת מולו את הקובץ.
 */
function packageLabel(row: ImportRow): string {
  return [
    row.currentProvider ? PROVIDER_CONFIG[row.currentProvider].label : "",
    row.packageName ?? "",
  ]
    .filter(Boolean)
    .join(" ");
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

/**
 * מזהה חיצוני נכנס להערה — אין לו עמודה משלנו, והוא הדרך היחידה
 * להצליב ליד מול המערכת שהוא הגיע ממנה.
 *
 * הסף קיים כי עמודת `#` היא לפעמים מזהה אמיתי ולפעמים סתם מונה שורות.
 * "מזהה חיצוני: 3" הוא רעש; "מזהה חיצוני: 42557025" הוא מידע.
 */
const MIN_EXTERNAL_ID_LENGTH = 4;

function buildRow(cells: string[], mapping: Mapping): ImportRow {
  const at = (field: LeadImportField): string => {
    const i = mapping[field];
    return i === undefined ? "" : cleanText(cells[i] ?? "");
  };

  // ⚠️ עמודת החבילה של השותף מכילה בפועל **שני** פרטים במחרוזת אחת
  // ("פלאפון – 300GB Perfect"), ולפעמים דווקא קטגוריה ("טריפל").
  // אותו פענוח בדיוק שמשמש את `POST /api/leads` — ראה domain/interest.
  const rawPackage = at("packageName");
  const parsed = parseInterest(rawPackage);

  // עמודת ספק מפורשת גוברת על מה שנחלץ מתוך שם החבילה
  const provider = matchProvider(at("provider")) ?? parsed.provider;
  const category = matchLeadCategory(at("category")) ?? parsed.category;

  // אם הפענוח לא זיהה כלום, שם החבילה נשמר כפי שהוא — עדיף ערך גולמי
  // מאשר לאבד אותו רק כי לא הצלחנו לפרק אותו
  const packageName = parsed.packageName ?? (parsed.category ? "" : rawPackage);

  const externalId = at("externalId");
  const notes = [
    at("note"),
    externalId.length >= MIN_EXTERNAL_ID_LENGTH
      ? `מזהה חיצוני: ${externalId}`
      : "",
  ].filter(Boolean);

  return {
    name: at("name"),
    phone: at("phone"),
    email: at("email") || undefined,
    city: at("city") || undefined,
    note: notes.join("\n") || undefined,
    sourceDetail: at("sourceDetail") || undefined,
    packageName: packageName || undefined,
    currentProvider: provider,
    category,
  };
}
