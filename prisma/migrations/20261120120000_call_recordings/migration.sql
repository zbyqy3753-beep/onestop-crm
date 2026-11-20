-- הקלטות שיחה של אלירן: תור לתמלול ולניתוח, והשמע בחתיכות שנמחקות אחרי הניתוח.
CREATE TYPE "CallRecordingStatus" AS ENUM ('uploading', 'pending', 'done', 'failed');

CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "phone" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER,
    "chunkCount" INTEGER NOT NULL,
    "status" "CallRecordingStatus" NOT NULL DEFAULT 'uploading',
    "transcript" TEXT,
    "analysis" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallAudioChunk" (
    "recordingId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "CallAudioChunk_pkey" PRIMARY KEY ("recordingId","index")
);

CREATE UNIQUE INDEX "CallRecording_fileName_key" ON "CallRecording"("fileName");
CREATE INDEX "CallRecording_status_createdAt_idx" ON "CallRecording"("status", "createdAt");

ALTER TABLE "CallAudioChunk" ADD CONSTRAINT "CallAudioChunk_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "CallRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
