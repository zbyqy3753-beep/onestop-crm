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
  /**
   * שורות אבחון על מה שהתקבל — כולל מה שנפסל ולמה.
   *
   * ⚠️ קיים כי סינון שקט הוא בדיוק מה שהסתיר את הבאג הקודם: הבוט
   * קיבל הודעות, פסל אותן בשקט, ומבחוץ זה נראה כאילו הוא לא מקבל
   * כלום. עכשיו כל דחייה נרשמת בלוג.
   */
  onDebug?: (msg: string) => void;
  /** נקרא כשהסשן נפסל — צריך מחיקת auth וסריקה מחדש. */
  onLoggedOut?: () => void;
  onOpen?: (number?: string) => void;
  /**
   * נקרא בכל ניתוק **שאינו** התנתקות מהטלפון — קוד QR שפג, נפילת
   * רשת, או סגירה מהצד השני. הקורא מחליט אם להתחבר מחדש.
   */
  onClosed?: (reason?: number) => void;
}

/**
 * הטקסט מתוך הודעה, על כל הצורות שוואטסאפ עוטף בהן תוכן.
 *
 * ⚠️ `conversation` הוא רק המקרה הפשוט ביותר. הודעה שנשלחה כתשובה
 * לציטוט היא `extendedTextMessage`, ו**בצ׳אט עם הודעות נעלמות התוכן
 * האמיתי עטוף** ב-`ephemeralMessage` — שם `conversation` פשוט לא
 * קיים, וההודעה נראית ריקה. הודעות נעלמות מופעלות בהרבה צ׳אטים,
 * ולכן זה לא מקרה קצה.
 *
 * העטיפות מקוננות (viewOnce בתוך ephemeral), ולכן פירוק רקורסיבי
 * עם תקרה שמונעת לולאה על מבנה פגום.
 */
function textOf(msg: unknown, depth = 0): string {
  if (!msg || typeof msg !== "object" || depth > 4) return "";
  const m = msg as Record<string, { message?: unknown; text?: string; caption?: string }>;

  for (const wrapper of [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
  ]) {
    if (m[wrapper]?.message) return textOf(m[wrapper].message, depth + 1);
  }

  const plain = (msg as { conversation?: string }).conversation;
  if (plain) return plain;

  return (
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.buttonsResponseMessage?.text ??
    ""
  );
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

  socket.ev.on("messages.upsert", ({ messages, type }) => {
    if (!opts.onMessage) return;

    // ⚠️ מדווח **כל** אירוע, גם כזה שיידחה. הגרסה הקודמת סיננה בשקט,
    // ולכן "הבוט לא קולט" ו"הבוט קולט ופוסל" נראו זהים לגמרי מבחוץ.
    opts.onDebug?.(`upsert type=${type} · ${messages.length} הודעות`);

    // `append` הוא סנכרון היסטוריה — בחיבור ראשון הוא מציף מאות
    // הודעות ישנות שכולן ייראו כתשובות טריות
    if (type !== "notify") return;

    for (const m of messages) {
      // ההודעות **שלנו** חוזרות באותו אירוע. בלי זה כל הודעה שהבוט
      // שולח נקלטת כתשובה, מייצרת תשובה נוספת, ונוצרת לולאה אינסופית.
      if (m.key.fromMe) continue;

      const jid = m.key.remoteJid ?? "";

      /*
       * ⚠️ רשימת **פסילה** ולא רשימת היתר.
       *
       * הגרסה הקודמת דרשה `@s.whatsapp.net` — וזה בדיוק מה ששבר את
       * הכל: וואטסאפ עברו לכתובות `@lid` בצ׳אטים פרטיים, והבדיקה
       * הפילה כל הודעה אמיתית בלי להשאיר עקבות. פוסלים רק את מה
       * שבאמת לא רלוונטי, ומקבלים את השאר.
       */
      if (
        jid.endsWith("@g.us") ||
        jid.endsWith("@broadcast") ||
        jid.endsWith("@newsletter")
      ) {
        opts.onDebug?.(`  דילוג (${jid.split("@")[1]})`);
        continue;
      }

      const body = textOf(m.message);
      if (!body.trim()) {
        opts.onDebug?.(`  ${jid}: אין טקסט (${Object.keys(m.message ?? {}).join(",")})`);
        continue;
      }

      /*
       * המספר לשיוך.
       *
       * ב-`@lid` החלק שלפני ה-@ **אינו** מספר טלפון, ולכן הוא לא
       * ישויך לאיש קשר. `senderPn` הוא השדה שוואטסאפ מוסיפים עם
       * המספר האמיתי כשמדובר ב-LID; אם הוא חסר, נופלים ל-JID ומדווחים
       * — עדיף הודעה לא משויכת שנשמרת מאשר הודעה שנעלמת.
       */
      const key = m.key as { senderPn?: string; remoteJidAlt?: string };
      const source = key.senderPn ?? key.remoteJidAlt ?? jid;
      const fromPhone = source.split("@")[0].split(":")[0].replace(/\D/g, "");

      opts.onDebug?.(`  ← ${fromPhone}: "${body.slice(0, 40)}"`);

      opts.onMessage({
        id: m.key.id ?? `${jid}-${m.messageTimestamp}`,
        fromPhone,
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
