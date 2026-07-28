-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "cost" DECIMAL(10,2),
ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false;
