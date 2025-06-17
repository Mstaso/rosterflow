"use client";

import Link from "next/link";
import { HandshakeIcon, SettingsIcon } from "lucide-react";
import { Button } from "~/components/ui/button";

export function Navbar() {
  return (
    <nav className="bg-transparent border-b border-gray-800">
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
            <span>Roster Flows</span>
          </Link>

          {/* Placeholder elements for the right side of the navbar */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Login
            </Button>
            <Button variant="ghost" size="icon">
              <SettingsIcon className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">Settings</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
