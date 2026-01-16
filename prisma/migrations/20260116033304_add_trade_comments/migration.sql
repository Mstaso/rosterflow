-- CreateTable
CREATE TABLE "TradeComment" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tradeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeComment_userId_idx" ON "TradeComment"("userId");

-- CreateIndex
CREATE INDEX "TradeComment_tradeId_idx" ON "TradeComment"("tradeId");

-- AddForeignKey
ALTER TABLE "TradeComment" ADD CONSTRAINT "TradeComment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
