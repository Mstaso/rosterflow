export interface RedditRumorItem {
  externalId: string;
  source: "reddit";
  sourceType: "fan";
  title: string;
  summary: string;
  url: string;
  author: string | null;
  publishedAt: Date;
  redditScore: number;
}

interface RedditPost {
  kind: string;
  data: {
    name: string; // fullname like t3_xxx
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    author: string;
    created_utc: number;
    score: number;
    num_comments: number;
    link_flair_text?: string | null;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

import { isTradeRelated } from "./trade-keywords";

const REDDIT_HEADERS = {
  "User-Agent": "web:RosterFlows:1.0 (by /u/rosterflows)",
  Accept: "application/json",
};

async function fetchRedditEndpoint(url: string): Promise<RedditPost[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    const response = await fetch(url, {
      headers: REDDIT_HEADERS,
      next: { revalidate: 0 },
    });

    if (response.ok) {
      const data: RedditListing = await response.json();
      return data?.data?.children ?? [];
    }

    lastError = new Error(`Reddit fetch failed: ${response.status}`);
  }

  throw lastError;
}

function postToRumor(post: RedditPost): RedditRumorItem {
  const d = post.data;
  const summary = (d.selftext ?? "").slice(0, 300).trim();

  return {
    externalId: d.name, // t3_xxx format
    source: "reddit",
    sourceType: "fan",
    title: d.title,
    summary,
    url: `https://www.reddit.com${d.permalink}`,
    author: d.author ?? null,
    publishedAt: new Date(d.created_utc * 1000),
    redditScore: d.score,
  };
}

// Subreddits to fetch from. Trade-focused subs skip the keyword filter
// since all their content is trade-related by nature.
const REDDIT_SOURCES = [
  // r/nba — large general sub, needs keyword filtering
  {
    endpoints: [
      "https://www.reddit.com/r/nba/search.json?q=trade+OR+rumor+OR+deal&sort=new&restrict_sr=on&limit=25&t=week",
      "https://www.reddit.com/r/nba/hot.json?limit=50",
    ],
    requireTradeKeyword: true,
  },
  // r/nbatradeideas — entire sub is trade content
  {
    endpoints: [
      "https://www.reddit.com/r/nbatradeideas/hot.json?limit=25",
      "https://www.reddit.com/r/nbatradeideas/new.json?limit=25",
    ],
    requireTradeKeyword: false,
  },
];

export async function fetchRedditRumors(): Promise<RedditRumorItem[]> {
  const allFetches = REDDIT_SOURCES.flatMap((source) =>
    source.endpoints.map((url) =>
      fetchRedditEndpoint(url).then((posts) => ({
        posts,
        requireTradeKeyword: source.requireTradeKeyword,
      }))
    )
  );

  const results = await Promise.allSettled(allFetches);

  const seen = new Set<string>();
  const rumors: RedditRumorItem[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("Reddit fetch failed:", result.reason);
      continue;
    }

    const { posts, requireTradeKeyword } = result.value;
    for (const post of posts) {
      if (seen.has(post.data.name)) continue;
      seen.add(post.data.name);

      if (requireTradeKeyword && !isTradeRelated(post.data.title)) continue;

      rumors.push(postToRumor(post));
    }
  }

  return rumors;
}
