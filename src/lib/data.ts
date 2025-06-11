export interface Team {
  id: string
  name: string
}

export interface Player {
  id: string
  name: string
  team: string
  position: string
  salary: number
}

export interface DraftPick {
  id: string
  team: string
  year: number
  round: string
  description: string
}

export interface SportData {
  teams: Team[]
  players: Player[]
  draftPicks: DraftPick[]
}

// NBA Data
const nbaTeams: Team[] = [
  { id: "bos", name: "Boston Celtics" },
  { id: "bkn", name: "Brooklyn Nets" },
  { id: "nyk", name: "New York Knicks" },
  { id: "phi", name: "Philadelphia 76ers" },
  { id: "tor", name: "Toronto Raptors" },
  { id: "chi", name: "Chicago Bulls" },
  { id: "cle", name: "Cleveland Cavaliers" },
  { id: "det", name: "Detroit Pistons" },
  { id: "ind", name: "Indiana Pacers" },
  { id: "mil", name: "Milwaukee Bucks" },
  { id: "lal", name: "Los Angeles Lakers" },
  { id: "gsw", name: "Golden State Warriors" },
  { id: "dal", name: "Dallas Mavericks" },
  { id: "den", name: "Denver Nuggets" },
  { id: "mia", name: "Miami Heat" },
]

const nbaPlayers: Player[] = [
  // Boston Celtics
  { id: "jt0", name: "Jayson Tatum", team: "bos", position: "SF", salary: 37000000 },
  { id: "jb1", name: "Jaylen Brown", team: "bos", position: "SG", salary: 31830000 },
  { id: "kp2", name: "Kristaps Porzingis", team: "bos", position: "C", salary: 25750000 },
  { id: "jh3", name: "Jrue Holiday", team: "bos", position: "PG", salary: 30000000 },
  { id: "dw4", name: "Derrick White", team: "bos", position: "SG", salary: 18000000 },

  // Brooklyn Nets
  { id: "mc5", name: "Mikal Bridges", team: "bkn", position: "SF", salary: 23300000 },
  { id: "cs6", name: "Cameron Johnson", team: "bkn", position: "SF", salary: 18000000 },
  { id: "bd7", name: "Ben Simmons", team: "bkn", position: "PG", salary: 37900000 },
  { id: "ds8", name: "Dennis Smith Jr.", team: "bkn", position: "PG", salary: 2500000 },
  { id: "nc9", name: "Nic Claxton", team: "bkn", position: "C", salary: 8500000 },

  // Los Angeles Lakers
  { id: "lj23", name: "LeBron James", team: "lal", position: "SF", salary: 47600000 },
  { id: "ad3", name: "Anthony Davis", team: "lal", position: "PF", salary: 43200000 },
  { id: "ar1", name: "Austin Reaves", team: "lal", position: "SG", salary: 12000000 },
  { id: "dr4", name: "D'Angelo Russell", team: "lal", position: "PG", salary: 17300000 },
  { id: "jh21", name: "Jarred Vanderbilt", team: "lal", position: "PF", salary: 4700000 },

  // Golden State Warriors
  { id: "sc30", name: "Stephen Curry", team: "gsw", position: "PG", salary: 51900000 },
  { id: "kt11", name: "Klay Thompson", team: "gsw", position: "SG", salary: 43200000 },
  { id: "dg23", name: "Draymond Green", team: "gsw", position: "PF", salary: 25800000 },
  { id: "aw22", name: "Andrew Wiggins", team: "gsw", position: "SF", salary: 33600000 },
  { id: "kl7", name: "Kevon Looney", team: "gsw", position: "C", salary: 7500000 },

  // Dallas Mavericks
  { id: "ld77", name: "Luka Doncic", team: "dal", position: "PG", salary: 43300000 },
  { id: "ki11", name: "Kyrie Irving", team: "dal", position: "SG", salary: 38900000 },
  { id: "tj5", name: "Tim Hardaway Jr.", team: "dal", position: "SG", salary: 17900000 },
  { id: "dj42", name: "Daniel Gafford", team: "dal", position: "C", salary: 12400000 },
  { id: "pw25", name: "P.J. Washington", team: "dal", position: "PF", salary: 16000000 },

  // Denver Nuggets
  { id: "nj15", name: "Nikola Jokic", team: "den", position: "C", salary: 47600000 },
  { id: "jm27", name: "Jamal Murray", team: "den", position: "PG", salary: 33900000 },
  { id: "mp5", name: "Michael Porter Jr.", team: "den", position: "SF", salary: 33400000 },
  { id: "ag50", name: "Aaron Gordon", team: "den", position: "PF", salary: 22700000 },
  { id: "kc4", name: "Kentavious Caldwell-Pope", team: "den", position: "SG", salary: 14700000 },

  // Miami Heat
  { id: "jb22", name: "Jimmy Butler", team: "mia", position: "SF", salary: 45183960 },
  { id: "ba13", name: "Bam Adebayo", team: "mia", position: "C", salary: 32600000 },
  { id: "th14", name: "Tyler Herro", team: "mia", position: "SG", salary: 29000000 },
  { id: "tro0", name: "Terry Rozier", team: "mia", position: "PG", salary: 24900000 },
  { id: "kl7m", name: "Kevin Love", team: "mia", position: "PF", salary: 4000000 },
]

