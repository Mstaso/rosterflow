/*
  Warnings:

  - You are about to drop the column `contractYears` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `Player` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[teamId,displayName]` on the table `Player` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dateOfBirth` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayHeight` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayName` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayWeight` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jersey` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shortName` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weight` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `position` on the `Player` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `age` on table `Player` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `alternateColor` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `color` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `displayName` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isActive` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logos` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shortDisplayName` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_teamId_fkey";

-- DropIndex
DROP INDEX "Player_salary_idx";

-- DropIndex
DROP INDEX "Player_teamId_name_key";

-- DropIndex
DROP INDEX "Team_abbreviation_key";

-- DropIndex
DROP INDEX "Team_conference_idx";

-- DropIndex
DROP INDEX "Team_name_key";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "contractYears",
DROP COLUMN "name",
DROP COLUMN "salary",
ADD COLUMN     "birthPlace" JSONB,
ADD COLUMN     "college" JSONB,
ADD COLUMN     "contract" JSONB,
ADD COLUMN     "dateOfBirth" TEXT NOT NULL,
ADD COLUMN     "displayHeight" TEXT NOT NULL,
ADD COLUMN     "displayName" TEXT NOT NULL,
ADD COLUMN     "displayWeight" TEXT NOT NULL,
ADD COLUMN     "experience" JSONB,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "headshot" JSONB,
ADD COLUMN     "height" INTEGER NOT NULL,
ADD COLUMN     "injuries" JSONB,
ADD COLUMN     "jersey" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "shortName" TEXT NOT NULL,
ADD COLUMN     "statistics" JSONB,
ADD COLUMN     "status" JSONB,
ADD COLUMN     "weight" INTEGER NOT NULL,
DROP COLUMN "position",
ADD COLUMN     "position" JSONB NOT NULL,
ALTER COLUMN "age" SET NOT NULL;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "alternateColor" TEXT NOT NULL,
ADD COLUMN     "color" TEXT NOT NULL,
ADD COLUMN     "displayName" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL,
ADD COLUMN     "logos" JSONB NOT NULL,
ADD COLUMN     "record" JSONB,
ADD COLUMN     "shortDisplayName" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "venue" JSONB,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "abbreviation" SET DATA TYPE TEXT,
ALTER COLUMN "city" SET DATA TYPE TEXT,
ALTER COLUMN "conference" SET DATA TYPE TEXT,
ALTER COLUMN "division" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "Player"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Player_teamId_displayName_key" ON "Player"("teamId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Team_displayName_idx" ON "Team"("displayName");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
