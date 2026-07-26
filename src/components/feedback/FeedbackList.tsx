"use client";

import type { Feedback } from "@/lib/domain/feedback";
import {
  FEEDBACK_KIND_CONFIG,
  GENERAL_SCREEN,
} from "@/lib/domain/feedback";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { NAV } from "@/components/shell/nav";
import { useNow } from "@/lib/clock";
import { relative } from "@/lib/format";

const SCREEN_LABEL = new Map(
  NAV.flatMap((g) => g.items.map((i) => [i.href, i.label] as const)),
);

export function FeedbackList({ items }: { items: Feedback[] }) {
  // null עד שהלקוח נרשם — מונע אי-התאמת הידרציה בזמנים יחסיים
  const now = useNow();

  if (items.length === 0) {
    return (
      <EmptyState
        icon="note"
        title="אין עדיין משוב"
        body="כשבודקים ישלחו משוב הוא יופיע כאן."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-card border border-line bg-surface p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={FEEDBACK_KIND_CONFIG[item.kind].tone}>
              {FEEDBACK_KIND_CONFIG[item.kind].label}
            </Badge>
            <span className="text-xs text-ink-3">
              {item.screen === GENERAL_SCREEN
                ? "כללי"
                : (SCREEN_LABEL.get(item.screen) ?? item.screen)}
            </span>
            <span className="nums text-xs text-ink-4">{item.rating}/5</span>
            <span className="ms-auto text-xs text-ink-4">
              {now === null ? "" : relative(item.createdAt, now)}
            </span>
          </div>

          <p className="whitespace-pre-wrap text-sm text-ink-1">{item.body}</p>

          <p className="mt-2 text-xs text-ink-4">— {item.reporter}</p>
        </li>
      ))}
    </ul>
  );
}