const nbaDraftPicks: DraftPick[] = [
  // Boston Celtics
  { id: "bos2025-1", team: "bos", year: 2025, round: "1st", description: "Protected 1-14" },
  { id: "bos2025-2", team: "bos", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "bos2026-1", team: "bos", year: 2026, round: "1st", description: "Unprotected" },

  // Brooklyn Nets
  { id: "bkn2025-1", team: "bkn", year: 2025, round: "1st", description: "Unprotected" },
  { id: "bkn2025-2", team: "bkn", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "bkn2026-2", team: "bkn", year: 2026, round: "2nd", description: "Unprotected" },

  // Los Angeles Lakers
  { id: "lal2025-1", team: "lal", year: 2025, round: "1st", description: "Protected 1-4" },
  { id: "lal2025-2", team: "lal", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "lal2027-1", team: "lal", year: 2027, round: "1st", description: "Unprotected" },

  // Golden State Warriors
  { id: "gsw2025-2", team: "gsw", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "gsw2026-1", team: "gsw", year: 2026, round: "1st", description: "Protected 1-20" },
  { id: "gsw2026-2", team: "gsw", year: 2026, round: "2nd", description: "Unprotected" },

  // Dallas Mavericks
  { id: "dal2025-1", team: "dal", year: 2025, round: "1st", description: "Protected 1-10" },
  { id: "dal2026-1", team: "dal", year: 2026, round: "1st", description: "Unprotected" },
  { id: "dal2026-2", team: "dal", year: 2026, round: "2nd", description: "Unprotected" },

  // Denver Nuggets
  { id: "den2025-2", team: "den", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "den2026-1", team: "den", year: 2026, round: "1st", description: "Protected 1-5" },
  { id: "den2027-1", team: "den", year: 2027, round: "1st", description: "Unprotected" },

  // Miami Heat
  { id: "mia2025-1", team: "mia", year: 2025, round: "1st", description: "Protected 1-14" },
  { id: "mia2025-2", team: "mia", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "mia2026-2", team: "mia", year: 2026, round: "2nd", description: "Unprotected" },
]

