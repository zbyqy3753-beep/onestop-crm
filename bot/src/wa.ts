import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { ACK_TIMEOUT_MS, AUTH_DIR, BOT_ROOT } from "./config.js";

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

/** ספרות בלבד מתוך JID או מזהה כלשהו. */
const digitsOf = (raw: string) =>
  raw.split("@")[0].split(":")[0].replace(/\D/g, "");

/**
 * מיפוי LID → מספר טלפון.
 *
 * ⚠️⚠️ **זה הבאג שגרם ל"שולחים הסר ולא קורה כלום".**
 *
 * וואטסאפ עברו לכתובות `@lid` בצ׳אטים פרטיים. ה-LID הוא מזהה אטום
 * (`224283443917054`) שאין לו שום קשר מתמטי למספר הטלפון, ובהודעות
 * שנבדקו בפועל השדות `senderPn`/`participantPn` פשוט לא הגיעו. לכן
 * כל תשובה נרשמה תחת המזהה האטום, לא שויכה לאף איש קשר — ובקשת הסרה
 * "נקלטה" בלי שאיש ידע ממי היא.
 *
 * את הכיוון ההפוך אי אפשר לשאול; את הכיוון קדימה כן — `onWhatsApp`
 * מחזיר את ה-LID של מספר. לכן המיפוי נבנה **בזמן השליחה**, כשהמספר
 * עוד ידוע לנו. זה מכסה בדיוק את מי שיכול לענות: מי שכבר שלחנו לו.
 *
 * ⚠️ נשמר לדיסק. בלי זה כל הפעלה מחדש של הבוט הייתה מאבדת את המיפוי,
 * ותשובות של לקוחות שכבר קיבלו הודעה היו חוזרות להיות בלתי ניתנות
 * לשיוך — כלומר הבאג היה חוזר בכל אתחול.
 */
const LID_MAP_PATH = resolve(BOT_ROOT, "lid-map.json");

