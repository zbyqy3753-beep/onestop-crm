"use client";

import { useActionState } from "react";
import { createPostRequest } from "@/app/(app)/posts/actions";
import { Badge, Button, Field, inputClass } from "@/components/ui/primitives";

export interface RequestView {
  id: string;
  topic: string;
  notes: string | null;
  status: "pending" | "done" | "failed";
  resultUrl: string | null;
  resultNote: string | null;
  by: string | null;
  createdAt: string;
}

const STATUS = {
  pending: { label: "ממתין", tone: "warn" },
  done: { label: "פורסם", tone: "good" },
  failed: { label: "לא בוצע", tone: "bad" },
} as const;

/**
 * בקשה ל-Claude: נכנסת לתור, והמשימה המתוזמנת מכינה ומפרסמת אותה בריצה
 * הבאה. אין כאן שום קריאה ל-AI: זה רק תור, והעבודה נעשית במשימה.
 */
export function RequestPanel({ requests }: { requests: RequestView[] }) {
  const [state, action, pending] = useActionState(createPostRequest, null);

  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="font-display text-base font-semibold">בקשה מ-Claude</h2>
      <p className="mb-4 mt-1 text-xs text-ink-3">
        כתבו על מה הפוסט. Claude יעצב, יכתוב ויפרסם אותו ב-@telecom4you בריצה הבאה של המשימה
        האוטומטית (פעם ביומיים).
      </p>

      <form key={state?.ok ? "sent" : "draft"} action={action} className="space-y-3">
        <Field label="נושא">
          <input
            name="topic"
            className={inputClass}
            placeholder="למשל: פוסט על הנחה בחשמל בלילה"
            maxLength={300}
            required
          />
        </Field>
        <Field label="הערות" hint="לא חובה: חבילות מסוימות, מה להדגיש, מה לא לכתוב.">
          <textarea name="notes" className={`${inputClass} min-h-20`} maxLength={1500} />
        </Field>
        {state?.error && <p className="text-sm text-bad">{state.error}</p>}
        {state?.ok && <p className="text-sm text-good">הבקשה נשלחה ✓</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "שולח…" : "שליחת בקשה"}
        </Button>
      </form>

      {requests.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-line pt-4">
          {requests.map((r) => (
            <li key={r.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-medium text-ink-1">{r.topic}</span>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-ink-4">
                {r.by ?? "לא ידוע"} · {new Date(r.createdAt).toLocaleDateString("he-IL")}
              </div>
              {r.resultUrl && (
                <a
                  href={r.resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block text-xs text-brand hover:underline"
                >
                  לפוסט באינסטגרם
                </a>
              )}
              {r.resultNote && <p className="mt-0.5 text-xs text-ink-3">{r.resultNote}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
