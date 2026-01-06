/*
  Warnings:

  - You are about to drop the column `fromTeamId` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `toTeamId` on the `Trade` table. All the data in the column will be lost.
  - Added the required column `description` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rating` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `salaryValid` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetTeamId` to the `TradeAsset` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_fromTeamId_fkey";

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_toTeamId_fkey";

-- DropIndex
DROP INDEX "Trade_fromTeamId_idx";

-- DropIndex
DROP INDEX "Trade_toTeamId_idx";

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "fromTeamId",
DROP COLUMN "status",
DROP COLUMN "toTeamId",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "rating" INTEGER NOT NULL,
ADD COLUMN     "salaryValid" BOOLEAN NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TradeAsset" ADD COLUMN     "targetTeamId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "UserSelections" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "targetTeamId" INTEGER NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "draftPickId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSelections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSelections_teamId_idx" ON "UserSelections"("teamId");

-- CreateIndex
CREATE INDEX "UserSelections_targetTeamId_idx" ON "UserSelections"("targetTeamId");

-- CreateIndex
CREATE INDEX "UserSelections_tradeId_idx" ON "UserSelections"("tradeId");

-- CreateIndex
CREATE INDEX "UserSelections_playerId_idx" ON "UserSelections"("playerId");

-- CreateIndex
CREATE INDEX "UserSelections_draftPickId_idx" ON "UserSelections"("draftPickId");

-- CreateIndex
CREATE INDEX "TradeAsset_targetTeamId_idx" ON "TradeAsset"("targetTeamId");

-- AddForeignKey
ALTER TABLE "TradeAsset" ADD CONSTRAINT "TradeAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeAsset" ADD CONSTRAINT "TradeAsset_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSelections" ADD CONSTRAINT "UserSelections_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSelections" ADD CONSTRAINT "UserSelections_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSelections" ADD CONSTRAINT "UserSelections_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSelections" ADD CONSTRAINT "UserSelections_draftPickId_fkey" FOREIGN KEY ("draftPickId") REFERENCES "DraftPick"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSelections" ADD CONSTRAINT "UserSelections_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
