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

/** הודעה שנכנסה מלקוח. */
export interface InboundMessage {
  id: string;
  /** ספרות בלבד, כפי שוואטסאפ מזהה את השולח */
  fromPhone: string;
  body: string;
  timestamp: number;
}

export interface ConnectOptions {
  /** נקרא כשיש QR לסרוק. בלעדיו הבוט מסרב להתחבר (מצב serve). */
  onQr?: (qr: string) => void;
  /** נקרא לכל הודעה נכנסת מאדם. */
  onMessage?: (msg: InboundMessage) => void;
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

  /*
   * הודעות נכנסות.
   *
   * ⚠️ שלושה סינונים, וכל אחד מהם מונע לולאה או רעש:
   *
   *  - `fromMe` — ההודעות **שלנו** חוזרות באותו אירוע. בלי הסינון
   *    הזה כל הודעה שהבוט שולח הייתה נקלטת כתשובה של הלקוח, נשלחת
   *    לשרת, ומייצרת תשובה נוספת. לולאה אינסופית מול לקוח אמיתי.
   *  - קבוצות (`@g.us`) — הבוט לא אמור להגיב לשום דבר בקבוצה.
   *  - `notify` בלבד — `append` הוא סנכרון היסטוריה ישנה, ובחיבור
   *    ראשון הוא מציף מאות הודעות ישנות שכולן ייראו כתשובות טריות.
   */
  socket.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify" || !opts.onMessage) return;

    for (const m of messages) {
      if (m.key.fromMe) continue;

      const jid = m.key.remoteJid ?? "";
      if (!jid.endsWith("@s.whatsapp.net")) continue;

      const body =
        m.message?.conversation ??
        m.message?.extendedTextMessage?.text ??
        "";
      if (!body.trim()) continue;

      opts.onMessage({
        id: m.key.id ?? `${jid}-${m.messageTimestamp}`,
        fromPhone: jid.split("@")[0].split(":")[0],
        body,
        timestamp: Number(m.messageTimestamp ?? 0) * 1000 || Date.now(),
      });
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
