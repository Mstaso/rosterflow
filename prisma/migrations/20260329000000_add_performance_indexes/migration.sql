-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "Trade"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Trade_userId_createdAt_idx" ON "Trade"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TradeAsset_tradeId_type_idx" ON "TradeAsset"("tradeId", "type");

-- CreateIndex
CREATE INDEX "TradeComment_tradeId_createdAt_idx" ON "TradeComment"("tradeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TradeVote_tradeId_value_idx" ON "TradeVote"("tradeId", "value");

-- CreateIndex
CREATE INDEX "TradeVote_userId_value_idx" ON "TradeVote"("userId", "value");
