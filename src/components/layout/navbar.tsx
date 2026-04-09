"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HandshakeIcon,
  BookmarkIcon,
  MenuIcon,
  XIcon,
  ArrowLeftRight,
  UserCircleIcon,
  NewspaperIcon,
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { cn } from "~/lib/utils";

interface NavbarProps {
  subtitle?: React.ReactNode;
}

export function Navbar({ subtitle }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
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

  const navLinks = [
    {
      href: "/",
      label: "Trade Machine",
      icon: ArrowLeftRight,
    },
    {
      href: "/rumor-mill",
      label: "Rumor Mill",
      icon: NewspaperIcon,
    },
    {
      href: "/my-trades",
      label: "View Trades",
      icon: BookmarkIcon,
    },
  ];

  return (
    <>
      <nav className="sticky top-0 z-[100] bg-surface-low/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-low/60">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side: Mobile Menu Button + Logo */}
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button - Left side */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 -ml-2 text-on-surface-variant hover:text-foreground transition-colors"
                aria-label="Toggle menu"
              >
                <MenuIcon className="h-6 w-6" />
              </button>

              {/* Logo + Subtitle */}
              <div className="flex items-center gap-2">
                <HandshakeIcon
                  className="h-7 w-7 text-indigoMain shrink-0"
                  strokeWidth={1.5}
                />
                <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                  <Link
                    href="/"
                    className="text-xl font-bold text-foreground hover:text-foreground/90 transition-colors font-supermolot"
                  >
                    Roster Flows
                  </Link>
                  {subtitle && (
                    <>
                      <span className="hidden md:inline text-on-surface-variant/30 text-lg font-light select-none">/</span>
                      <div className="text-[11px] md:text-sm font-medium tracking-wide text-on-surface-variant uppercase -mt-0.5 md:mt-0">
                        {subtitle}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Desktop Navigation Links */}
              {subtitle && (
                <div className="hidden md:block w-px h-6 bg-on-surface-variant/15 ml-4" />
              )}
              <div className="hidden md:flex items-center gap-1 ml-4">
                {navLinks.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                        isActive
                          ? "text-foreground bg-surface-high"
                          : "text-on-surface-variant hover:text-foreground hover:bg-surface-container"
                      )}
                    >
                      <link.icon className="h-4 w-4" strokeWidth={1.5} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side: Auth */}
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="p-1 text-on-surface-variant hover:text-foreground transition-colors">
                    <UserCircleIcon className="h-7 w-7" strokeWidth={1.5} />
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

      {/* Mobile Flyout Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[150] bg-black/50 transition-opacity duration-300 md:hidden",
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Flyout Menu Panel */}
      <div
        className={cn(
          "fixed top-0 left-0 z-[200] h-full w-72 bg-surface-low shadow-ambient transition-transform duration-300 ease-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Flyout Header */}
        <div className="flex items-center justify-between h-16 px-4 bg-surface-container/50">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-foreground"
            onClick={() => setMobileMenuOpen(false)}
          >
            <HandshakeIcon
              className="h-6 w-6 text-indigoMain"
              strokeWidth={1.5}
            />
            <span className="font-supermolot">Roster Flows</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-on-surface-variant hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Flyout Navigation Links */}
        <div className="p-4">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 text-sm rounded-md transition-colors",
                    isActive
                      ? "text-foreground bg-surface-high"
                      : "text-on-surface-variant hover:text-foreground hover:bg-surface-container"
                  )}
                >
                  <link.icon className="h-5 w-5" strokeWidth={1.5} />
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
