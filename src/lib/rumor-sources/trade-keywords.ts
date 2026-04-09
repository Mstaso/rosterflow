export const TRADE_KEYWORDS = [
  // Direct trade language
  "trade",
  "traded",
  "trading",
  "deal",
  "sign-and-trade",
  "swap",
  "package",
  "blockbuster",
  // Rumor language
  "rumor",
  "reportedly",
  "sources say",
  "sources:",
  "per sources",
  "according to",
  // Exploration language
  "exploring",
  "in talks",
  "pursuing",
  "interested in",
  "shopping",
  "looking to move",
  "on the block",
  "available",
  "making available",
  "open to moving",
  "gauging interest",
  "fielding offers",
  // Offer language
  "offer",
  "acquisition",
  "send",
  "acquire",
  "in exchange",
  "in return",
  // Deadline / offseason
  "deadline",
  "offseason",
  "free agent",
  "free agency",
  "buyout",
  "waive",
  "opt out",
];

export function isTradeRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return TRADE_KEYWORDS.some((kw) => lower.includes(kw));
}
