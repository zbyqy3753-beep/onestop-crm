import { DisconnectReason } from "@whiskeysockets/baileys";
import { connect, type WaClient } from "./wa.js";
import { pull, report, type OutboxMessage } from "./crm.js";
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

  if (res.messages.length === 0) return;

  log(`→ ${res.messages.length} תזכורות לשליחה`);
  await deliver(wa, res.messages);
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

async function main() {
  if (!isPaired()) {
    console.error("\n✗ הבוט לא מחובר לוואטסאפ.");
    console.error("  הרץ פעם אחת:  npm run pair\n");
    process.exit(1);
  }

  log(`מתחיל · מופע ${INSTANCE_ID}`);

  const supervisor = createSupervisor();
  await supervisor.open();

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
