import { XMLParser } from "fast-xml-parser";
import { isTradeRelated } from "./trade-keywords";

export interface RSSRumorItem {
  externalId: string;
  source: string;
  sourceType: "insider";
  title: string;
  summary: string;
  url: string;
  author: string | null;
  publishedAt: Date;
}

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text": string };
  "dc:creator"?: string;
  creator?: string;
}

const RSS_FEEDS = [
  {
    url: "https://www.hoopsrumors.com/feed/",
    source: "hoopsrumors",
  },
  {
    url: "https://www.espn.com/espn/rss/nba/news",
    source: "espn",
  },
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "...")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGuid(guid: string | { "#text": string } | undefined): string {
  if (!guid) return "";
  if (typeof guid === "string") return guid;
  return guid["#text"] ?? "";
}

async function fetchSingleFeed(
  feedUrl: string,
  source: string
): Promise<RSSRumorItem[]> {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "RosterFlows/1.0" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed for ${source}: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const parsed = parser.parse(xml);
  const items: RSSItem[] =
    parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];

  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => {
      if (!item.title || (!item.link && !item.guid)) return false;
      const text = `${item.title ?? ""} ${item.description ?? ""}`;
      return isTradeRelated(text);
    })
    .map((item) => {
      const rawSummary = item.description ?? "";
      const summary = stripHtml(rawSummary).slice(0, 300);
      const guid = extractGuid(item.guid) || item.link || "";

      return {
        externalId: `${source}:${guid}`,
        source,
        sourceType: "insider" as const,
        title: stripHtml(item.title ?? ""),
        summary,
        url: item.link ?? guid,
        author: item["dc:creator"] ?? item.creator ?? null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      };
    });
}

export async function fetchAllRSSRumors(): Promise<RSSRumorItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => fetchSingleFeed(feed.url, feed.source))
  );

  const rumors: RSSRumorItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      rumors.push(...result.value);
    } else {
      console.error("RSS feed fetch failed:", result.reason);
    }
  }

  return rumors;
}
