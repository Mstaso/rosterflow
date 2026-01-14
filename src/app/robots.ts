import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflow.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/my-trades/"], // Protect user-specific trade pages
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
