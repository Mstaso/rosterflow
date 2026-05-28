"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon, ArrowLeftRight, BookmarkIcon } from "lucide-react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { cn } from "~/lib/utils";

interface NavbarProps {
  /** Optional editorial kicker shown beneath the wordmark — e.g. "Trade
   *  Details" on a saved-trade page. Rendered as a font-supermolot label,
   *  intentionally NOT as a slash-separated breadcrumb (that pattern reads
   *  as a dev tool; RosterFlow's masthead is supposed to read as a sports
   *  almanac). */
  subtitle?: React.ReactNode;
}

const navLinks = [
  { href: "/", label: "Trade Machine", icon: ArrowLeftRight },
  // "Community Trades" is the canonical label for /my-trades — matches the
  // page metadata title, masthead subtitle, footer link, FAQ link, and the
  // homepage CTA. Don't drift toward "Library" or "My Trades" here without
  // updating those other touchpoints too (see context.md).
  { href: "/my-trades", label: "Community Trades", icon: BookmarkIcon },
];

function isLinkActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Navbar({ subtitle }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open.
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Sticky glass nav — the only chrome the page wears at the top.
          Glass is earned here because the masthead floats over content. */}
      <nav className="sticky top-0 z-[100] bg-surface-low/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-low/60">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Masthead block: hamburger (mobile), wordmark stack, nav links. */}
            <div className="flex items-center gap-4 md:gap-9">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden -ml-2 p-2 text-on-surface-variant hover:text-foreground transition-colors"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <XIcon className="h-6 w-6" strokeWidth={1.75} />
                ) : (
                  <MenuIcon className="h-6 w-6" strokeWidth={1.75} />
                )}
              </button>

              {/* Wordmark + editorial kicker. Stacked masthead (logo over
                  subtitle) instead of a slash-breadcrumb so the chrome
                  reads like a magazine, not a Vercel project header. */}
              <div className="flex flex-col leading-none">
                <Link
                  href="/"
                  className="text-xl text-foreground hover:text-foreground/90 transition-colors font-supermolot"
                >
                  Roster<span className="text-primary">Flows</span>
                </Link>
                {subtitle && (
                  <div className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mt-1">
                    {subtitle}
                  </div>
                )}
              </div>

              {/* Desktop nav — text-only editorial labels. Active link wears
                  a 2px primary underline that drops to the nav baseline; no
                  pill, no surface-high fill, no icons. */}
              <div className="hidden md:flex items-stretch gap-7 h-16">
                {navLinks.map((link) => {
                  const active = isLinkActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "relative flex items-center font-supermolot text-[11px] tracking-[0.22em] transition-colors",
                        active
                          ? "text-foreground"
                          : "text-on-surface-variant hover:text-foreground"
                      )}
                    >
                      {link.label}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-[2px] bg-primary"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side: labeled sign-in (editorial ghost) or user button. */}
            <div className="flex items-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="font-supermolot text-[11px] tracking-[0.22em] text-on-surface-variant hover:text-foreground transition-colors px-3 py-2">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile overlay — tinted with surface (not pure black) so the brand
          color story carries through the dim. */}
      <div
        className={cn(
          "fixed inset-0 z-[150] bg-surface/70 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile flyout panel. Icons stay here — touch UX benefits from the
          extra affordance, and the editorial-text-only treatment lives on
          desktop where the masthead reads. */}
      <div
        className={cn(
          "fixed top-0 left-0 z-[200] h-full w-72 bg-surface-low shadow-ambient transition-transform duration-300 ease-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 bg-surface-container/50">
          <Link
            href="/"
            className="text-lg text-foreground font-supermolot"
            onClick={() => setMobileMenuOpen(false)}
          >
            Roster<span className="text-primary">Flows</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-on-surface-variant hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <XIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 pt-6 pb-4">
          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-3">
            Navigate
          </p>
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 text-sm rounded-md transition-colors",
                    active
                      ? "text-foreground bg-surface-high"
                      : "text-on-surface-variant hover:text-foreground hover:bg-surface-container"
                  )}
                >
                  <link.icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      active ? "text-primary" : ""
                    )}
                    strokeWidth={1.75}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