function loadLidMap(): Record<string, string> {
  try {
    if (!existsSync(LID_MAP_PATH)) return {};
    const parsed: unknown = JSON.parse(readFileSync(LID_MAP_PATH, "utf8"));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export async function connect(opts: ConnectOptions = {}): Promise<WaClient> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const lidToPhone = loadLidMap();

  function rememberLid(lid: string, phone: string): void {
    if (!lid || !phone || lidToPhone[lid] === phone) return;
    lidToPhone[lid] = phone;
    try {
      writeFileSync(LID_MAP_PATH, JSON.stringify(lidToPhone, null, 1), "utf8");
    } catch {
      // דיסק מלא או הרשאות — המיפוי ימשיך לחיות בזיכרון עד לאתחול
    }
  }

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

  /*
   * ⚠️⚠️ אישורי קבלה — הסיבה ש"נשלח" הפך למשמעותי.
   *
   * `sendMessage` שחוזר בהצלחה אומר **רק** שההודעה נמסרה לספרייה
   * ונשלחה לסוקט. הוא לא אומר שוואטסאפ קיבלו אותה, ובוודאי לא
   * שהלקוח קיבל. אחרי צימוד טרי, סשן חלש או ניתוק באמצע, ההודעה
   * נעלמת בשקט — והמערכת מדווחת "נשלח" על משהו שלא קרה. זה נצפה
   * בייצור: השורה סומנה `sent` והלקוח לא קיבל כלום.
   *
   * `messages.update` מביא את מצב ההודעה. `SERVER_ACK` (2) הוא
   * הרגע שבו וואטסאפ אישרו קבלה — זה הסימן האמיתי, וממנו והלאה
   * המסירה באחריותם.
   */
  const SERVER_ACK = 2;
  const pendingAcks = new Map<string, (ok: boolean) => void>();

  function settleAck(id: string | null | undefined, why: string): void {
    if (!id) return;
    const waiting = pendingAcks.get(id);
    // ⚠️ מדווח גם על אישור שאיש לא ממתין לו. אחרת "לא הגיע אישור"
    // ו"הגיע אישור מאוחר מדי" נראים זהים בלוג, ואי אפשר להבדיל בין
    // שליחה שנכשלה לבין תקרת המתנה קצרה מדי.
    opts.onDebug?.(`  ✓ אישור (${why}) ל-${id}${waiting ? "" : " — כבר לא ממתינים"}`);
    if (!waiting) return;
    pendingAcks.delete(id);
    waiting(true);
  }

  socket.ev.on("messages.update", (updates) => {
    for (const u of updates) {
      const status = u.update?.status;
      if (typeof status !== "number") continue;
      opts.onDebug?.(`  · סטטוס ${status} ל-${u.key?.id}`);
      if (status >= SERVER_ACK) settleAck(u.key?.id, `status=${status}`);
    }
  });

  /*
   * ⚠️ אירוע שני, לא במקום הראשון.
   *
   * Baileys מפרסמים אישורים בשני ערוצים נפרדים, ואיזה מהם יגיע תלוי
   * בסוג הקבלה ובגרסה. האזנה לאחד בלבד היא בדיוק הסוג של הנחה שהופכת
   * שליחה תקינה ל"נכשל" — ומכיוון שכישלון כאן שולח הודעה שנייה
   * ללקוח, המחיר של פספוס אישור הוא הודעה כפולה.
   */
  socket.ev.on("message-receipt.update", (updates) => {
    for (const u of updates) settleAck(u.key?.id, "receipt");
  });

  /** ממתין לאישור קבלה. `false` = לא הגיע בזמן. */
  function waitForAck(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingAcks.delete(id);
        resolve(false);
      }, ACK_TIMEOUT_MS);

      pendingAcks.set(id, (ok) => {
        clearTimeout(timer);
        resolve(ok);
      });
    });
  }

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
       * המספר לשיוך — שלוש דרגות, לפי אמינות.
       *
       * ב-`@lid` החלק שלפני ה-@ **אינו** מספר טלפון. `senderPn` /
       * `participantPn` הם השדות שוואטסאפ אמורים לצרף עם המספר
       * האמיתי, אבל בהודעות אמיתיות שנבדקו הם פשוט לא הגיעו — ולכן
       * המיפוי שנבנה בזמן השליחה הוא מה שבאמת עובד כאן.
       *
       * ⚠️ כשגם הוא ריק, מדווחים את ה-LID עצמו ורושמים אזהרה בלוג.
       * הודעה לא משויכת שנשמרת עדיפה על הודעה שנעלמת — אבל היא לא
       * ניתנת לכיבוד אוטומטי, ולכן חייבת להיות רועשת.
       */
      const key = m.key as {
        senderPn?: string;
        participantPn?: string;
        remoteJidAlt?: string;
      };
      const direct = key.senderPn ?? key.participantPn ?? key.remoteJidAlt;

      let fromPhone = digitsOf(direct ?? jid);
      if (!direct && jid.endsWith("@lid")) {
        const mapped = lidToPhone[digitsOf(jid)];
        if (mapped) {
          fromPhone = mapped;
        } else {
          opts.onDebug?.(`  ⚠ LID ללא מיפוי: ${digitsOf(jid)} — לא ישויך`);
        }
      }

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
      const jid = `${toE164}@s.whatsapp.net`;
      const sent = await socket.sendMessage(jid, { text: body });

      /*
       * ⚠️ בלי אישור אין "נשלח" — ראה ההערה על `pendingAcks`.
       *
       * הזריקה כאן מסומנת ככישלון ב-CRM, וכישלון חוזר לתור לניסיון
       * נוסף. הודעה כפולה במקרה גבול עדיפה בהרבה על לקוח שהמערכת
       * חושבת שדיברה איתו ובפועל לא.
       */
      const id = sent?.key?.id;
      opts.onDebug?.(`  → נמסר לספרייה (${id ?? "בלי מזהה"}), ממתין לאישור`);
      if (id && !(await waitForAck(id))) {
        throw new Error("וואטסאפ לא אישרו קבלה של ההודעה");
      }

      /*
       * ⚠️ אחרי השליחה, לא לפניה, ובלי לחסום אותה.
       *
       * זו הנקודה היחידה שבה המספר וה-LID ידועים שניהם — וכל תשובה
       * שתגיע אחר כך תגיע מה-LID. כישלון כאן לא אמור להפיל שליחה
       * שכבר הצליחה, ולכן הוא נבלע.
       */
      try {
        // ⚠️ `onWhatsApp` מוגדר כמחזיר `undefined` ולא מערך ריק
        const found = (await socket.onWhatsApp(jid))?.[0];
        const lid = typeof found?.lid === "string" ? digitsOf(found.lid) : "";
        if (lid) rememberLid(lid, toE164);
      } catch {
        // ההודעה יצאה; רק השיוך של תשובה עתידית עלול להיפגע
      }
    },
  };
}
