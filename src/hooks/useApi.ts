import { useState, useEffect, useCallback, useRef } from "react";
import { getApiUrl } from "~/lib/api-utils";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean; // Whether to call the API immediately on mount
  cache?: boolean; // Whether to cache the result
  cacheTime?: number; // Cache time in milliseconds (default: 5 minutes)
}

// Simple in-memory cache
const apiCache = new Map<
  string,
  { data: any; timestamp: number; cacheTime: number }
>();

export function useApi<T = any>(
  url: string | null,
  options: UseApiOptions = {},
) {
  const { immediate = true, cache = true, cacheTime = 5 * 60 * 1000 } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (fetchUrl?: string) => {
      const targetUrl = fetchUrl || url;
      if (!targetUrl) return;

      // Check cache first
      if (cache) {
        const cached = apiCache.get(targetUrl);
        if (cached && Date.now() - cached.timestamp < cached.cacheTime) {
          setState({
            data: cached.data,
            loading: false,
            error: null,
          });
          return cached.data;
        }
      }

      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const fullUrl = getApiUrl(targetUrl);
        const response = await fetch(fullUrl, {
          signal: abortControllerRef.current.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Check if the response has the expected structure
        if (result.success === false) {
          throw new Error(result.error || "API request failed");
        }

        const data = result.success ? result.data || result : result;

        // Cache the result
        if (cache) {
          apiCache.set(targetUrl, {
            data,
            timestamp: Date.now(),
            cacheTime,
          });
        }

        setState({
          data,
          loading: false,
          error: null,
        });

        return data;
      } catch (error) {
        // Don't set error state if the request was aborted
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [url, cache, cacheTime],
  );

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  const mutate = useCallback(
    (newData: T) => {
      setState((prev) => ({ ...prev, data: newData }));

      // Update cache if caching is enabled
      if (cache && url) {
        apiCache.set(url, {
          data: newData,
          timestamp: Date.now(),
          cacheTime,
        });
      }
    },
    [cache, url, cacheTime],
  );

  // Clear cache for a specific URL
  const clearCache = useCallback(
    (clearUrl?: string) => {
      const targetUrl = clearUrl || url;
      if (targetUrl) {
        apiCache.delete(targetUrl);
      }
    },
    [url],
  );

  // Fetch data on mount if immediate is true and url is provided
  useEffect(() => {
    if (immediate && url) {
      fetchData();
    }

    // Cleanup function to abort any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [immediate, fetchData]);

  return {
    ...state,
    refetch,
    mutate,
    clearCache,
    fetchData, // For manual calls with different URLs
  };
}

// Specialized hook for team roster API
export function useTeamRoster(
  teamId: string | null,
  options: UseApiOptions = {},
) {
  const url = teamId ? `/api/espn/nba/team/${teamId}/roster` : null;

  return useApi<{
    team: any;
    roster: Array<{
      id: string;
      displayName: string;
      position?: { abbreviation: string };
      contract?: { salary: number };
      [key: string]: any;
    }>;
    rosterCount: number;
    season: string;
  }>(url, {
    cache: true,
    cacheTime: 10 * 60 * 1000, // Cache for 10 minutes
    ...options,
  });
}

// Specialized hook for NBA teams
export function useNBATeams(options: UseApiOptions = {}) {
  return useApi<
    Array<{
      id: string;
      displayName: string;
      name: string;
      [key: string]: any;
    }>
  >("/api/espn/nba/teams", {
    cache: true,
    cacheTime: 60 * 60 * 1000, // Cache for 1 hour since teams don't change often
    ...options,
  });
}

// Specialized hook for generating trades
export function useGenerateTrades() {
  const [state, setState] = useState<ApiState<any>>({
    data: null,
    loading: false,
    error: null,
  });

  const generateTrades = useCallback(
    async (payload: {
      assets: any[];
      teams: string[];
      destinationPreferences: Record<string, string[]>;
      sport: string;
    }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const fullUrl = getApiUrl("/api/trades/generate");
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedAssets: payload.assets, // API expects 'selectedAssets'
            teams: payload.teams,
            destinationPreferences: payload.destinationPreferences,
            sport: payload.sport,
          }),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to generate trades");
        }

        const trades = result.data?.trades || result.trades;

        // Mark all trades as AI-generated to ensure proper rendering
        const markedTrades = Array.isArray(trades)
          ? trades.map((trade: any) => ({
              ...trade,
              isOpenAIGenerated: true,
              source: "OpenAI GPT-4o-mini",
            }))
          : trades;

        setState({
          data: markedTrades,
          loading: false,
          error: null,
        });

        return markedTrades;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate trades";
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [],
  );

  return {
    ...state,
    generateTrades,
  };
}
