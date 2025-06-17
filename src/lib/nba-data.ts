export interface Player {
  id: string
  name: string
  position: string
  salary: number // in millions
  stats: {
    ppg: number
    rpg: number
    apg: number
  }
}

export interface DraftPick {
  id: string
  year: number
  round: 1 | 2
  originalTeamId?: string // For traded picks
  description: string // e.g., "2025 1st Round Pick"
}

export interface TeamData {
  id: string
  name: string
  logoUrl: string
  capAllocation: number
  capSpace: number
  firstApronSpace: number
  secondApronSpace: number
  players: Player[]
  picks: DraftPick[]
}

export const ALL_NBA_TEAMS: TeamData[] = [
  {
    id: "LAL",
    name: "Los Angeles Lakers",
    logoUrl: "/placeholder.svg?width=40&height=40&text=LAL&bgColor=542583&textColor=FDB927",
    capAllocation: 170,
    capSpace: 5,
    firstApronSpace: -10,
    secondApronSpace: -20,
    players: [
      { id: "LAL-P1", name: "LeBron James", position: "SF", salary: 45.5, stats: { ppg: 27.1, rpg: 7.5, apg: 7.6 } },
      {
        id: "LAL-P2",
        name: "Anthony Davis",
        position: "PF/C",
        salary: 40.2,
        stats: { ppg: 25.0, rpg: 12.1, apg: 3.5 },
      },
      { id: "LAL-P3", name: "Austin Reaves", position: "SG", salary: 12.0, stats: { ppg: 15.9, rpg: 3.7, apg: 5.5 } },
    ],
    picks: [
      { id: "LAL-PK1", year: 2025, round: 1, description: "2025 LAL 1st" },
      { id: "LAL-PK2", year: 2026, round: 2, description: "2026 LAL 2nd" },
    ],
  },
  {
    id: "GSW",
    name: "Golden State Warriors",
    logoUrl: "/placeholder.svg?width=40&height=40&text=GSW&bgColor=006BB6&textColor=FDB927",
    capAllocation: 180,
    capSpace: -15,
    firstApronSpace: -25,
    secondApronSpace: -35,
    players: [
      { id: "GSW-P1", name: "Stephen Curry", position: "PG", salary: 55.7, stats: { ppg: 29.4, rpg: 6.1, apg: 6.3 } },
      { id: "GSW-P2", name: "Klay Thompson", position: "SG", salary: 30.0, stats: { ppg: 20.3, rpg: 3.5, apg: 2.3 } },
      { id: "GSW-P3", name: "Andrew Wiggins", position: "SF", salary: 25.0, stats: { ppg: 17.1, rpg: 5.0, apg: 2.3 } },
    ],
    picks: [
      { id: "GSW-PK1", year: 2025, round: 1, description: "2025 GSW 1st" },
      { id: "GSW-PK2", year: 2027, round: 1, description: "2027 GSW 1st" },
    ],
  },
  {
    id: "BOS",
    name: "Boston Celtics",
    logoUrl: "/placeholder.svg?width=40&height=40&text=BOS&bgColor=007A33&textColor=FFFFFF",
    capAllocation: 165,
    capSpace: 10,
    firstApronSpace: 0,
    secondApronSpace: -10,
    players: [
      { id: "BOS-P1", name: "Jayson Tatum", position: "SF", salary: 35.0, stats: { ppg: 30.1, rpg: 8.8, apg: 4.6 } },
      { id: "BOS-P2", name: "Jaylen Brown", position: "SG/SF", salary: 32.0, stats: { ppg: 26.6, rpg: 6.9, apg: 3.5 } },
      {
        id: "BOS-P3",
        name: "Kristaps Porzingis",
        position: "C/PF",
        salary: 30.0,
        stats: { ppg: 23.2, rpg: 8.4, apg: 2.7 },
      },
    ],
    picks: [
      { id: "BOS-PK1", year: 2025, round: 2, description: "2025 BOS 2nd" },
      { id: "BOS-PK2", year: 2026, round: 1, description: "2026 BOS 1st" },
    ],
  },
  {
    id: "DEN",
    name: "Denver Nuggets",
    logoUrl: "/placeholder.svg?width=40&height=40&text=DEN&bgColor=0E2240&textColor=FEC524",
    capAllocation: 175,
    capSpace: 0,
    firstApronSpace: -5,
    secondApronSpace: -15,
    players: [
      { id: "DEN-P1", name: "Nikola Jokic", position: "C", salary: 47.6, stats: { ppg: 27.1, rpg: 13.8, apg: 7.9 } },
      { id: "DEN-P2", name: "Jamal Murray", position: "PG", salary: 33.8, stats: { ppg: 21.2, rpg: 4.1, apg: 6.2 } },
    ],
    picks: [{ id: "DEN-PK1", year: 2025, round: 1, description: "2025 DEN 1st" }],
  },
  {
    id: "PHI",
    name: "Philadelphia 76ers",
    logoUrl: "/placeholder.svg?width=40&height=40&text=PHI&bgColor=006BB6&textColor=ED174C",
    capAllocation: 150,
    capSpace: 25,
    firstApronSpace: 15,
    secondApronSpace: 5,
    players: [
      { id: "PHI-P1", name: "Joel Embiid", position: "C", salary: 47.6, stats: { ppg: 33.1, rpg: 10.2, apg: 4.2 } },
      { id: "PHI-P2", name: "Tyrese Maxey", position: "PG/SG", salary: 13.0, stats: { ppg: 25.9, rpg: 3.7, apg: 6.2 } },
    ],
    picks: [
      { id: "PHI-PK1", year: 2026, round: 1, description: "2026 PHI 1st" },
      { id: "PHI-PK2", year: 2028, round: 1, description: "2028 PHI 1st" },
    ],
  },
]
