"use client";

import Link from "next/link";
import { HandshakeIcon, SettingsIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 border-b border-gray-800 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {" "}
      {/* Changed border color to a light gray */}
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

          {/* Placeholder elements for the right side of the navbar */}
          <div className="flex items-center justify-end gap-2">
            <SignedOut>
              <SignInButton mode="modal" />
              {/* <SignUpButton /> */}
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}
