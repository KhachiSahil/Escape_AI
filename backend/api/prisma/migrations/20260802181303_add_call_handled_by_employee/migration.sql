-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "handledByEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "Call_handledByEmployeeId_idx" ON "Call"("handledByEmployeeId");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_handledByEmployeeId_fkey" FOREIGN KEY ("handledByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
