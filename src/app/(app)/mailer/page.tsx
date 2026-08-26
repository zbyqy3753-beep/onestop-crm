import { requireRouteAccess } from "@/server/auth/session";
import { mailerConfigured, mailerSenderAddress } from "@/server/mailer/provider";
import { mailerOverview } from "@/server/mailer/overview";
import { MailerClient } from "@/components/mailer/MailerClient";

/**
 * מסך הדיוור.
 *
 * ⚠️ מצב ההגדרה נבדק בשרת ומועבר למטה. בלי זה המשתמש מעלה קובץ,
 * כותב טקסט, לוחץ שלח — ומגלה רק אז שאין דרך לשלוח.
 */
export default async function MailerPage() {
  await requireRouteAccess("/mailer");

  const overview = await mailerOverview();

  return (
    <MailerClient
      configured={
        mailerConfigured() && Boolean(process.env.MAILER_SECRET?.trim())
      }
      sender={mailerSenderAddress()}
      overview={overview}
    />
  );
}
