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
 * ⚠️ ה-QR מוצג **גם** כתמונה ולא רק בטרמינל. QR ב-ASCII בחלון פקודה
 * עם פונט עברי או יחס תווים לא מתאים פשוט לא נסרק, וזה ההבדל בין
 * התקנה של חמש דקות לשיחת טלפון.
 */

async function main() {
  if (isPaired()) {
    console.log("\n⚠️  כבר קיים חיבור קיים ב-bot/auth.");
    console.log("   כדי להתחבר מחדש: מחק את התיקייה bot/auth והרץ שוב.\n");
    process.exit(0);
  }

  console.log("\n=== חיבור וואטסאפ ל-ONE STOP CRM ===\n");
  console.log("פותח חלון עם קוד QR...");
  console.log("בטלפון עם המספר הייעודי:");
  console.log("  וואטסאפ ← הגדרות ← מכשירים מקושרים ← קישור מכשיר\n");

  let opened = false;

  await connect({
    onQr: async (qr) => {
      qrTerminal.generate(qr, { small: true });
      await QRCode.toFile(QR_PATH, qr, { width: 512, margin: 2 });
      if (!opened) {
        opened = true;
        // פותח את התמונה במציג ברירת המחדל של Windows
        spawn("cmd", ["/c", "start", "", QR_PATH], {
          detached: true,
          stdio: "ignore",
        }).unref();
        console.log(`\n(אם החלון לא נפתח — פתח ידנית את ${QR_PATH})\n`);
      }
    },
    onOpen: (number) => {
      console.log(`\n✓ מחובר בהצלחה: +${number ?? "?"}`);
      console.log("  אפשר לסגור את החלון ולהריץ: npm run serve\n");
      rmSync(QR_PATH, { force: true });
      process.exit(0);
    },
    onLoggedOut: () => {
      console.error("\n✗ החיבור נדחה. מחק את bot/auth ונסה שוב.\n");
      process.exit(1);
    },
  });
}

main().catch((e) => {
  console.error("\n✗ שגיאה בחיבור:", e instanceof Error ? e.message : e);
  console.error(`  אם זה חוזר — מחק את ${AUTH_DIR} ונסה שוב.\n`);
  process.exit(1);
});
