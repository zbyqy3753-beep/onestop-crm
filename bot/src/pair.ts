import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import qrTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import { connect } from "./wa.js";
import { AUTH_DIR, QR_PATH, isPaired } from "./config.js";

/**
 * חיבור ראשוני: סריקת QR.
 *
 * מופרד מ-`serve` בכוונה. ההרצה הקבועה תהיה דרך Task Scheduler, שרץ
 * בלי דסקטופ אינטראקטיבי — ושם אי אפשר לסרוק QR. לכן: פעם אחת אדם
 * מריץ את זה ידנית, ומשם ואילך `serve` רץ לבדו.
 *
 * ⚠️ **קודי QR של וואטסאפ פגים תוך שניות ספורות.** הגרסה הראשונה
 * הציגה קוד אחד וכשהוא פג התהליך פשוט מת בשקט — לפני שהספיקו לסרוק.
 * לכן: הקוד מתחדש בלולאה עד שהצימוד מצליח או עד שמפסיקים ידנית.
 *
 * ⚠️ ה-QR מוצג **גם** כתמונה ולא רק בטרמינל. QR ב-ASCII בחלון פקודה
 * עם פונט עברי או יחס תווים לא מתאים פשוט לא נסרק, וזה ההבדל בין
 * התקנה של חמש דקות לשיחת טלפון.
 */

/** כמה זמן להמשיך לנסות לפני שמוותרים. */
const GIVE_UP_AFTER_MS = 10 * 60_000;

let viewerOpened = false;
let codes = 0;

async function showQr(qr: string): Promise<void> {
  codes++;
  await QRCode.toFile(QR_PATH, qr, { width: 512, margin: 2 });

  if (!viewerOpened) {
    viewerOpened = true;
    spawn("cmd", ["/c", "start", "", QR_PATH], {
      detached: true,
      stdio: "ignore",
    }).unref();
    console.log("\n--- סרוק את הקוד שנפתח בחלון התמונה ---");
    console.log(`(אם לא נפתח: ${QR_PATH})\n`);
    qrTerminal.generate(qr, { small: true });
  } else {
    console.log(`\n↻ הקוד הקודם פג. קוד חדש (#${codes}) — רענן את התמונה.\n`);
    qrTerminal.generate(qr, { small: true });
  }
}

function done(number?: string): never {
  console.log(`\n✓ מחובר בהצלחה: +${number ?? "?"}`);
  console.log("  אפשר לסגור את החלון ולהמשיך להתקנה (install-task.cmd)\n");
  rmSync(QR_PATH, { force: true });
  process.exit(0);
}

async function main() {
  if (isPaired()) {
    console.log("\n⚠️  כבר קיים חיבור פעיל.");
    console.log("   כדי להתחבר מחדש:  rmdir /s /q auth  ואז  npm run pair\n");
    process.exit(0);
  }

  console.log("\n=== חיבור וואטסאפ ל-ONE STOP CRM ===\n");
  console.log("בטלפון עם המספר הייעודי:");
  console.log("  וואטסאפ ← הגדרות ← מכשירים מקושרים ← קישור מכשיר\n");
  console.log("הקוד מתחדש אוטומטית כשהוא פג — קח את הזמן.\n");

  const deadline = Date.now() + GIVE_UP_AFTER_MS;

  // לולאת חיבור: כל ניתוק שאינו "נותק מהטלפון" הוא פשוט קוד שפג,
  // ומתחברים מחדש עד שהצימוד מצליח
  for (;;) {
    if (Date.now() > deadline) {
      console.error("\n✗ עברו 10 דקות בלי צימוד. הרץ שוב: npm run pair\n");
      process.exit(1);
    }

    const closed = await new Promise<"retry" | "fatal">((resolve) => {
      connect({
        onQr: (qr) => {
          void showQr(qr);
        },
        onOpen: (number) => done(number),
        onLoggedOut: () => resolve("fatal"),
        onClosed: () => resolve("retry"),
      }).catch(() => resolve("retry"));
    });

    if (closed === "fatal") {
      console.error("\n✗ החיבור נדחה מהטלפון.");
      console.error(`  מחק את ${AUTH_DIR} ונסה שוב.\n`);
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 1_000));
  }
}

main().catch((e) => {
  console.error("\n✗ שגיאה בחיבור:", e instanceof Error ? e.message : e);
  console.error(`  אם זה חוזר — מחק את ${AUTH_DIR} ונסה שוב.\n`);
  process.exit(1);
});
