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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflow.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RosterFlow - AI-Powered NBA Trade Machine & Simulator",
    template: "%s | RosterFlow",
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
  ],
  authors: [{ name: "RosterFlow" }],
  creator: "RosterFlow",
  publisher: "RosterFlow",
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
    siteName: "RosterFlow",
    title: "RosterFlow - AI-Powered NBA Trade Machine & Simulator",
    description:
      "Create realistic NBA trades with AI-powered analysis. Validate salary cap compliance, analyze trade value, and generate smart trade suggestions.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RosterFlow - AI-Powered NBA Trade Machine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RosterFlow - AI-Powered NBA Trade Machine & Simulator",
    description:
      "Create realistic NBA trades with AI-powered analysis. Validate salary cap compliance and generate smart trade suggestions.",
    images: ["/og-image.png"],
    creator: "@rosterflow",
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
          colorBackground: "hsl(222.2 84% 4.9%)",
          colorInputBackground: "hsl(217.2 32.6% 17.5%)",
          colorPrimary: "hsl(243 75% 59%)",
          colorText: "hsl(210 40% 98%)",
          colorTextSecondary: "hsl(215 20.2% 65.1%)",
          colorDanger: "hsl(0 62.8% 30.6%)",
          borderRadius: "0.5rem",
        },
        elements: {
          card: {
            backgroundColor: "hsl(222.2 84% 4.9%)",
            borderColor: "hsl(217.2 32.6% 17.5%)",
          },
          userButtonPopoverCard: {
            backgroundColor: "hsl(222.2 84% 4.9%)",
            borderColor: "hsl(217.2 32.6% 17.5%)",
          },
          userButtonPopoverActionButton: {
            color: "hsl(210 40% 98%)",
          },
          userButtonPopoverActionButtonIcon: {
            color: "hsl(215 20.2% 65.1%)",
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
