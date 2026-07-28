"use client";

import type { Lead, StatusTone, User } from "@/lib/domain/types";
import { ACTIVITY_CONFIG, STATUS_CONFIG } from "@/lib/domain/types";
import { TONE_VAR, dateTime } from "@/lib/format";

/**
 * ציר הזמן של הליד — שינויי סטטוס, פעולות והערות, ממוזגים לרשימה אחת.
 *
 * שלושת המקורות נשמרים בנפרד ב-DB (סמנטיקה שונה), אבל למי שקורא את
 * הליד זה סיפור אחד ברצף כרונולוגי אחד.
 */

interface Entry {
  id: string;
  at: string;
  tone: StatusTone;
  title: string;
  detail?: string;
  actorId: string;
}

export function buildTimeline(lead: Lead, userById: Map<string, User>): Entry[] {
  const name = (id?: string) => (id ? userById.get(id)?.name : undefined);

  const entries: Entry[] = [
    ...lead.history.map((e) => ({
      id: `status:${e.id}`,
      at: e.createdAt,
      tone: STATUS_CONFIG[e.to].tone,
      title: e.from
        ? `${STATUS_CONFIG[e.from].label} ← ${STATUS_CONFIG[e.to].label}`
        : STATUS_CONFIG[e.to].label,
      detail: e.detail,
      actorId: e.actorId,
    })),
    ...lead.activity.map((a) => ({
      id: `act:${a.id}`,
      at: a.createdAt,
      tone: ACTIVITY_CONFIG[a.type].tone,
      title: ACTIVITY_CONFIG[a.type].text(name(a.targetUserId)),
      detail: a.detail,
      actorId: a.actorId,
    })),
    ...lead.notes.map((n) => ({
      id: `note:${n.id}`,
      at: n.createdAt,
      tone: "neutral" as StatusTone,
      title: "הערה",
      detail: n.body,
      actorId: n.authorId,
    })),
  ];

  // החדש למעלה — זה מה שמעניין כשפותחים ליד
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function ActivityFeed({
  lead,
  userById,
}: {
  lead: Lead;
  userById: Map<string, User>;
}) {
  const entries = buildTimeline(lead, userById);

  if (entries.length === 0) {
    return <p className="text-sm text-ink-4">אין עדיין פעילות.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-2.5">
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ background: TONE_VAR[entry.tone] }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-1">{entry.title}</p>
            {entry.detail && (
              <p className="mt-0.5 text-sm text-ink-2">{entry.detail}</p>
            )}
            <p className="mt-0.5 text-xs text-ink-4">
              {userById.get(entry.actorId)?.name ?? "—"}
              {" · "}
              <span className="nums">{dateTime(entry.at)}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