// NFL Data
const nflTeams: Team[] = [
  { id: "buf", name: "Buffalo Bills" },
  { id: "mia", name: "Miami Dolphins" },
  { id: "ne", name: "New England Patriots" },
  { id: "nyj", name: "New York Jets" },
  { id: "bal", name: "Baltimore Ravens" },
  { id: "cin", name: "Cincinnati Bengals" },
  { id: "cle", name: "Cleveland Browns" },
  { id: "pit", name: "Pittsburgh Steelers" },
  { id: "hou", name: "Houston Texans" },
  { id: "ind", name: "Indianapolis Colts" },
  { id: "jax", name: "Jacksonville Jaguars" },
  { id: "ten", name: "Tennessee Titans" },
  { id: "den", name: "Denver Broncos" },
  { id: "kc", name: "Kansas City Chiefs" },
  { id: "lv", name: "Las Vegas Raiders" },
  { id: "lac", name: "Los Angeles Chargers" },
]

const nflPlayers: Player[] = [
  // Buffalo Bills
  { id: "ja17", name: "Josh Allen", team: "buf", position: "QB", salary: 43000000 },
  { id: "sd4", name: "Stefon Diggs", team: "buf", position: "WR", salary: 22500000 },
  { id: "vmi30", name: "Von Miller", team: "buf", position: "LB", salary: 17500000 },
  { id: "mc4", name: "Matt Milano", team: "buf", position: "LB", salary: 11000000 },
  { id: "dc13", name: "Gabe Davis", team: "buf", position: "WR", salary: 8500000 },

  // Kansas City Chiefs
  { id: "pm15", name: "Patrick Mahomes", team: "kc", position: "QB", salary: 45000000 },
  { id: "tk87", name: "Travis Kelce", team: "kc", position: "TE", salary: 14300000 },
  { id: "ch95", name: "Chris Jones", team: "kc", position: "DT", salary: 28500000 },
  { id: "jr25", name: "Jaylen Watson", team: "kc", position: "CB", salary: 1200000 },
  { id: "ip8", name: "Isaiah Pacheco", team: "kc", position: "RB", salary: 1000000 },

  // Miami Dolphins
  { id: "tt1", name: "Tua Tagovailoa", team: "mia", position: "QB", salary: 53100000 },
  { id: "th10", name: "Tyreek Hill", team: "mia", position: "WR", salary: 30000000 },
  { id: "jw17", name: "Jaylen Waddle", team: "mia", position: "WR", salary: 28250000 },
  { id: "bc55", name: "Bradley Chubb", team: "mia", position: "LB", salary: 21800000 },
  { id: "ra28", name: "Raheem Mostert", team: "mia", position: "RB", salary: 3200000 },
]

const nflDraftPicks: DraftPick[] = [
  // Buffalo Bills
  { id: "buf2025-1", team: "buf", year: 2025, round: "1st", description: "Unprotected" },
  { id: "buf2025-2", team: "buf", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "buf2025-3", team: "buf", year: 2025, round: "3rd", description: "Unprotected" },

  // Kansas City Chiefs
  { id: "kc2025-1", team: "kc", year: 2025, round: "1st", description: "Unprotected" },
  { id: "kc2025-2", team: "kc", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "kc2026-1", team: "kc", year: 2026, round: "1st", description: "Unprotected" },

  // Miami Dolphins
  { id: "mia2025-1", team: "mia", year: 2025, round: "1st", description: "Unprotected" },
  { id: "mia2025-3", team: "mia", year: 2025, round: "3rd", description: "Unprotected" },
  { id: "mia2026-2", team: "mia", year: 2026, round: "2nd", description: "Unprotected" },
]

// MLB Data
const mlbTeams: Team[] = [
  { id: "bos", name: "Boston Red Sox" },
  { id: "nyy", name: "New York Yankees" },
  { id: "tb", name: "Tampa Bay Rays" },
  { id: "tor", name: "Toronto Blue Jays" },
  { id: "bal", name: "Baltimore Orioles" },
  { id: "hou", name: "Houston Astros" },
  { id: "sea", name: "Seattle Mariners" },
  { id: "tex", name: "Texas Rangers" },
  { id: "oak", name: "Oakland Athletics" },
  { id: "laa", name: "Los Angeles Angels" },
  { id: "lad", name: "Los Angeles Dodgers" },
  { id: "sd", name: "San Diego Padres" },
  { id: "sf", name: "San Francisco Giants" },
  { id: "col", name: "Colorado Rockies" },
  { id: "ari", name: "Arizona Diamondbacks" },
]

