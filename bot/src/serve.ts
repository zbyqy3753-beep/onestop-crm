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

async function main() {
  if (!isPaired()) {
    console.error("\n✗ הבוט לא מחובר לוואטסאפ.");
    console.error("  הרץ פעם אחת:  npm run pair\n");
    process.exit(1);
  }

  log(`מתחיל · מופע ${INSTANCE_ID}`);

  const wa = await connect({
    onOpen: (number) => log(`✓ וואטסאפ מחובר: +${number ?? "?"}`),
    onLoggedOut: () => {
      // מחיקת החיבור מהטלפון — אין דרך לתקן את זה מכאן
      log("✗ הסשן נותק מהטלפון. מחק את bot/auth והרץ npm run pair");
      process.exit(1);
    },
  });

  // סקר ראשון מיד, כדי שדופק ייכתב בלי לחכות דקה
  await tick(wa);
  setInterval(() => {
    void tick(wa);
  }, POLL_INTERVAL_MS);
}

main().catch((e) => {
  console.error("✗ נפילה:", e instanceof Error ? e.message : e);
  // יציאה עם קוד שגיאה — Task Scheduler מפעיל מחדש
  process.exit(1);
});
