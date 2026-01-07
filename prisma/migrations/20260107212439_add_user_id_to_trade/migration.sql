-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");
