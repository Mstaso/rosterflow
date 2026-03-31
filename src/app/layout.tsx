import "~/styles/globals.css";
import { ThemeProvider } from "~/components/theme-provider";
import { PostHogProvider } from "~/components/posthog-provider";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import { Exo_2 } from "next/font/google";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { WebsiteJsonLd, OrganizationJsonLd } from "~/components/seo/json-ld";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });
const logo = Exo_2({
  subsets: ["latin"],
  weight: ["700", "800"],
  style: ["italic", "normal"],
  variable: "--font-logo",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflows.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Roster Flows - AI-Powered NBA Trade Machine & Simulator",
    template: "%s | Roster Flows",
  },
  description:
    "Create realistic NBA trades with AI-powered analysis. Our trade machine validates salary cap compliance, analyzes trade value, and generates smart trade suggestions. Build your perfect NBA roster today.",
  keywords: [
    "NBA trade machine",
    "NBA trade simulator",
    "NBA trades",
    "basketball trade analyzer",
    "NBA salary cap",
    "NBA roster builder",
    "AI trade generator",
    "NBA trade ideas",
    "fantasy basketball trades",
    "NBA trade rumors",
    "basketball trade calculator",
    "NBA player trades",
    "best NBA trade machine",
    "easy NBA trade simulator",
    "NBA trade machine alternative",
  ],
  authors: [{ name: "RosterFlows" }],
  creator: "RosterFlows", 
  publisher: "RosterFlows",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Roster Flows",
    title: "Roster Flows - AI-Powered NBA Trade Machine & Simulator",
    description:
      "Create realistic NBA trades with AI-powered analysis. Validate salary cap compliance, analyze trade value, and generate smart trade suggestions.",
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "Sports",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          fontFamily: "Inter, system-ui, sans-serif",
          colorBackground: "hsl(218 50% 6%)",
          colorInputBackground: "hsl(220 41% 9%)",
          colorPrimary: "hsl(230 80% 62%)",
          colorText: "hsl(225 50% 92%)",
          colorTextSecondary: "hsl(220 15% 55%)",
          colorDanger: "hsl(0 55% 45%)",
          borderRadius: "0.5rem",
        },
        elements: {
          card: {
            backgroundColor: "hsl(220 41% 9%)",
            borderColor: "hsl(220 20% 18% / 0.15)",
          },
          userButtonPopoverCard: {
            backgroundColor: "hsl(220 41% 9%)",
            borderColor: "hsl(220 20% 18% / 0.15)",
          },
          userButtonPopoverActionButton: {
            color: "hsl(225 50% 92%)",
          },
          userButtonPopoverActionButtonIcon: {
            color: "hsl(220 15% 55%)",
          },
          userButtonPopoverFooter: {
            display: "none",
          },
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/favicon.svg" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <WebsiteJsonLd />
          <OrganizationJsonLd />
        </head>
        <body className={`${inter.className} ${logo.variable}`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <PostHogProvider>
              {children}
            </PostHogProvider>
            <Analytics />
            <SpeedInsights />
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
