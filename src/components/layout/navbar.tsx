"use client";

import Link from "next/link";
import { HandshakeIcon, BookmarkIcon } from "lucide-react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 border-b border-gray-800 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-foreground/90 transition-colors"
          >
            <HandshakeIcon
              className="h-7 w-7 text-indigoMain"
              strokeWidth={1.5}
            />
            <span className="font-supermolot">Roster Flows</span>
          </Link>

          <div className="flex items-center justify-end gap-4">
            <SignedOut>
              <SignInButton mode="modal" />
            </SignedOut>
            <SignedIn>
              <Link
                href="/my-trades"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <BookmarkIcon className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">My Trades</span>
              </Link>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}
