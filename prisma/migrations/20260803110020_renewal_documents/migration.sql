-- CreateEnum
CREATE TYPE "RenewalDocStatus" AS ENUM ('uploaded', 'extracted', 'failed');

-- CreateTable
CREATE TABLE "RenewalDocument" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" "RenewalDocStatus" NOT NULL DEFAULT 'uploaded',
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "error" TEXT,
    "contentHash" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RenewalDocument_contentHash_key" ON "RenewalDocument"("contentHash");

-- CreateIndex
CREATE INDEX "RenewalDocument_status_createdAt_idx" ON "RenewalDocument"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RenewalDocument" ADD CONSTRAINT "RenewalDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
