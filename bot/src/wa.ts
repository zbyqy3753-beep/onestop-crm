import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { AUTH_DIR } from "./config.js";

/**
 * החיבור לוואטסאפ.
 *
 * Baileys ולא whatsapp-web.js: פרוטוקול WebSocket ישיר בלי Puppeteer
 * ובלי Chromium. על מחשב שאמור לרוץ חודשים ברצף זה ההבדל בין תהליך
 * של ~100MB לתהליך של ~500MB שנוטה להיתקע.
 *
 * ⚠️ ספרייה לא רשמית — נעוצה לגרסה מדויקת ב-package.json. כשוואטסאפ
 * משנים פרוטוקול היא נשברת, וזה מתבטא כ"לא מתחבר" — בדיוק מה שהרצועה
 * במסך הניהול מציגה.
 */

export interface WaClient {
  socket: WASocket;
  /** האם החיבור חי כרגע */
  isConnected: () => boolean;
  /** המספר שממנו שולחים, כפי שוואטסאפ מדווח */
  number: () => string | undefined;
  send: (toE164: string, body: string) => Promise<void>;
}

export interface ConnectOptions {
  /** נקרא כשיש QR לסרוק. בלעדיו הבוט מסרב להתחבר (מצב serve). */
  onQr?: (qr: string) => void;
  /** נקרא כשהסשן נפסל — צריך מחיקת auth וסריקה מחדש. */
  onLoggedOut?: () => void;
  onOpen?: (number?: string) => void;
  /**
   * נקרא בכל ניתוק **שאינו** התנתקות מהטלפון — קוד QR שפג, נפילת
   * רשת, או סגירה מהצד השני. הקורא מחליט אם להתחבר מחדש.
   */
  onClosed?: (reason?: number) => void;
}

export async function connect(opts: ConnectOptions = {}): Promise<WaClient> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let connected = false;
  let number: string | undefined;

  const socket = makeWASocket({
    auth: state,
    // ה-QR מטופל אצלנו ולא מודפס אוטומטית
    printQRInTerminal: false,
    // ברירת המחדל היא 60 שניות — קצר מדי למי שצריך גם למצוא את
    // הטלפון וגם לנווט בתפריטי וואטסאפ
    qrTimeout: 120_000,
    // בלי תצוגה מקדימה של קישורים — היא גוררת עיבוד תמונה מיותר
    generateHighQualityLinkPreview: false,
    logger: pino({ level: "silent" }),
    browser: ["ONE STOP CRM", "Chrome", "1.0.0"],
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && opts.onQr) opts.onQr(qr);

    if (connection === "open") {
      connected = true;
      number = socket.user?.id?.split(":")[0];
      opts.onOpen?.(number);
    }

    if (connection === "close") {
      connected = false;
      const status = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;

      // התנתקות מכוונת מהטלפון — הסשן מת ואין טעם לנסות שוב
      if (status === DisconnectReason.loggedOut) {
        opts.onLoggedOut?.();
      } else {
        opts.onClosed?.(status);
      }
    }
  });

  return {
    socket,
    isConnected: () => connected,
    number: () => number,
    async send(toE164, body) {
      await socket.sendMessage(`${toE164}@s.whatsapp.net`, { text: body });
    },
  };
}
