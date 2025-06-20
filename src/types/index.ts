// Base types for JSON fields
export type Position = {
  abbreviation: string;
  displayName: string;
  name: string;
  type: string;
};

export type Experience = {
  years: number;
  displayValue: string;
};

export type College = {
  name: string;
  city: string;
  state: string;
};

export type Headshot = {
  href: string;
  alt: string;
};

export type Status = {
  id: string;
  name: string;
  type: string;
  abbreviation: string;
};

export type Injury = {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  returnDate?: string;
};

export type Contract = {
  years: number;
  type: string;
  status: string;
  salary: number;
  yearsRemaining: number;
};

export type Statistics = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage: number;
};

export type BirthPlace = {
  city: string;
  country: string;
  state?: string;
};

export type Logo = {
  href: string;
  alt: string;
  width: number;
  height: number;
  rel: string[];
};

export type Record = {
  wins: number;
  losses: number;
  winPercentage: number;
  conferenceRank: number;
  divisionRank: number;
};

export type Venue = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  capacity: number;
  surface: string;
  roofType: string;
};

export interface SelectedAsset {
  id: string;
  type: "player" | "pick";
  teamId: number;
  targetTeamId?: number;
}

// Main model types
export type Team = {
  id: number;
  slug: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  location: string;
  color: string;
  alternateColor: string;
  isActive: boolean;
  logos: Logo[];
  record?: Record;
  venue?: Venue;
  conference: string;
  division: string;
  totalCapAllocation?: number;
  capSpace?: number;
  firstApronSpace?: number;
  secondApronSpace?: number;
  createdAt: Date;
  updatedAt: Date;
  players?: Player[];
  draftPicks?: DraftPick[];
};

export type Player = {
  id: number;
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
  birthPlace?: BirthPlace;
  jersey: string;
  position: Position;
  experience?: Experience;
  college?: College;
  headshot?: Headshot;
  status?: Status;
  injuries?: Injury[];
  contract?: Contract;
  statistics?: Statistics;
  teamId: number;
  team?: Team;
  createdAt: Date;
  updatedAt: Date;
};

export type DraftPick = {
  id: number;
  year: number;
  round: number;
  teamId: number;
  isProtected: boolean;
  isSwap: boolean;
  description?: string;
  team?: Team;
  createdAt: Date;
  updatedAt: Date;
};

export type Trade = {
  id: string;
  fromTeamId: number;
  toTeamId: number;
  isAIGenerated: boolean;
  reasoning?: string;
  fromTeam?: Team;
  toTeam?: Team;
  assets?: TradeAsset[];
  createdAt: Date;
  updatedAt: Date;
};

export type TradeAsset = {
  id: number;
  tradeId: string;
  assetType: "player" | "draft_pick";
  playerId?: number;
  player?: Player;
  draftPickId?: number;
  draftPick?: DraftPick;
  trade?: Trade;
  createdAt: Date;
};

// AI Generated Trade Types
export type TradeAssetInScenario = {
  name: string;
  type: "player" | "pick";
  from: string;
};

export type TeamTradeAssets = {
  players?: TradeAssetInScenario[];
  picks?: TradeAssetInScenario[];
};

export type TeamInTradeScenario = {
  teamName: string;
  explanation: string;
  salaryMatch: string;
  gives: TeamTradeAssets;
  receives: TeamTradeAssets;
};

export type TradeScenario = {
  teams: TeamInTradeScenario[];
};

export type GeneratedTradeResponse = {
  success: boolean;
  data: {
    trades: TradeScenario[];
    selectedAssets: SelectedAsset[];
  };
  source: string;
};
