/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `capSpace` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `conference` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `division` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstApronSpace` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `record` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secondApronSpace` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCapAllocation` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "capSpace" INTEGER NOT NULL,
ADD COLUMN     "conference" TEXT NOT NULL,
ADD COLUMN     "division" TEXT NOT NULL,
ADD COLUMN     "firstApronSpace" INTEGER NOT NULL,
ADD COLUMN     "record" JSONB NOT NULL,
ADD COLUMN     "secondApronSpace" INTEGER NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "totalCapAllocation" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
