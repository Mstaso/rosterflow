import type { MetadataRoute } from "next";
import prisma from "~/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflows.com";

// Bump when static page content meaningfully changes.
const STATIC_LAST_MODIFIED = new Date("2026-05-26");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trades = prisma
    ? await prisma.trade.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return [
    { url: siteUrl, lastModified: STATIC_LAST_MODIFIED },
    { url: `${siteUrl}/faq`, lastModified: STATIC_LAST_MODIFIED },
    { url: `${siteUrl}/my-trades`, lastModified: STATIC_LAST_MODIFIED },
    ...trades.map((t) => ({
      url: `${siteUrl}/my-trades/${t.id}`,
      lastModified: t.updatedAt,
    })),
  ];
}
