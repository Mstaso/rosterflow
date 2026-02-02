// NBA-themed username generator
// Generates deterministic usernames based on user ID

const adjectives = [
  "Swift",
  "Clutch",
  "Elite",
  "Prime",
  "Smooth",
  "Silky",
  "Icy",
  "Cold",
  "Hot",
  "Blazing",
  "Quick",
  "Slick",
  "Crafty",
  "Savvy",
  "Sharp",
  "Fierce",
  "Bold",
  "Steady",
  "Calm",
  "Locked",
  "Pure",
  "Clean",
  "Fresh",
  "Nasty",
  "Filthy",
  "Wet",
  "Automatic",
  "Lethal",
  "Deadly",
  "Silent",
];

const nbaTerms = [
  "Buckets",
  "Swish",
  "Dimer",
  "Sniper",
  "Shooter",
  "Baller",
  "Hooper",
  "Cager",
  "Rebounder",
  "Rim",
  "Paint",
  "Arc",
  "Corner",
  "Wing",
  "Post",
  "Point",
  "Fadeaway",
  "Stepback",
  "Crossover",
  "Eurostep",
  "Floater",
  "Lob",
  "Oop",
  "Dunk",
  "Slam",
  "Poster",
  "Ankle",
  "Handles",
  "Vision",
  "IQ",
  "Motor",
  "Hustle",
  "Defense",
  "Lockdown",
  "Stopper",
  "Closer",
  "Takeover",
  "Heat",
  "Zone",
  "Flow",
];

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic NBA-themed username from a user ID
 * The same user ID will always produce the same username
 */
export function generateNBAUsername(userId: string): string {
  const hash = hashString(userId);

  // Use different parts of the hash for each component
  const adjIndex = hash % adjectives.length;
  const termIndex = Math.floor(hash / adjectives.length) % nbaTerms.length;
  const number = (hash % 99) + 1; // 1-99

  const adjective = adjectives[adjIndex];
  const term = nbaTerms[termIndex];

  return `${adjective}${term}${number}`;
}

/**
 * Gets a display name for a user, preferring their Clerk username
 * Falls back to a generated NBA-themed username
 */
export function getDisplayName(
  userId: string,
  clerkUsername?: string | null
): string {
  // If user has set a Clerk username, use it
  if (clerkUsername && clerkUsername.trim()) {
    return clerkUsername;
  }

  // Otherwise generate an NBA-themed username
  return generateNBAUsername(userId);
}
