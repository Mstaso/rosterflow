/*
  Warnings:

  - You are about to drop the column `college` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `statistics` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `capSpace` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `conference` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `division` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `firstApronSpace` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `record` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `secondApronSpace` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `totalCapAllocation` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `venue` on the `Team` table. All the data in the column will be lost.
  - The primary key for the `Trade` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `isAIGenerated` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `reasoning` on the `Trade` table. All the data in the column will be lost.
  - The `id` column on the `Trade` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `assetType` on the `TradeAsset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[teamId,year,round]` on the table `DraftPick` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Made the column `contract` on table `Player` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `dateOfBirth` on the `Player` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `experience` on table `Player` required. This step will fail if there are existing NULL values in that column.
  - Made the column `injuries` on table `Player` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `Player` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `links` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nickname` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamId` to the `TradeAsset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `TradeAsset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TradeAsset` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tradeId` on the `TradeAsset` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "TradeAsset" DROP CONSTRAINT "TradeAsset_tradeId_fkey";

-- DropIndex
DROP INDEX "DraftPick_year_round_idx";

-- DropIndex
DROP INDEX "DraftPick_year_round_teamId_key";

-- DropIndex
DROP INDEX "Team_slug_key";

-- DropIndex
DROP INDEX "Trade_createdAt_idx";

-- DropIndex
DROP INDEX "TradeAsset_assetType_idx";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "college",
DROP COLUMN "statistics",
ADD COLUMN     "slug" TEXT NOT NULL,
ALTER COLUMN "contract" SET NOT NULL,
DROP COLUMN "dateOfBirth",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "experience" SET NOT NULL,
ALTER COLUMN "injuries" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "capSpace",
DROP COLUMN "city",
DROP COLUMN "conference",
DROP COLUMN "division",
DROP COLUMN "firstApronSpace",
DROP COLUMN "record",
DROP COLUMN "secondApronSpace",
DROP COLUMN "slug",
DROP COLUMN "totalCapAllocation",
DROP COLUMN "venue",
ADD COLUMN     "isAllStar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "links" JSONB NOT NULL,
ADD COLUMN     "location" TEXT NOT NULL,
ADD COLUMN     "nickname" TEXT NOT NULL,
ALTER COLUMN "isActive" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_pkey",
DROP COLUMN "isAIGenerated",
DROP COLUMN "reasoning",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Trade_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TradeAsset" DROP COLUMN "assetType",
ADD COLUMN     "teamId" INTEGER NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "tradeId",
ADD COLUMN     "tradeId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_teamId_year_round_key" ON "DraftPick"("teamId", "year", "round");

-- CreateIndex
CREATE INDEX "TradeAsset_teamId_idx" ON "TradeAsset"("teamId");

-- CreateIndex
CREATE INDEX "TradeAsset_tradeId_idx" ON "TradeAsset"("tradeId");

-- CreateIndex
CREATE INDEX "TradeAsset_playerId_idx" ON "TradeAsset"("playerId");

-- CreateIndex
CREATE INDEX "TradeAsset_draftPickId_idx" ON "TradeAsset"("draftPickId");

-- AddForeignKey
ALTER TABLE "TradeAsset" ADD CONSTRAINT "TradeAsset_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
