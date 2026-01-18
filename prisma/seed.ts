import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
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

// ESPN Team ID to Division mapping (you may need to adjust these)
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

// Map team slugs to ESPN team IDs
const teamIdMap: Record<string, string> = {
  atl: "1", // Atlanta Hawks
  bos: "2", // Boston Celtics
  bkn: "3", // Brooklyn Nets
  cha: "4", // Charlotte Hornets
  chi: "5", // Chicago Bulls
  cle: "6", // Cleveland Cavaliers
  dal: "7", // Dallas Mavericks
  den: "8", // Denver Nuggets
  det: "9", // Detroit Pistons
  gs: "10", // Golden State Warriors
  hou: "11", // Houston Rockets
  ind: "12", // Indiana Pacers
  lac: "13", // LA Clippers
  lal: "14", // LA Lakers
  mem: "15", // Memphis Grizzlies
  mia: "16", // Miami Heat
  mil: "17", // Milwaukee Bucks
  min: "18", // Minnesota Timberwolves
  no: "19", // New Orleans Pelicans
  ny: "20", // New York Knicks
  okc: "21", // Oklahoma City Thunder
  orl: "22", // Orlando Magic
  phi: "23", // Philadelphia 76ers
  phx: "24", // Phoenix Suns
  por: "25", // Portland Trail Blazers
  sac: "26", // Sacramento Kings
  sa: "27", // San Antonio Spurs
  tor: "28", // Toronto Raptors
  uta: "29", // Utah Jazz
  wsh: "30", // Washington Wizards
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

async function fetchTeams() {
  try {
    const url =
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";
    console.log("Fetching teams from:", url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to include only essential team info
    const teams =
      data.sports[0]?.leagues[0]?.teams?.map((teamData: any) => ({
        id: teamData.team.id,
        slug: teamData.team.slug,
        abbreviation: teamData.team.abbreviation,
        displayName: teamData.team.displayName,
        shortDisplayName: teamData.team.shortDisplayName,
        name: teamData.team.name,
        location: teamData.team.location,
        color: teamData.team.color,
        alternateColor: teamData.team.alternateColor,
        isActive: teamData.team.isActive,
        logos: teamData.team.logos,
        record: teamData.team.record,
        venue: teamData.team.venue,
        nickname: teamData.team.nickname,
        links: teamData.team.links,
      })) || [];

    return teams;

    // return [
    //   {
    //     id: data.sports[0]?.leagues[0]?.teams[0].team.id,
    //     abbreviation: data.sports[0]?.leagues[0]?.teams[0].team.abbreviation,
    //     displayName: data.sports[0]?.leagues[0]?.teams[0].team.displayName,
    //     shortDisplayName:
    //       data.sports[0]?.leagues[0]?.teams[0].team.shortDisplayName,
    //     name: data.sports[0]?.leagues[0]?.teams[0].team.name,
    //     location: data.sports[0]?.leagues[0]?.teams[0].team.location,
    //     color: data.sports[0]?.leagues[0]?.teams[0].team.color,
    //     alternateColor:
    //       data.sports[0]?.leagues[0]?.teams[0].team.alternateColor,
    //     isActive: data.sports[0]?.leagues[0]?.teams[0].team.isActive,
    //     logos: data.sports[0]?.leagues[0]?.teams[0].team.logos,
    //     record: data.sports[0]?.leagues[0]?.teams[0].team.record,
    //     slug: data.sports[0]?.leagues[0]?.teams[0].team.slug,
    //     nickname: data.sports[0]?.leagues[0]?.teams[0].team.nickname,
    //     links: data.sports[0]?.leagues[0]?.teams[0].team.links,
    //   },
    // ];
  } catch (error) {
    console.error("Error fetching teams:", error);
    throw error;
  }
}

async function fetchTeamRecord(teamId: string) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}`;
    console.log(`Fetching record for team ${teamId}...`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    const data = await response.json();
    return data.team?.record?.items[0]?.summary
      ? data.team?.record?.items[0]?.summary
      : "41-41";
  } catch (error) {
    console.error(`Error fetching record for team ${teamId}:`, error);
    return []; // Return empty array instead of throwing
  }
}

async function fetchTeamRoster(teamId: string) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
    console.log(`Fetching roster for team ${teamId}...`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch roster for team ${teamId}: ${response.status}`
      );
    }

    const data = await response.json();
    console.log("API Response:", JSON.stringify(data, null, 2));

    if (!data.athletes) {
      console.warn(`No athletes found in roster data for team ${teamId}`);
      return { athletes: [], team: data.team?.displayName || "Unknown" };
    }

    return {
      athletes: data.athletes,
      team: data.team?.displayName || "Unknown",
    };
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error);
    return { athletes: [], team: "Unknown" };
  }
}

