-- תור בקשות לפוסט אינסטגרם. טבלה חדשה בלבד, בלי נגיעה בקיימות.
CREATE TYPE "PostRequestStatus" AS ENUM ('pending', 'done', 'failed');

CREATE TABLE "PostRequest" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PostRequestStatus" NOT NULL DEFAULT 'pending',
    "resultUrl" TEXT,
    "resultNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "PostRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostRequest_status_createdAt_idx" ON "PostRequest"("status", "createdAt");

ALTER TABLE "PostRequest" ADD CONSTRAINT "PostRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
