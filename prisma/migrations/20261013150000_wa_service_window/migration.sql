-- AlterTable
-- הודעה שיצאה כטקסט חופשי בתוך חלון השירות של 24 שעות — לא עלתה כלום.
ALTER TABLE "WhatsAppMessage" ADD COLUMN "inServiceWindow" BOOLEAN NOT NULL DEFAULT false;