async function seedTeams() {
  console.log("🏀 Seeding NBA teams...");

  const espnTeams = await fetchTeams();
  const sortedTeams = espnTeams.sort((a: any, b: any) => a.id - b.id);
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
      record: await fetchTeamRecord(espnTeam.id),
      slug: espnTeam.slug,
      conference,
      division,
      totalCapAllocation: getSalaryCapData?.totalCapAllocation || 0,
      capSpace: getSalaryCapData?.capSpace || 0,
      firstApronSpace: getSalaryCapData?.firstApronSpace || 0,
      secondApronSpace: getSalaryCapData?.secondApronSpace || 0,
      links: espnTeam.links,
    };

    console.log("Creating team:", teamData);

    const team = await prisma.team.create({
      data: teamData,
    });

    teams.push(team);
    console.log(`✅ ${team.abbreviation} - ${team.name}`);
  }

  console.log(`🎉 Successfully seeded ${teams.length} teams\n`);
  return teams;
}

async function seedPlayers(teams: any[]) {
  console.log("👥 Seeding NBA players...");

  for (const [index, team] of teams.entries()) {
    // const espnTeamId = teamIdMap[team.slug];
    // if (!espnTeamId) {
    //   console.warn(
    //     `No ESPN team ID found for ${team.name} (slug: ${team.slug})`
    //   );
    //   continue;
    // }
    const IdToString = (index + 1).toString();
    const roster: any = await fetchTeamRoster(IdToString);
    console.log(`Found ${roster.athletes.length} players for ${team.name}`);

    const findTeam = await prisma.team.findUnique({
      where: {
        slug: team.slug,
      },
    });

    console.log("findTeam", findTeam);
    if (!findTeam) {
      console.warn(
        `Could not find team in database for ${team.name} (slug: ${team.slug})`
      );
      continue;
    }

    for (const player of roster.athletes) {
      if (
        player.contract &&
        player.contract.salary !== 0 &&
        player.contract.yearsRemaing !== 0
      ) {
        try {
          const playerData = {
            espnId: player.id.toString(), // ESPN player ID
            firstName: player.firstName,
            lastName: player.lastName,
            fullName: player.fullName,
            displayName: player.displayName,
            shortName: player.shortName,
            weight: player.weight,
            displayWeight: player.displayWeight,
            height: player.height,
            displayHeight: player.displayHeight,
            age: player.age,
            dateOfBirth: player.dateOfBirth || "1990-01-01T00:00:00Z",
            birthPlace: player.birthPlace || null,
            slug: player.slug,
            headshot: player.headshot || null,
            jersey: player.jersey,
            position: player.position || null,
            injuries: player.injuries || [],
            experience: player.experience || { years: 0 },
            contract: player.contract || null,
            status: player.status || null,
            teamId: findTeam.id,
          };

          console.log(
            `Creating player: ${playerData.displayName} for team: ${team.name}`
          );
          await prisma.player.create({
            data: playerData,
          });
          console.log(`Successfully created player: ${playerData.displayName}`);
        } catch (error) {
          console.error(`Failed to add player ${player.displayName}:`, error);
        }
      }
    }
  }
}

async function seedDraftPicks(
  teams: { id: number; name: string; location: string }[]
) {
  console.log("Seeding draft picks...");

  // Read the draft picks data
  const draftPicksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "seeddata", "nba_draft_picks.json"),
      "utf-8"
    )
  );

  // Create a map of team names to team IDs
  const teamMap = new Map(
    teams.map((team) => [`${team.location} ${team.name}`, team.id])
  );

  // Track created picks for deduplication
  const createdPicks = new Set<string>();

  // Process each team's picks
  for (const [teamName, picks] of Object.entries(draftPicksData)) {
    const teamId = teamMap.get(teamName);
    if (!teamId) {
      console.warn(`Team not found: ${teamName}`);
      continue;
    }

    for (const pick of picks as any[]) {
      // Create a unique key for this pick
      const pickKey = `${pick.year}-${pick.round}-${teamId}`;

      // Skip if we've already created this pick
      if (createdPicks.has(pickKey)) {
        continue;
      }

      // Create the draft pick
      await prisma.draftPick.create({
        data: {
          year: parseInt(pick.year),
          round: pick.round,
          teamId: teamId,
          isSwap: pick.swap,
          isProtected:
            !pick.swap && pick.description.toLowerCase().includes("protected"),
          description: pick.description,
        },
      });

      createdPicks.add(pickKey);
    }
  }

  console.log("Draft picks seeded successfully!");
}

async function main() {
  console.log("🚀 Starting NBA database seed...\n");

  try {
    // Clear existing data (optional - remove if you want to keep existing data)
    console.log("🧹 Cleaning existing data...");
    await prisma.tradeAsset.deleteMany();
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
    await seedDraftPicks(teams);

    console.log("🎉 Database seeding completed successfully!");
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
