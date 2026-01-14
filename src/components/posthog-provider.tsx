"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_POSTHOG_KEY &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false, // We capture manually below
        capture_pageleave: true,
      });
    }
  }, []);

  if (
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    !process.env.NEXT_PUBLIC_POSTHOG_HOST
  ) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

function PostHogIdentify() {
  const { user, isLoaded } = useUser();
  const posthog = usePostHog();

  useEffect(() => {
    if (isLoaded && posthog) {
      if (user) {
        posthog.identify(user.id, {
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName,
          username: user.username,
        });
      } else {
        posthog.reset();
      }
    }
  }, [user, isLoaded, posthog]);

  return null;
}