const mlbPlayers: Player[] = [
  // Los Angeles Dodgers
  { id: "mb50", name: "Mookie Betts", team: "lad", position: "OF", salary: 30000000 },
  { id: "fo22", name: "Freddie Freeman", team: "lad", position: "1B", salary: 27000000 },
  { id: "ws11", name: "Will Smith", team: "lad", position: "C", salary: 16000000 },
  { id: "jt10", name: "Justin Turner", team: "lad", position: "3B", salary: 15000000 },
  { id: "mu99", name: "Max Muncy", team: "lad", position: "2B", salary: 13500000 },

  // New York Yankees
  { id: "aj99", name: "Aaron Judge", team: "nyy", position: "OF", salary: 40000000 },
  { id: "gs24", name: "Giancarlo Stanton", team: "nyy", position: "DH", salary: 32000000 },
  { id: "gc68", name: "Gerrit Cole", team: "nyy", position: "P", salary: 36000000 },
  { id: "ar13", name: "Gleyber Torres", team: "nyy", position: "2B", salary: 9700000 },
  { id: "dj26", name: "DJ LeMahieu", team: "nyy", position: "1B", salary: 15000000 },

  // Houston Astros
  { id: "ja2", name: "Jose Altuve", team: "hou", position: "2B", salary: 29000000 },
  { id: "ab27", name: "Alex Bregman", team: "hou", position: "3B", salary: 28500000 },
  { id: "yg44", name: "Yordan Alvarez", team: "hou", position: "DH", salary: 19500000 },
  { id: "kt5", name: "Kyle Tucker", team: "hou", position: "OF", salary: 7500000 },
  { id: "fv1", name: "Framber Valdez", team: "hou", position: "P", salary: 12500000 },
]

const mlbDraftPicks: DraftPick[] = [
  // Los Angeles Dodgers
  { id: "lad2025-1", team: "lad", year: 2025, round: "1st", description: "Competitive Balance Round A" },
  { id: "lad2025-2", team: "lad", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "lad2026-1", team: "lad", year: 2026, round: "1st", description: "Unprotected" },

  // New York Yankees
  { id: "nyy2025-1", team: "nyy", year: 2025, round: "1st", description: "Unprotected" },
  { id: "nyy2025-2", team: "nyy", year: 2025, round: "2nd", description: "Unprotected" },
  { id: "nyy2026-1", team: "nyy", year: 2026, round: "1st", description: "Unprotected" },

  // Houston Astros
  { id: "hou2025-1", team: "hou", year: 2025, round: "1st", description: "Unprotected" },
  { id: "hou2025-3", team: "hou", year: 2025, round: "3rd", description: "Unprotected" },
  { id: "hou2026-2", team: "hou", year: 2026, round: "2nd", description: "Unprotected" },
]

// MLS Data
const mlsTeams: Team[] = [
  { id: "atl", name: "Atlanta United FC" },
  { id: "aus", name: "Austin FC" },
  { id: "cin", name: "FC Cincinnati" },
  { id: "col", name: "Colorado Rapids" },
  { id: "clb", name: "Columbus Crew" },
  { id: "dc", name: "D.C. United" },
  { id: "dal", name: "FC Dallas" },
  { id: "hou", name: "Houston Dynamo FC" },
  { id: "lafc", name: "Los Angeles FC" },
  { id: "lag", name: "LA Galaxy" },
  { id: "mia", name: "Inter Miami CF" },
  { id: "min", name: "Minnesota United FC" },
  { id: "mtl", name: "CF Montréal" },
  { id: "nsh", name: "Nashville SC" },
  { id: "ne", name: "New England Revolution" },
]

