/**
 * API URL utilities to handle both client-side and server-side API calls
 */

/**
 * Get the base URL for API calls
 * - On the client: uses window.location
 * - On the server: uses environment variables or defaults
 */
export function getBaseUrl(): string {
  // Client-side
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side
  // Check for Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Check for custom environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Development fallback
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://localhost:3000"; // This should be your production domain
}

/**
 * Generate a full API URL from a relative path
 * @param path - The API path (e.g., '/api/espn/nba/teams')
 * @returns Full URL with protocol and domain
 */
export function getApiUrl(path: string): string {
  const baseUrl = getBaseUrl();

  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

/**
 * Create a fetch function that automatically uses the correct base URL
 * This is useful for server-side API calls
 */
export function createApiFetch() {
  return (path: string, options?: RequestInit) => {
    const url = getApiUrl(path);
    return fetch(url, options);
  };
}

/**
 * Environment detection utilities
 */
export const isClient = typeof window !== "undefined";
export const isServer = !isClient;
export const isDevelopment = process.env.NODE_ENV === "development";
export const isProduction = process.env.NODE_ENV === "production";

/**
 * Get environment-specific configuration
 */
export function getEnvConfig() {
  return {
    baseUrl: getBaseUrl(),
    isClient,
    isServer,
    isDevelopment,
    isProduction,
    vercelUrl: process.env.VERCEL_URL,
    customUrl: process.env.NEXT_PUBLIC_APP_URL,
  };
}
