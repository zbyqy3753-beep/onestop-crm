"use client";

import { useMemo, useState } from "react";
import type { Feedback, FeedbackKind } from "@/lib/domain/feedback";
import {
  FEEDBACK_KIND_CONFIG,
  FEEDBACK_KIND_ORDER,
} from "@/lib/domain/feedback";
import {
  StatusBreakdownStrip,
  type StatusSegment,
} from "@/components/ui/StatusBreakdownStrip";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackList } from "./FeedbackList";

/**
 * מסך המשוב. הסינון לפי סוג נעשה בצד הלקוח על מלוא הרשימה
 * שהגיעה מהשרת — אותה רוח כמו `RegistrationsClient`.
 */
export function FeedbackClient({ items }: { items: Feedback[] }) {
  const [kindFilter, setKindFilter] = useState<FeedbackKind | null>(null);

  const segments: StatusSegment[] = useMemo(
    () =>
      FEEDBACK_KIND_ORDER.map((k) => ({
        key: k,
        label: FEEDBACK_KIND_CONFIG[k].label,
        count: items.filter((i) => i.kind === k).length,
        tone: FEEDBACK_KIND_CONFIG[k].tone,
      })),
    [items],
  );

  const visible = useMemo(
    () => (kindFilter ? items.filter((i) => i.kind === kindFilter) : items),
    [items, kindFilter],
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-xl font-bold">משוב על המערכת</h1>
        <p className="mt-1 text-sm text-ink-3">
          מצאת באג או יש לך רעיון? כתוב כאן — זה מה שמכוון את הפיתוח.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <FeedbackForm />

        <section className="min-w-0">
          <StatusBreakdownStrip
            segments={segments}
            activeKeys={kindFilter ? [kindFilter] : []}
            onToggle={(key) =>
              setKindFilter((c) => (c === key ? null : (key as FeedbackKind)))
            }
          />
          <div className="mt-4">
            <FeedbackList items={visible} />
          </div>
        </section>
      </div>
    </div>
  );
}
