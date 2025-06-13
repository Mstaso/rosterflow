// ESPN API utility functions and types

export interface ESPNTeam {
  id: string;
  uid: string;
  slug: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  city: string;
  color: string;
  alternateColor: string;
  isActive: boolean;
  logos: Array<{
    href: string;
    width: number;
    height: number;
    alt: string;
    rel: string[];
    lastUpdated: string;
  }>;
}

export interface ESPNPlayer {
  id: string;
  uid: string;
  guid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string;
  shortName: string;
  weight: number;
  displayWeight: string;
  height: number;
  displayHeight: string;
  age: number;
  dateOfBirth: string;
  birthPlace: {
    city: string;
    state: string;
    country: string;
  };
  jersey: string;
  position: {
    id: string;
    name: string;
    displayName: string;
    abbreviation: string;
  };
  headshot: {
    href: string;
    alt: string;
  };
  status: {
    id: string;
    name: string;
    type: string;
    abbreviation: string;
  };
  team?: ESPNTeam;
}

export interface ESPNAPIResponse<T> {
  success: boolean;
  data: T;
  source: string;
  error?: string;
}

// ESPN API base URLs
export const ESPN_BASE_URLS = {
  SITE_API: "https://site.api.espn.com",
  CORE_API: "https://sports.core.api.espn.com",
  WEB_API: "https://site.web.api.espn.com",
  CDN: "https://cdn.espn.com",
} as const;

// Common ESPN API endpoints
export const ESPN_ENDPOINTS = {
  // Teams
  TEAMS: (league: string) => `/apis/site/v2/sports/football/${league}/teams`,
  TEAM_DETAIL: (league: string, teamId: string) =>
    `/apis/site/v2/sports/football/${league}/teams/${teamId}`,
  TEAM_ROSTER: (league: string, teamId: string) =>
    `/apis/site/v2/sports/football/${league}/teams/${teamId}/roster`,

  // Players
  PLAYERS: (league: string) => `/v3/sports/football/${league}/athletes`,
  PLAYER_DETAIL: (league: string, playerId: string) =>
    `/apis/common/v3/sports/football/${league}/athletes/${playerId}`,

  // Games/Scores
  SCOREBOARD: (league: string) =>
    `/apis/site/v2/sports/football/${league}/scoreboard`,
  GAME_SUMMARY: (league: string) =>
    `/apis/site/v2/sports/football/${league}/summary`,

  // Standings
  STANDINGS: (league: string) =>
    `/apis/site/v2/sports/football/${league}/standings`,
} as const;

// Helper function to build ESPN API URLs
export function buildESPNUrl(
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string>,
): string {
  let url = `${baseUrl}${endpoint}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    if (searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }
  }

  return url;
}

// Helper function to make ESPN API requests
export async function fetchESPNData<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN API responded with status: ${response.status}`);
  }

  return response.json();
}

// Common team ID mappings (NFL)
export const NFL_TEAM_IDS = {
  ARI: "22",
  ATL: "1",
  BAL: "33",
  BUF: "2",
  CAR: "29",
  CHI: "3",
  CIN: "4",
  CLE: "5",
  DAL: "6",
  DEN: "7",
  DET: "8",
  GB: "9",
  HOU: "34",
  IND: "11",
  JAX: "30",
  KC: "12",
  LV: "13",
  LAC: "24",
  LAR: "14",
  MIA: "15",
  MIN: "16",
  NE: "17",
  NO: "18",
  NYG: "19",
  NYJ: "20",
  PHI: "21",
  PIT: "23",
  SF: "25",
  SEA: "26",
  TB: "27",
  TEN: "10",
  WAS: "28",
} as const;

// Position mappings
export const NFL_POSITIONS = {
  QB: "Quarterback",
  RB: "Running Back",
  FB: "Fullback",
  WR: "Wide Receiver",
  TE: "Tight End",
  C: "Center",
  G: "Guard",
  T: "Tackle",
  DE: "Defensive End",
  DT: "Defensive Tackle",
  NT: "Nose Tackle",
  LB: "Linebacker",
  CB: "Cornerback",
  S: "Safety",
  K: "Kicker",
  P: "Punter",
  LS: "Long Snapper",
} as const;
