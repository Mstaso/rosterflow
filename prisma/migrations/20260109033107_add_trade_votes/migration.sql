-- CreateTable
CREATE TABLE "TradeVote" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeVote_userId_idx" ON "TradeVote"("userId");

-- CreateIndex
CREATE INDEX "TradeVote_tradeId_idx" ON "TradeVote"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeVote_userId_tradeId_key" ON "TradeVote"("userId", "tradeId");

-- AddForeignKey
ALTER TABLE "TradeVote" ADD CONSTRAINT "TradeVote_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
