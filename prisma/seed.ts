import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_RECORD,
  fetchPlayerStats,
  fetchTeamRecord,
  fetchTeamRoster,
  fetchTeams,
  hasContract,
  toPlayerFields,
} from "../src/lib/data-refresh";
import { loadDraftPicks } from "../src/lib/draft-picks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  log: ["info", "warn", "error"],
});


// NBA Conference and Division mappings
const NBA_DIVISIONS = {
  Atlantic: "Eastern",
  Central: "Eastern",
  Southeast: "Eastern",
  Northwest: "Western",
  Pacific: "Western",
  Southwest: "Western",
};

// ESPN Team ID to Division mapping
const TEAM_DIVISIONS: Record<string, string> = {
  "1": "Southeast", // Atlanta Hawks
  "2": "Atlantic", // Boston Celtics
  "3": "Atlantic", // Brooklyn Nets
  "4": "Southeast", // Charlotte Hornets
  "5": "Central", // Chicago Bulls
  "6": "Central", // Cleveland Cavaliers
  "7": "Southwest", // Dallas Mavericks
  "8": "Northwest", // Denver Nuggets
  "9": "Central", // Detroit Pistons
  "10": "Pacific", // Golden State Warriors
  "11": "Southwest", // Houston Rockets
  "12": "Central", // Indiana Pacers
  "13": "Pacific", // LA Clippers
  "14": "Pacific", // LA Lakers
  "15": "Southwest", // Memphis Grizzlies
  "16": "Southeast", // Miami Heat
  "17": "Central", // Milwaukee Bucks
  "18": "Northwest", // Minnesota Timberwolves
  "19": "Southwest", // New Orleans Pelicans
  "20": "Atlantic", // New York Knicks
  "21": "Northwest", // Oklahoma City Thunder
  "22": "Southeast", // Orlando Magic
  "23": "Atlantic", // Philadelphia 76ers
  "24": "Pacific", // Phoenix Suns
  "25": "Northwest", // Portland Trail Blazers
  "26": "Pacific", // Sacramento Kings
  "27": "Southwest", // San Antonio Spurs
  "28": "Atlantic", // Toronto Raptors
  "29": "Northwest", // Utah Jazz
  "30": "Southeast", // Washington Wizards
};

// Read and transform the JSON data to match the expected format
const capDataPath = path.join(
  __dirname,
  "seeddata",
  "nba_all_teams_cap_data.json"
);
const capData = JSON.parse(fs.readFileSync(capDataPath, "utf8"));

interface CapDataTeam {
  team: string;
  totalCapAllocations: number;
  capSpace: number;
  firstApronSpace: number;
  SecondApronSpace: number;
}

const salaryCapData = capData.map((team: CapDataTeam) => ({
  teamName: team.team,
  totalCapAllocation: Math.round(team.totalCapAllocations),
  capSpace: Math.round(team.capSpace),
  firstApronSpace: Math.round(team.firstApronSpace),
  secondApronSpace: Math.round(team.SecondApronSpace),
}));

async function seedTeams() {
  console.log("🏀 Seeding NBA teams...");

  const espnTeams = await fetchTeams();
  if (!espnTeams) throw new Error("Failed to fetch teams from ESPN");
  console.log(`Found ${espnTeams.length} teams from ESPN API`);

  const teams = [];

  for (const espnTeam of espnTeams) {
    const division = TEAM_DIVISIONS[espnTeam.id] || "Unknown";
    const conference =
      NBA_DIVISIONS[division as keyof typeof NBA_DIVISIONS] || "Unknown";
    const getSalaryCapData = salaryCapData.find(
      (t: { teamName: string }) => t.teamName === espnTeam.displayName
    );

    const teamData = {
      abbreviation: espnTeam.abbreviation,
      displayName: espnTeam.displayName,
      shortDisplayName: espnTeam.shortDisplayName,
      name: espnTeam.name,
      location: espnTeam.location,
      nickname: espnTeam.nickname,
      color: espnTeam.color,
      alternateColor: espnTeam.alternateColor,
      isActive: espnTeam.isActive,
      logos: espnTeam.logos,
      record: { ...((await fetchTeamRecord(espnTeam.id)) ?? DEFAULT_RECORD) },
      slug: espnTeam.slug,
      conference,
      division,
      totalCapAllocation: getSalaryCapData?.totalCapAllocation || 0,
      capSpace: getSalaryCapData?.capSpace || 0,
      firstApronSpace: getSalaryCapData?.firstApronSpace || 0,
      secondApronSpace: getSalaryCapData?.secondApronSpace || 0,
      links: espnTeam.links,
    };

    const team = await prisma.team.create({
      data: teamData,
    });

    teams.push({ ...team, espnTeamId: espnTeam.id });
    console.log(`✅ ${team.abbreviation} - ${team.name} (ESPN ID: ${espnTeam.id})`);
  }

  console.log(`🎉 Successfully seeded ${teams.length} teams\n`);
  return teams;
}

async function seedPlayers(teams: any[]) {
  console.log("👥 Seeding NBA players...");

  for (const team of teams) {
    const roster: any = (await fetchTeamRoster(team.espnTeamId)) ?? {
      athletes: [],
      team: "Unknown",
    };
    console.log(`Found ${roster.athletes.length} players for ${team.name} (ESPN ID: ${team.espnTeamId})`);

    const findTeam = await prisma.team.findUnique({
      where: {
        slug: team.slug,
      },
    });

    if (!findTeam) {
      console.warn(
        `Could not find team in database for ${team.name} (slug: ${team.slug})`
      );
      continue;
    }

    for (const player of roster.athletes) {
      if (hasContract(player)) {
        try {
          // Fetch player stats from ESPN
          const stats = await fetchPlayerStats(player.id.toString());

          const playerData = {
            ...toPlayerFields(player),
            contract: player.contract,
            statistics: stats ?? undefined,
            teamId: findTeam.id,
          };

          await prisma.player.create({
            data: playerData,
          });
          const statsStr = stats ? `${stats.points}ppg/${stats.rebounds}rpg/${stats.assists}apg` : "no stats";
          console.log(`  ✅ ${playerData.displayName} (${statsStr})`);

          // Small delay to avoid hammering ESPN API
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to add player ${player.displayName}:`, error);
        }
      }
    }
  }
}

async function main() {
  console.log("🚀 Starting NBA database seed...\n");

  try {
    // Clear existing data
    console.log("🧹 Cleaning existing data...");
    await prisma.tradeAsset.deleteMany();
    await prisma.tradeTeam.deleteMany();
    await prisma.tradeVote.deleteMany();
    await prisma.tradeComment.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.player.deleteMany();
    await prisma.draftPick.deleteMany();
    await prisma.team.deleteMany();
    console.log("✅ Cleared existing data\n");

    // Seed teams
    const teams = await seedTeams();

    // Seed players
    await seedPlayers(teams);

    // Seed draft picks
    const picks = await loadDraftPicks(
      prisma,
      JSON.parse(fs.readFileSync(path.join(__dirname, "seeddata", "draft_picks.json"), "utf-8"))
    );
    console.log(`📝 Loaded ${picks.picks} draft picks`);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`- Teams: ${teams.length}`);
    const playerCount = await prisma.player.count();
    const pickCount = await prisma.draftPick.count();
    console.log(`- Players: ${playerCount}`);
    console.log(`- Draft Picks: ${pickCount}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
