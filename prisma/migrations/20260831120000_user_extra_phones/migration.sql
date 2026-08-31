-- AlterTable
-- מספרי טלפון נוספים לעובד. מערך ולא טבלה נפרדת: אין לרשומה שום
-- תכונה מלבד המספר עצמו, ואין שאילתה שמחפשת עובד לפי מספר משני.
ALTER TABLE "User" ADD COLUMN "extraPhones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
