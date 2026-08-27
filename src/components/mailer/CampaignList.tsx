"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

import type { MailerOverview, RecipientRow } from "@/server/mailer/overview";

/** תווית עברית לכל סטטוס בתור. */
const STATUS_LABEL: Record<string, string> = {
  queued: "ממתין",
  sending: "בשליחה",
  sent: "נשלח",
  failed: "נכשל",
  cancelled: "בוטל — הוסר מהתפוצה",
};

export function CampaignList({ overview }: { overview: MailerOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dailyCap, setDailyCap] = useState(String(overview.dailyCap));
  const [perTick, setPerTick] = useState(String(overview.perTick));

  /* הדיוור הפתוח כרגע, ורשימת הנמענים שלו. `null` = הכול סגור. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);

  async function loadRecipients(campaignId: string, q: string) {
    setLoadingRows(true);
    try {
      const url = `/api/email/recipients?campaignId=${encodeURIComponent(campaignId)}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;
      const json = await fetch(url).then((r) => r.json());
      setRecipients(json.success ? (json.recipients as RecipientRow[]) : []);
    } finally {
      setLoadingRows(false);
    }
  }

  function toggleCampaign(campaignId: string) {
    if (openId === campaignId) {
      setOpenId(null);
      setRecipients(null);
      return;
    }
    setOpenId(campaignId);
    setSearch("");
    setRecipients(null);
    void loadRecipients(campaignId, "");
  }

  async function saveLimits() {
    setBusy(true);
    try {
      await fetch("/api/email/limits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dailyCap: Number(dailyCap), perTick: Number(perTick) }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

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

      {editing ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-ink-2">תקרה ליום</span>
            <input
              type="number"
              min={0}
              max={450}
              className="nums w-24 rounded border border-line bg-surface-2 p-2"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-2">בכל תקתוק</span>
            <input
              type="number"
              min={1}
              max={50}
              className="nums w-24 rounded border border-line bg-surface-2 p-2"
              value={perTick}
              onChange={(e) => setPerTick(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-brand px-3 py-2 font-medium disabled:opacity-50"
            disabled={busy}
            onClick={() => void saveLimits()}
          >
            שמור
          </button>
          <button
            type="button"
            className="rounded-lg border border-line px-3 py-2"
            onClick={() => setEditing(false)}
          >
            ביטול
          </button>
          <p className="w-full text-xs text-ink-2">
            התור לא מתרוקן ולא נמחק — מה שמעל התקרה פשוט ממתין למחר.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="self-start text-sm text-ink-2 underline"
          onClick={() => setEditing(true)}
        >
          שינוי קצב השליחה
        </button>
      )}

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
              <Fragment key={c.id}>
                <tr
                  className="cursor-pointer border-t border-line hover:bg-surface-2"
                  onClick={() => toggleCampaign(c.id)}
                >
                  <td className="p-2">
                    <span className="text-ink-2">{openId === c.id ? "▾" : "◂"}</span>{" "}
                    {c.name}
                  </td>
                  <td className="nums p-2">
                    {c.sent}/{c.total}
                  </td>
                  <td className="nums p-2">{c.pending}</td>
                  <td className="nums p-2">{c.failed || ""}</td>
                </tr>

                {openId === c.id && (
                  <tr>
                    <td colSpan={4} className="p-2">
                      <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
                        <input
                          className="rounded border border-line bg-surface-2 p-2 text-sm"
                          placeholder="חיפוש כתובת או שם"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            void loadRecipients(c.id, e.target.value);
                          }}
                        />

                        {loadingRows && <p className="text-xs text-ink-2">טוען…</p>}

                        {recipients && recipients.length === 0 && !loadingRows && (
                          <p className="text-xs text-ink-2">אין נמענים תואמים</p>
                        )}

                        {recipients && recipients.length > 0 && (
                          <div className="max-h-80 overflow-y-auto">
                            <table className="w-full text-right text-xs">
                              <tbody>
                                {recipients.map((r) => (
                                  <tr key={r.id} className="border-t border-line">
                                    <td className="p-1.5">
                                      {r.email}
                                      {r.name ? (
                                        <span className="text-ink-2"> · {r.name}</span>
                                      ) : null}
                                    </td>
                                    <td className="p-1.5 text-ink-2">
                                      {STATUS_LABEL[r.status] ?? r.status}
                                      {r.error ? ` — ${r.error}` : ""}
                                    </td>
                                    <td className="nums p-1.5 text-ink-2">
                                      {r.sentAt
                                        ? new Date(r.sentAt).toLocaleTimeString("he-IL", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {recipients.length === 500 && (
                              <p className="p-1 text-xs text-warn">
                                מוצגות 500 שורות ראשונות — השתמש בחיפוש
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
