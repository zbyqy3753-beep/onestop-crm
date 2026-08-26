"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { MailerOverview } from "@/server/mailer/overview";

export function CampaignList({ overview }: { overview: MailerOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function togglePause() {
    setBusy(true);
    try {
      await fetch("/api/email/pause", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: !overview.paused }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section dir="rtl" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          יצאו היום {overview.sentToday}
          {overview.dailyCap > 0 ? ` מתוך ${overview.dailyCap}` : ""}
        </p>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => void togglePause()}
        >
          {overview.paused ? "הפעל שליחה" : "עצור שליחה"}
        </button>
      </div>

      {overview.paused && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-3 text-sm">
          השליחה עצורה. התור נשמר וימשיך כשתפעיל אותה.
        </p>
      )}

      {overview.campaigns.length > 0 && (
        <table className="w-full text-right text-sm">
          <thead className="text-ink-2">
            <tr>
              <th className="p-2">דיוור</th>
              <th className="nums p-2">נשלחו</th>
              <th className="nums p-2">ממתינים</th>
              <th className="nums p-2">נכשלו</th>
            </tr>
          </thead>
          <tbody>
            {overview.campaigns.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-2">{c.name}</td>
                <td className="nums p-2">
                  {c.sent}/{c.total}
                </td>
                <td className="nums p-2">{c.pending}</td>
                <td className="nums p-2">{c.failed || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
