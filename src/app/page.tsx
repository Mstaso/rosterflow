import { getNBATeams } from "~/actions/nbaTeams";
import { Navbar } from "~/components/layout/navbar";
import { Footer } from "~/components/layout/footer";
import TradeMachineClient from "~/components/trade-machine/trade-machine-client";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import type { SelectedAsset } from "~/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflows.com";

export const metadata: Metadata = {
  title: "NBA Trade Machine - AI Trade Generator",
  description:
    "Generate multiple realistic NBA trade scenarios instantly with AI — no clunky menus or one-trade-at-a-time limits. Validates salary cap rules, analyzes trade value, and suggests deals you wouldn't think of.",
  openGraph: {
    title: "NBA Trade Machine - AI Trade Generator | Roster Flows",
    description:
      "Generate multiple realistic NBA trade scenarios instantly with AI. Clean interface, salary cap validation, and trade ideas you wouldn't think of.",
  },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function TradeMachinePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const nbaTeams: any = await getNBATeams();
  const params = await searchParams;

  // Parse initial state from URL params (for editing saved trades)
  let initialTeamIds: number[] = [];
  let initialAssets: SelectedAsset[] = [];

  if (params.teamIds && typeof params.teamIds === "string") {
    initialTeamIds = params.teamIds.split(",").map((id) => parseInt(id, 10));
  }

  if (params.assets && typeof params.assets === "string") {
    try {
      initialAssets = JSON.parse(params.assets);
    } catch (e) {
      console.error("Failed to parse assets from URL:", e);
    }
  }

  return (
    <main className="bg-background text-foreground">
      <BreadcrumbJsonLd
        items={[{ name: "Home", url: siteUrl }]}
      />
      <div className="flex flex-col">
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="w-full border-b border-border bg-muted/40">
            <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-2.5">
              <h1 className="text-sm font-medium tracking-wide text-muted-foreground/80 uppercase">
                NBA Trade Machine
              </h1>
              <p className="sr-only">
                The fastest way to explore NBA trades. Generate multiple AI-powered trade scenarios at once with a clean, modern interface — no clutter, no clunky menus. Includes full salary cap validation under current CBA rules.
              </p>
            </div>
          </div>
          <TradeMachineClient
            nbaTeams={nbaTeams || []}
            initialTeamIds={initialTeamIds}
            initialAssets={initialAssets}
          />
        </div>

        <Footer />
      </div>
    </main>
  );
}
