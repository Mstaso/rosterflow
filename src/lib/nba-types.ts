// NBA-specific data types and interfaces

export interface NBATeam {
  id: string;
  uid: string;
  slug: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  location: string;
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
  record?: {
    items: Array<{
      description: string;
      type: string;
      summary: string;
      stats: Array<{
        name: string;
        value: number;
      }>;
    }>;
  };
  venue?: {
    id: string;
    fullName: string;
    address: {
      city: string;
      state: string;
    };
  };
}

export interface NBAPlayer {
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
  birthPlace?: {
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
  experience?: {
    years: number;
  };
  college?: {
    id: string;
    name: string;
    shortName: string;
    logo: string;
  };
  headshot?: {
    href: string;
    alt: string;
  };
  status?: {
    id: string;
    name: string;
    type: string;
  };
  injuries?: Array<{
    id: string;
    longComment: string;
    shortComment: string;
    status: string;
    date: string;
  }>;
  // Contract information - Note: This might not be available through ESPN API
  contract?: {
    salary?: number;
    years?: number;
    guaranteed?: number;
    type?: string;
  };
  // Stats that might be available
  statistics?: Array<{
    name: string;
    displayName: string;
    shortDisplayName: string;
    description: string;
    abbreviation: string;
    value: number;
    displayValue: string;
  }>;
}

export interface NBATeamRoster {
  team: NBATeam;
  roster: NBAPlayer[];
  rosterCount: number;
  season: string;
  coaches?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    experience: string;
    position: string;
  }>;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
}

// Common NBA team IDs for reference
export const NBA_TEAM_IDS = {
  ATL: "1", // Atlanta Hawks
  BOS: "2", // Boston Celtics
  BKN: "17", // Brooklyn Nets
  CHA: "30", // Charlotte Hornets
  CHI: "4", // Chicago Bulls
  CLE: "5", // Cleveland Cavaliers
  DAL: "6", // Dallas Mavericks
  DEN: "7", // Denver Nuggets
  DET: "8", // Detroit Pistons
  GSW: "9", // Golden State Warriors
  HOU: "10", // Houston Rockets
  IND: "11", // Indiana Pacers
  LAC: "12", // LA Clippers
  LAL: "13", // Los Angeles Lakers
  MEM: "29", // Memphis Grizzlies
  MIA: "14", // Miami Heat
  MIL: "15", // Milwaukee Bucks
  MIN: "16", // Minnesota Timberwolves
  NOP: "3", // New Orleans Pelicans
  NYK: "18", // New York Knicks
  OKC: "25", // Oklahoma City Thunder
  ORL: "19", // Orlando Magic
  PHI: "20", // Philadelphia 76ers
  PHX: "21", // Phoenix Suns
  POR: "22", // Portland Trail Blazers
  SAC: "23", // Sacramento Kings
  SAS: "24", // San Antonio Spurs
  TOR: "28", // Toronto Raptors
  UTA: "26", // Utah Jazz
  WAS: "27", // Washington Wizards
} as const;

export type NBATeamAbbreviation = keyof typeof NBA_TEAM_IDS;
