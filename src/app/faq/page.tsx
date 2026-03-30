import { Navbar } from "~/components/layout/navbar";
import { Footer } from "~/components/layout/footer";
import { FAQJsonLd, BreadcrumbJsonLd } from "~/components/seo/json-ld";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflows.com";

export const metadata: Metadata = {
  title: "FAQ - NBA Trade Machine Questions Answered",
  description:
    "How does the Roster Flows NBA trade machine work? Learn about AI trade generation, salary cap validation, trade exceptions, and why Roster Flows is the best NBA trade simulator.",
  openGraph: {
    title: "FAQ - NBA Trade Machine Questions Answered | Roster Flows",
    description:
      "How does the Roster Flows NBA trade machine work? Learn about AI trade generation, salary cap validation, and trade exceptions.",
  },
  alternates: {
    canonical: `${siteUrl}/faq`,
  },
};

const faqs = [
  {
    question: "How does the NBA trade machine work?",
    answer:
      "There are two ways to use it. To generate AI trade ideas, select at least one team and one player or draft pick, and the AI will create multiple realistic trade scenarios for you. To build your own trade with Try Trade, select at least two teams and add a player or pick from each side — the trade machine then validates it against current salary cap rules and analyzes the deal.",
  },
  {
    question: "Does this trade machine check salary cap rules?",
    answer:
      "Yes. Every trade is validated against the current NBA salary cap rules, including the first and second apron thresholds, trade exceptions, and the 125% matching rule. You'll see exactly whether a trade works financially before sharing it.",
  },
  {
    question: "Can I generate multiple trade ideas at once?",
    answer:
      "Yes — that's what makes Roster Flows different from other trade machines. Select your teams and let the AI generate multiple realistic trade scenarios. Instead of manually building one trade at a time, you get several options to compare.",
  },
  {
    question: "Why use Roster Flows instead of other NBA trade machines?",
    answer:
      "Most trade machines make you build one trade at a time through clunky interfaces. Roster Flows lets users generate multiple realistic trade scenarios at once, so you can compare options instead of guessing. The interface is clean and modern — no ads cluttering the screen, no confusing menus. Plus every trade is validated against current salary cap rules automatically.",
  },
];

export default function FAQPage() {
  return (
    <main className="bg-background text-foreground">
      <FAQJsonLd faqs={faqs} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "FAQ", url: `${siteUrl}/faq` },
        ]}
      />
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <section className="mx-auto w-full max-w-3xl px-4 py-12 flex-grow">
          <h1 className="mb-6 text-xl font-semibold tracking-tight">
            Frequently Asked Questions
          </h1>
          <div className="divide-y divide-border">
            {faqs.map((faq) => (
              <details key={faq.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <svg
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}
