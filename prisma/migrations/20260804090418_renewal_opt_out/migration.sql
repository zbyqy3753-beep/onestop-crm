-- CreateTable
CREATE TABLE "RenewalOptOut" (
    "phone" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalOptOut_pkey" PRIMARY KEY ("phone")
);

-- ⚠️ העברת ההסרות שכבר קיימות כסטטוס על איש הקשר.
--
-- בלי זה כל מי שביקש הסרה עד היום היה מאבד אותה ברגע שהמסמך שלו
-- יימחק, או חוזר לרשימה בהעלאת ה-PDF הבאה — כלומר המעבר למנגנון
-- החדש היה בעצמו מבטל בקשות הסרה קיימות.
INSERT INTO "RenewalOptOut" ("phone")
SELECT DISTINCT "phone" FROM "RenewalContact" WHERE "status" = 'optedOut'
ON CONFLICT ("phone") DO NOTHING;