const mlsPlayers: Player[] = [
  // Inter Miami CF
  { id: "lm10", name: "Lionel Messi", team: "mia", position: "RW", salary: 20446667 },
  { id: "sb19", name: "Sergio Busquets", team: "mia", position: "CDM", salary: 8000000 },
  { id: "ja8", name: "Jordi Alba", team: "mia", position: "LB", salary: 5000000 },
  { id: "lt9", name: "Luis Suarez", team: "mia", position: "ST", salary: 4500000 },
  { id: "dc25", name: "DeAndre Yedlin", team: "mia", position: "RB", salary: 800000 },

  // Los Angeles FC
  { id: "cv10", name: "Carlos Vela", team: "lafc", position: "CAM", salary: 4500000 },
  { id: "gb14", name: "Giorgio Chiellini", team: "lafc", position: "CB", salary: 3000000 },
  { id: "kb8", name: "Kellyn Acosta", team: "lafc", position: "CDM", salary: 1200000 },
  { id: "dr99", name: "Denis Bouanga", team: "lafc", position: "LW", salary: 2100000 },
  { id: "mr3", name: "Ryan Hollingshead", team: "lafc", position: "LB", salary: 650000 },

  // Atlanta United FC
  { id: "gi24", name: "Giorgos Giakoumakis", team: "atl", position: "ST", salary: 2900000 },
  { id: "th7", name: "Thiago Almada", team: "atl", position: "CAM", salary: 4000000 },
  { id: "bg4", name: "Brooks Lennon", team: "atl", position: "RB", salary: 450000 },
  { id: "ml16", name: "Matheus Rossetto", team: "atl", position: "CM", salary: 800000 },
  { id: "bg5", name: "Derrick Williams", team: "atl", position: "CB", salary: 350000 },
]

const mlsDraftPicks: DraftPick[] = [
  // Inter Miami CF
  { id: "mia2025-1", team: "mia", year: 2025, round: "1st", description: "SuperDraft Pick #8" },
  { id: "mia2025-2", team: "mia", year: 2025, round: "2nd", description: "SuperDraft Pick #35" },
  { id: "mia2026-1", team: "mia", year: 2026, round: "1st", description: "SuperDraft Pick" },

  // Los Angeles FC
  { id: "lafc2025-1", team: "lafc", year: 2025, round: "1st", description: "SuperDraft Pick #12" },
  { id: "lafc2025-3", team: "lafc", year: 2025, round: "3rd", description: "SuperDraft Pick #67" },
  { id: "lafc2026-2", team: "lafc", year: 2026, round: "2nd", description: "SuperDraft Pick" },

  // Atlanta United FC
  { id: "atl2025-1", team: "atl", year: 2025, round: "1st", description: "SuperDraft Pick #5" },
  { id: "atl2025-2", team: "atl", year: 2025, round: "2nd", description: "SuperDraft Pick #32" },
  { id: "atl2026-1", team: "atl", year: 2026, round: "1st", description: "SuperDraft Pick" },
]

// Export function to get sport data
export function getSportData(sport: "NBA" | "NFL" | "MLB" | "MLS"): SportData {
  switch (sport) {
    case "NBA":
      return { teams: nbaTeams, players: nbaPlayers, draftPicks: nbaDraftPicks }
    case "NFL":
      return { teams: nflTeams, players: nflPlayers, draftPicks: nflDraftPicks }
    case "MLB":
      return { teams: mlbTeams, players: mlbPlayers, draftPicks: mlbDraftPicks }
    case "MLS":
      return { teams: mlsTeams, players: mlsPlayers, draftPicks: mlsDraftPicks }
    default:
      return { teams: nbaTeams, players: nbaPlayers, draftPicks: nbaDraftPicks }
  }
}
