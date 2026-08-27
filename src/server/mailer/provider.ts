import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { fromHeader } from "@/lib/domain/mailFrom";

/**
 * השליחה בפועל — **המקום היחיד** שיודע מי הספק.
 *
 * ⚠️ Gmail ולא שירות דיוור, בכוונה: כתובת `gmail.com` ששולחת דרך
 * שרתי ספק צד-שלישי אינה עוברת יישור SPF/DKIM מול הדומיין, ונוחתת
 * בספאם. זה כישלון שלא רואים — הדוח אומר "נשלח" ואיש לא קרא.
 * המחיר הוא תקרה של ~500 ליום ואפס דוחות פתיחה, וזה מה שקבע את
 * התקרה היומית ב-`MAILER_DEFAULTS`.
 *
 * ⚠️ מעבר לספק אמיתי (דומיין מאומת + Resend/Brevo) הוא החלפת הקובץ
 * הזה בלבד. שום מודול אחר לא מכיר את nodemailer.
 */

/** מחזיק מופע אחד — פתיחת חיבור SMTP לכל מייל מאיטה ומעצבנת את גוגל. */
let cached: Transporter | null = null;

function credentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  // ⚠️ גוגל מציגה את הסיסמה בארבע רביעיות מופרדות ברווח, ומי
  // שמעתיק אותה מדביק את הרווחים. SMTP דוחה אותם בשקט.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

/** האם יש מה לשלוח איתו. המסך בודק את זה לפני שהוא מרשה לשלוח. */
export function mailerConfigured(): boolean {
  return credentials() !== null;
}

export function mailerSenderAddress(): string | null {
  return credentials()?.user ?? null;
}

/**
 * השם שהנמען רואה ליד הכתובת.
 *
 * ⚠️ **ברירת מחדל ולא `undefined`.** מייל שמגיע מכתובת ג'ימייל חשופה,
 * בלי שם, נראה לנמען כמו הודעה מאדם אקראי — וגם מסונן חזק יותר.
 * זה אחד המשקלים הבודדים בסיווג שיש עליו שליטה מכאן.
 */
export function mailerSenderName(): string {
  return process.env.MAILER_FROM_NAME?.trim() || "ONE STOP";
}

function transport(): Transporter {
  const creds = credentials();
  if (!creds) {
    throw new Error(
      "GMAIL_USER או GMAIL_APP_PASSWORD חסרים — ראה .env.example",
    );
  }

  cached ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    // 465 ולא 587: TLS מהשנייה הראשונה, בלי STARTTLS שנופל
    // בסביבות שחוסמות שדרוג חיבור
    port: 465,
    secure: true,
    auth: creds,
  });

  return cached;
}

/** שולח מייל אחד. מחזיר את מזהה ההודעה, או זורק. */
export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}): Promise<string> {
  const address = mailerSenderAddress();
  const info = await transport().sendMail({
    from: address ? fromHeader(address, mailerSenderName()) : undefined,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {
      /*
       * ⚠️ שתי הכותרות יחד, ולא רק הראשונה. בלי `-Post` ג'ימייל
       * מתייחס לקישור כאל דף שצריך לפתוח ולרוב אינו מציג את הכפתור
       * המובנה שלו; עם שתיהן הוא שולח POST ומסיר במקום. מי שלוחץ
       * עליו הוא מי שאחרת היה מסמן "דווח כספאם" — וזה ההבדל בין
       * הסרה בודדת לבין פגיעה במוניטין של החשבון כולו.
       */
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  return info.messageId;
}
