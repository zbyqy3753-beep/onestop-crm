-- AlterTable
-- שיוך עובד לבעל עסק. SetNull: מחיקת בעל העסק משחררת את העובדים
-- ולא מוחקת אותם.
ALTER TABLE "User" ADD COLUMN "teamOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "User_teamOwnerId_idx" ON "User"("teamOwnerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamOwnerId_fkey" FOREIGN KEY ("teamOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
