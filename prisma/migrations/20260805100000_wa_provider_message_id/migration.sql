-- מזהה ההודעה אצל מטא (Cloud API), לקישור עדכוני מסירה מה-webhook.
--
-- ⚠️ NULL בכל השורות הקיימות — הן נשלחו דרך הבוט הלא רשמי, שאין לו
-- מזהה כזה. Postgres מתיר ריבוי NULL תחת אינדקס ייחודי, ולכן
-- ההוספה בטוחה על נתונים קיימים.
ALTER TABLE "WhatsAppMessage" ADD COLUMN "providerMessageId" TEXT;

CREATE UNIQUE INDEX "WhatsAppMessage_providerMessageId_key"
  ON "WhatsAppMessage"("providerMessageId");
