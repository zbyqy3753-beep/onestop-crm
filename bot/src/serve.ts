import { DisconnectReason } from "@whiskeysockets/baileys";
import { connect, type InboundMessage, type WaClient } from "./wa.js";
import { pull, report, reportInbound, type OutboxMessage } from "./crm.js";
import {
  INSTANCE_ID,
  POLL_INTERVAL_MS,
  SEND_GAP_MAX_MS,
  SEND_GAP_MIN_MS,
  isPaired,
} from "./config.js";

/**
 * הלולאה הקבועה: שאל את ה-CRM מה לשלוח, שלח, דווח.
 *
 * הבוט הוא **השעון היחיד** במערכת — אין cron בצד השרת. כשהמחשב כבוי
 * התור מצטבר, וכשהוא חוזר הוא מתנקז. זה גם אומר שכל האמינות תלויה
 * בכך שהתהליך הזה חי, ולכן הוא מדווח דופק בכל סקר גם כשאין מה לשלוח.
 *
 * ⚠️ רץ חסר-ראש: לעולם לא מדפיס QR ולא מחכה לקלט. אם אין חיבור
 * קיים הוא נופל מיד עם הודעה, במקום להיתקע ולחכות לאדם שלא נמצא.
 */

const stamp = () =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());

const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ריווח אקראי — שליחה בקצב מכונה היא בדיוק מה שמסמן בוט. */
const humanGap = () =>
  SEND_GAP_MIN_MS + Math.random() * (SEND_GAP_MAX_MS - SEND_GAP_MIN_MS);

