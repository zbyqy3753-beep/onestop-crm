"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  BROADCAST_MAX_CHARS,
  normalizeBroadcastText,
  parsePhoneList,
  renderBroadcastPreview,
} from "@/lib/domain/broadcast";
import { phone as formatPhone } from "@/lib/format";
import type { BroadcastOverview } from "@/server/whatsapp/broadcast";

interface SendResult {
  queued: number;
  optedOut: number;
  invalid: number;
  duplicates: number;
}

/**
 * מסך הדיוור בוואטסאפ — מדביקים מספרים, כותבים הודעה, שולחים.
 *
 * ⚠️ **הפענוח קורה תוך כדי הקלדה ולא בשליחה.** רשימה שהודבקה מאקסל
 * מכילה כמעט תמיד שורה או שתיים שאינן מספר, והמקום לגלות את זה הוא
 * לפני הלחיצה — לא בדוח כישלונות אחריה.
 */
export function BroadcastClient({
  configured,
  overview,
}: {
  configured: boolean;
  overview: BroadcastOverview;
}) {
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const parsed = useMemo(() => parsePhoneList(raw), [raw]);
  const normalized = normalizeBroadcastText(message);
  const preview = useMemo(() => renderBroadcastPreview(message), [message]);
  const hasLineBreaks = message.trim().includes("\n");

  /*
   * ⚠️ הערכה גסה בימים, ובכוונה מוצגת מראש. התקרה היומית משותפת עם
   * תזכורות הבוט, ורשימה של 800 מספרים אינה יוצאת היום — מי שלא
   * יודע את זה מדווח על תקלה בערב.
   */
  const days = useMemo(() => {
    const cap = overview.dailyCap;
    if (cap <= 0) return 1;
    const room = Math.max(1, cap - overview.sentToday);
    if (parsed.valid.length <= room) return 1;
    return 1 + Math.ceil((parsed.valid.length - room) / cap);
  }, [parsed.valid.length, overview.dailyCap, overview.sentToday]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, message, phones: raw }),
      });
      const json = await response.json();
      if (!json.success) {
        setError(json.error ?? "השליחה נכשלה");
        return;
      }
      setResult(json as SendResult);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <main dir="rtl" className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">דיוור וואטסאפ</h1>
        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <p className="font-medium">{result.queued} הודעות נכנסו לתור</p>
          <ul className="text-sm text-ink-2">
            <li>מספרים פסולים שדולגו: {result.invalid}</li>
            <li>כפילויות שאוחדו: {result.duplicates}</li>
            <li>מוסרים מרשימת התפוצה: {result.optedOut}</li>
          </ul>
          <p className="text-sm text-ink-2">
            השליחה מתפרסת לפי חלון השליחה והתקרה היומית ואינה יוצאת בבת אחת.
            ההתקדמות מוצגת במסך{" "}
            <Link className="underline" href="/bots">
              הבוטים
            </Link>
            .
          </p>
          <button
            type="button"
            className="self-start rounded-lg border border-line px-3 py-2 text-sm"
            onClick={() => {
              setResult(null);
              setRaw("");
              setMessage("");
              setName("");
            }}
          >
            דיוור נוסף
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">דיוור וואטסאפ</h1>

      <p className="text-sm text-ink-2">
        יצאו היום {overview.sentToday}
        {overview.dailyCap > 0 ? ` מתוך ${overview.dailyCap}` : ""} · מוסרים
        מרשימת התפוצה: {overview.optedOut}
      </p>

      {!configured && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-4 text-sm">
          השליחה אינה מוגדרת. חסרים <code>WHATSAPP_TOKEN</code> או{" "}
          <code>WHATSAPP_PHONE_NUMBER_ID</code>. אפשר להכין דיוור, אבל הוא לא
          ייצא.
        </p>
      )}

      {overview.paused && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-4 text-sm">
          שליחת הוואטסאפ עצורה כרגע. התור נשמר וימשיך כשתופעל מחדש במסך{" "}
          <Link className="underline" href="/bots">
            הבוטים
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/8 p-4 text-sm">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm">מספרי הטלפון</span>
        <textarea
          dir="ltr"
          className="min-h-32 rounded-lg border border-line bg-surface-2 p-3 text-left"
          placeholder="0501234567, 0521112233…"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <span className="text-sm text-ink-2">
          אפשר להדביק מאקסל או מהודעה — פסיקים, שורות ורווחים כולם עובדים.
        </span>
      </label>

      {raw.trim() && (
        <p className="text-sm text-ink-2">
          {parsed.valid.length} מספרים תקינים
          {parsed.duplicates > 0 && ` · ${parsed.duplicates} כפילויות אוחדו`}
          {parsed.invalid.length > 0 && (
            <span className="text-warn">
              {" · "}
              {parsed.invalid.length} לא זוהו:{" "}
              {parsed.invalid.slice(0, 5).join(", ")}
              {parsed.invalid.length > 5 && "…"}
            </span>
          )}
        </p>
      )}

      <input
        className="rounded-lg border border-line bg-surface-2 p-3"
        placeholder="שם הדיוור (פנימי, לא חובה)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="flex flex-col gap-2">
        <span className="text-sm">ההודעה</span>
        <textarea
          className="min-h-32 rounded-lg border border-line bg-surface-2 p-3"
          maxLength={BROADCAST_MAX_CHARS}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className="text-sm text-ink-2">
          {normalized.length}/{BROADCAST_MAX_CHARS} תווים
        </span>
      </label>

      {/*
        ⚠️ התצוגה המקדימה מציגה את ההודעה **המלאה** ולא רק את מה
        שהוקלד: הפתיח, הסיומת וההסרה הם חלק מהתבנית המאושרת ויוצאים
        תמיד. בלי זה המשתמש כותב פתיח משלו ומקבל שניים.
      */}
      <div className="rounded-lg border border-line p-4">
        <p className="mb-2 text-xs text-ink-2">
          כך הלקוח יראה את ההודעה
          {parsed.valid[0]
            ? ` — ${formatPhone(`0${parsed.valid[0].slice(3)}`)}`
            : ""}
        </p>
        <p className="whitespace-pre-wrap text-sm">{preview}</p>
        {hasLineBreaks && (
          <p className="mt-2 text-xs text-warn">
            ⚠️ ירידות שורה אינן נתמכות בהודעה יזומה ויאוחדו לרווח — כך מטא
            מחייבים. התצוגה למעלה היא מה שייצא בפועל.
          </p>
        )}
      </div>

      {!confirming ? (
        <button
          type="button"
          className="rounded-lg bg-brand p-3 font-medium disabled:opacity-50"
          disabled={!normalized || parsed.valid.length === 0}
          onClick={() => setConfirming(true)}
        >
          המשך לאישור
        </button>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
          <p className="text-sm">
            ההודעה תישלח ל-<strong>{parsed.valid.length}</strong> מספרים.
            {days > 1 && ` לפי התקרה היומית זה יימשך כ-${days} ימים.`}
          </p>
          <p className="text-sm text-ink-2">
            מי שביקש בעבר להסיר את עצמו ידולג אוטומטית, והספירה הסופית תוצג
            אחרי השליחה.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-brand p-3 font-medium disabled:opacity-50"
              disabled={busy || !configured}
              onClick={() => void send()}
            >
              {busy ? "מכניס לתור…" : `שלח ל-${parsed.valid.length} מספרים`}
            </button>
            <button
              type="button"
              className="rounded-lg border border-line p-3"
              onClick={() => setConfirming(false)}
            >
              חזרה
            </button>
          </div>
        </div>
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
    </main>
  );
}
