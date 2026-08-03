-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "budgetScore" INTEGER,
ADD COLUMN     "buyingSignalsScore" INTEGER,
ADD COLUMN     "callQualityScore" INTEGER,
ADD COLUMN     "compositeScore" DOUBLE PRECISION,
ADD COLUMN     "courseFitScore" INTEGER,
ADD COLUMN     "interestScore" INTEGER,
ADD COLUMN     "urgencyScore" INTEGER;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