async function deliver(
  wa: WaClient,
  messages: OutboxMessage[],
): Promise<void> {
  const results: { id: string; status: "sent" | "failed"; error?: string }[] =
    [];

  for (const [i, msg] of messages.entries()) {
    if (i > 0) await sleep(humanGap());
    try {
      await wa.send(msg.toPhone, msg.body);
      results.push({ id: msg.id, status: "sent" });
      log(`  ✓ נשלח ל-${msg.toPhone}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      results.push({ id: msg.id, status: "failed", error });
      log(`  ✗ נכשל ל-${msg.toPhone}: ${error}`);
    }
  }

  if (results.length) {
    // דיווח כושל אינו אובדן: שורה שנתבעה ולא דווחה משוחררת בשרת
    // אחרי 5 דקות. המחיר הוא תזכורת כפולה, ולא תזכורת חסרה.
    try {
      await report(results);
    } catch (e) {
      log(`  ⚠ הדיווח ל-CRM נכשל: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function tick(wa: WaClient): Promise<void> {
  const connected = wa.isConnected();

  // לפני הסקר: תשובות שהצטברו מאז הפעם הקודמת. הסדר חשוב — תשובה
  // שקובעת שעה מייצרת הודעת אישור, ורצוי שהיא תיתפס כבר בסקר הזה.
  await flushInbound();

  let res;
  try {
    res = await pull(connected, wa.number());
  } catch (e) {
    log(`⚠ הסקר נכשל: ${e instanceof Error ? e.message : e}`);
    return;
  }

  if (res.recoveredAfterMinutes !== null) {
    log(`↺ חזרה לפעולה אחרי ${res.recoveredAfterMinutes} דקות`);
  }

  if (!connected) {
    log(`○ אין חיבור לוואטסאפ · ${res.queued} בתור`);
    return;
  }

  // ⚠️ בלי השורה הזו בוט מושהה נראה בדיוק כמו בוט בלי עבודה. מי
  // שמסתכל על החלון במשרד היה מחפש תקלה שלא קיימת.
  if (res.paused) {
    log(`⏸ השליחה מושהית ממסך הניהול · ${res.queued} בתור`);
    return;
  }

  if (res.messages.length === 0) return;

  log(`→ ${res.messages.length} תזכורות לשליחה`);
  await deliver(wa, res.messages);
}

/**
 * הודעות נכנסות שממתינות לדיווח.
 *
 * ⚠️ תור בזיכרון ולא דיווח מיידי לכל הודעה. שתי סיבות: לקוח שכותב
 * שלוש שורות ברצף מייצר שלוש קריאות רשת, ודיווח שנכשל ברגע שאין
 * אינטרנט היה מאבד את ההודעה לגמרי. כאן היא ממתינה לסקר הבא.
 *
 * ⚠️ המחיר: הודעות שהתקבלו ולא דווחו **אובדות** אם התהליך נופל. זה
 * מקובל — הלקוח יקבל תשובה מאוחר יותר או שעובד יראה אותו במסך —
 * והחלופה (תור על הדיסק) מוסיפה מצב מתמשך שצריך לתחזק.
 */
const inboundQueue: InboundMessage[] = [];

/** תקרה, כדי שנפילת רשת ארוכה לא תנפח את הזיכרון בלי גבול. */
const MAX_INBOUND_QUEUE = 200;

async function flushInbound(): Promise<void> {
  if (inboundQueue.length === 0) return;

  // נלקחות מהתור **לפני** הקריאה, ומוחזרות אם היא נכשלה
  const batch = inboundQueue.splice(0, 50);
  try {
    const res = await reportInbound(batch);
    log(`← ${res.handled} תשובות מלקוחות`);
  } catch (e) {
    inboundQueue.unshift(...batch);
    log(`⚠ דיווח התשובות נכשל: ${e instanceof Error ? e.message : e}`);
  }
}

/** השהיה מדורגת בין ניסיונות חיבור, עד חצי דקה. */
const backoffMs = (attempt: number) =>
  Math.min(2_000 * 2 ** Math.min(attempt, 4), 30_000);

/**
 * מחזיק את החיבור החי ומחדש אותו כשהוא נופל.
 *
 * ⚠️ בלי זה נפילת רשת אחת הייתה משביתה את הבוט לצמיתות: הסוקט מת,
 * `isConnected` מחזיר false לנצח, והתהליך ממשיך לדווח דופק ענבר בלי
 * לשלוח כלום. על תהליך שאמור לרוץ חודשים זה לא תרחיש קצה.
 */
function createSupervisor() {
  let wa: WaClient | null = null;
  let attempt = 0;
  let reconnecting = false;

  async function open(): Promise<void> {
    if (reconnecting) return;
    reconnecting = true;
    try {
      wa = await connect({
        onMessage: (msg) => {
          // התור מוגבל — נפילת רשת ארוכה לא תנפח את הזיכרון בלי גבול
          if (inboundQueue.length >= MAX_INBOUND_QUEUE) inboundQueue.shift();
          inboundQueue.push(msg);
        },
        onOpen: (number) => {
          attempt = 0;
          log(`✓ וואטסאפ מחובר: +${number ?? "?"}`);
        },
        onLoggedOut: () => {
          // מחיקת החיבור מהטלפון — אין דרך לתקן את זה מכאן
          log("✗ הסשן נותק מהטלפון. מחק את bot/auth והרץ npm run pair");
          process.exit(1);
        },
        onClosed: (reason) => {
          wa = null;

          // 515 = restartRequired. וואטסאפ סוגרים את החיבור מיד אחרי
          // צימוד ראשון ודורשים חיבור מחדש — זה תקין ומצופה, ולכן
          // מתחברים מיד ובלי להעניש את מונה הניסיונות.
          if (reason === DisconnectReason.restartRequired) {
            log("↻ וואטסאפ ביקשו חיבור מחדש (515) — מתחבר");
            setTimeout(() => void open(), 500);
            return;
          }

          const wait = backoffMs(attempt++);
          log(`⚠ החיבור נפל (${reason ?? "?"}) · ניסיון חוזר בעוד ${wait / 1000}ש׳`);
          setTimeout(() => void open(), wait);
        },
      });
    } catch (e) {
      const wait = backoffMs(attempt++);
      log(`⚠ החיבור נכשל: ${e instanceof Error ? e.message : e} · שוב בעוד ${wait / 1000}ש׳`);
      setTimeout(() => void open(), wait);
    } finally {
      reconnecting = false;
    }
  }

  return { open, current: () => wa };
}

/** ממתין שהסוקט ייפתח, עד תקרה. מוותר בשקט — הסקר ידווח את המצב. */
async function waitForConnection(
  supervisor: { current: () => WaClient | null },
  timeoutMs: number,
): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (supervisor.current()?.isConnected()) return;
    await sleep(250);
  }
}

async function main() {
  if (!isPaired()) {
    console.error("\n✗ הבוט לא מחובר לוואטסאפ.");
    console.error("  הרץ פעם אחת:  npm run pair\n");
    process.exit(1);
  }

  log(`מתחיל · מופע ${INSTANCE_ID}`);

  const supervisor = createSupervisor();
  await supervisor.open();

  // ⚠️ `connect()` חוזר ברגע שהסוקט נוצר, אבל החיבור עצמו נפתח כשנייה
  // אחר כך. בלי ההמתנה הזו הסקר הראשון רץ לפני שהחיבור קיים ומדווח
  // "אין חיבור לוואטסאפ" על בוט תקין לחלוטין — שורה מבהילה בלי סיבה,
  // בדיוק ברגע שבו מסתכלים על המסך בפעם היחידה.
  await waitForConnection(supervisor, 15_000);

  // הסקר רץ גם כשהחיבור נפל: הדופק הוא מה שהופך "הבוט מת" לנראה
  // במסך הניהול במקום להיות שקט
  const poll = async () => {
    const wa = supervisor.current();
    await tick(
      wa ?? {
        isConnected: () => false,
        number: () => undefined,
        send: async () => {
          throw new Error("אין חיבור");
        },
        socket: null as never,
      },
    );
  };

  await poll();
  setInterval(() => void poll(), POLL_INTERVAL_MS);
}

main().catch((e) => {
  console.error("✗ נפילה:", e instanceof Error ? e.message : e);
  // יציאה עם קוד שגיאה — Task Scheduler מפעיל מחדש
  process.exit(1);
});
